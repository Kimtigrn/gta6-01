// The player on foot and behind the wheel. On foot the player walks toward the
// move keys (sprint with Shift) and aims at the mouse; in a car the keys drive it
// like a car: up accelerates, down brakes and reverses, left and right steer, and
// steering only bites while the car is moving. Entering and leaving a car is the
// world module's job; this module owns the movement math.
import { CAR, PLAYER, STEP } from './config.js';
import { clampToWorld, collideBuildings } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.health, ammo: PLAYER.startAmmo,
    inCar: false, carId: -1, speed: 0, fireCooldown: 0, hurtFlash: 0,
  };
}

/** Aim angle from the player to a world point (the mouse, converted by main). */
export function aimAngle(player, worldX, worldY) {
  return Math.atan2(worldY - player.y, worldX - player.x);
}

export function stepOnFoot(player, city, move, sprint, dt) {
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const length = Math.hypot(move.x, move.y);
  if (length > 0) {
    player.x += (move.x / length) * speed * dt;
    player.y += (move.y / length) * speed * dt;
    player.angle = Math.atan2(move.y, move.x);
  }
  collideBuildings(city, player);
  clampToWorld(player, PLAYER.radius + 2);
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

/**
 * Drive `car` with the move keys. Returns true when the car hit something hard
 * enough to count as a crash (a building wall at speed).
 */
export function stepDriving(car, city, move, dt) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  let crashed = false;
  if (move.y < 0) car.speed += CAR.accel * dt;
  else if (move.y > 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.5 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * CAR.drag * 120 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
  const steer = move.x * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
  car.angle += steer;
  // Keep the heading bounded so it never winds up past a full turn.
  while (car.angle > Math.PI) car.angle -= Math.PI * 2;
  while (car.angle < -Math.PI) car.angle += Math.PI * 2;
  // Move one axis at a time so the car slides along a wall instead of wedging
  // into a building corner and stopping dead.
  const stepX = Math.cos(car.angle) * car.speed * dt;
  const stepY = Math.sin(car.angle) * car.speed * dt;
  const probeX = { x: car.x + stepX, y: car.y, radius: 20 };
  if (collideBuildings(city, probeX)) {
    if (Math.abs(car.speed) > 240) crashed = true;
    car.speed *= -0.25;
  } else {
    car.x += stepX;
  }
  const probeY = { x: car.x, y: car.y + stepY, radius: 20 };
  if (collideBuildings(city, probeY)) {
    if (Math.abs(car.speed) > 240) crashed = true;
    car.speed *= -0.25;
  } else {
    car.y += stepY;
  }
  clampToWorld(car, 26);
  return crashed;
}

/** The player takes damage; returns true when it kills them. */
export function damagePlayer(player, amount) {
  player.health -= amount;
  player.hurtFlash = 0.35;
  return player.health <= 0;
}

export { STEP };
