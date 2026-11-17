// Traffic and pedestrians. Traffic cars drive the road grid: each one follows a
// road line, turns at an intersection onto another road, and slows for the car
// ahead. Parked cars sit at the kerb and can be stolen. Pedestrians walk the
// sidewalks, turn at corners, and run from gunfire or a car bearing down on them.
import { CITY, PEDS, TRAFFIC, WORLD } from './config.js';
import { collideBuildings, isOnRoad, nearestRoad } from './city.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33d', '#7ed957', '#e8e8e8', '#8a5fd0', '#e07b39', '#4db8a8'];
const PED_COLORS = ['#e8b48a', '#c98a5f', '#8a5f3d', '#f0c8a0', '#a06a45'];
const PED_SHIRTS = ['#d94f3d', '#3d7dd9', '#7ed957', '#e8e8e8', '#8a5fd0', '#e07b39', '#4db8a8', '#f2f2f2'];

function randomRoadPoint(rng, roads) {
  const vertical = rng.next() < 0.5;
  const line = rng.pick(roads);
  const along = rng.range(120, WORLD.width - 120);
  return vertical ? { x: line + (rng.next() < 0.5 ? -24 : 24), y: along, angle: rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2 } : { x: along, y: line + (rng.next() < 0.5 ? -24 : 24), angle: rng.next() < 0.5 ? 0 : Math.PI };
}

/** A traffic car: {x, y, angle, speed, color, kind, targetSpeed, turnAt}. */
export function spawnTrafficCar(rng, roads, id) {
  const spot = randomRoadPoint(rng, roads);
  return {
    id, ...spot, speed: rng.range(TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    targetSpeed: rng.range(TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    color: rng.pick(CAR_COLORS), kind: 'traffic', radius: 20,
  };
}

export function spawnParkedCar(rng, roads, id) {
  const vertical = rng.next() < 0.5;
  const line = rng.pick(roads);
  const along = rng.range(160, WORLD.width - 160);
  const side = rng.next() < 0.5 ? -1 : 1;
  const spot = vertical
    ? { x: line + side * (CITY.roadWidth / 2 - 12), y: along, angle: side > 0 ? Math.PI / 2 : -Math.PI / 2 }
    : { x: along, y: line + side * (CITY.roadWidth / 2 - 12), angle: side > 0 ? 0 : Math.PI };
  return { id, ...spot, speed: 0, targetSpeed: 0, color: rng.pick(CAR_COLORS), kind: 'parked', radius: 20 };
}

export function spawnPedestrian(rng, roads, id) {
  const vertical = rng.next() < 0.5;
  const line = rng.pick(roads);
  const along = rng.range(120, WORLD.width - 120);
  const off = CITY.roadWidth / 2 + CITY.sidewalk / 2;
  const spot = vertical
    ? { x: line + (rng.next() < 0.5 ? -off : off), y: along, angle: rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2 }
    : { x: along, y: line + (rng.next() < 0.5 ? -off : off), angle: rng.next() < 0.5 ? 0 : Math.PI };
  return {
    id, ...spot, speed: rng.range(PEDS.minSpeed, PEDS.maxSpeed),
    skin: rng.pick(PED_COLORS), shirt: rng.pick(PED_SHIRTS),
    radius: 10, flee: 0, alive: true,
  };
}

/** Advance one traffic car: follow its road, turn at intersections, slow behind others. */
export function stepTrafficCar(car, city, cars, dt, rng) {
  if (car.kind === 'parked') return;
  const aheadX = car.x + Math.cos(car.angle) * 52;
  const aheadY = car.y + Math.sin(car.angle) * 52;
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - aheadX;
    const dy = other.y - aheadY;
    if (dx * dx + dy * dy < 48 * 48) { blocked = true; break; }
  }
  const want = blocked ? 0 : car.targetSpeed;
  car.speed += Math.sign(want - car.speed) * 160 * dt;
  car.speed = Math.max(0, Math.min(car.targetSpeed, car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // At an intersection (both axes near a road line) sometimes turn onto the cross road.
  const nearX = Math.abs(car.x - nearestRoad(city, car.x)) < 14;
  const nearY = Math.abs(car.y - nearestRoad(city, car.y)) < 14;
  if (nearX && nearY && rng.next() < 0.02) {
    const horizontal = Math.abs(Math.cos(car.angle)) > 0.5;
    if (horizontal) car.angle = rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    else car.angle = rng.next() < 0.5 ? 0 : Math.PI;
    car.x = nearestRoad(city, car.x);
    car.y = nearestRoad(city, car.y);
  }
  // Wrap around the far edge so traffic never runs out.
  if (car.x < 60) car.x = WORLD.width - 60;
  if (car.x > WORLD.width - 60) car.x = 60;
  if (car.y < 60) car.y = WORLD.height - 60;
  if (car.y > WORLD.height - 60) car.y = 60;
}

/** Advance one pedestrian: walk the sidewalk, turn at corners, flee danger. */
export function stepPedestrian(ped, city, danger, dt, rng) {
  if (!ped.alive) return;
  if (danger) {
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy);
    if (d < 180) {
      ped.flee = 1.2;
      ped.angle = Math.atan2(dy, dx);
    }
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    ped.x += Math.cos(ped.angle) * 190 * dt;
    ped.y += Math.sin(ped.angle) * 190 * dt;
  } else {
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    const nearX = Math.abs(ped.x - nearestRoad(city, ped.x)) < 16;
    const nearY = Math.abs(ped.y - nearestRoad(city, ped.y)) < 16;
    if (nearX && nearY && rng.next() < 0.015) {
      const horizontal = Math.abs(Math.cos(ped.angle)) > 0.5;
      ped.angle = horizontal ? (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng.next() < 0.5 ? 0 : Math.PI);
    }
  }
  collideBuildings(city, ped);
  ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
  ped.y = Math.max(30, Math.min(CITY.beachY + 20, ped.y));
}

/** True when a point is near a road (used to keep pedestrians off the grass). */
export function nearRoad(city, x, y) {
  return isOnRoad(city, x, y);
}
