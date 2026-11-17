// The wanted system and the police who answer it. Crimes raise the wanted level;
// it decays after a quiet spell. Police cars spawn at the edge of view and chase
// the player, ramming their car; at wanted 2 and up, officers on foot get out and
// shoot. Losing the wanted level (escaping) is a mission objective in its own right.
import { CITY, WANTED, WORLD } from './config.js';
import { collideBuildings } from './city.js';

export const CRIME_STEAL = 1;
export const CRIME_HIT_PED = 1;
export const CRIME_SHOOT = 1;
export const CRIME_KILL_COP = 2;
export const CRIME_KILL_PED = 1;

/** A police car: like a traffic car, but it hunts. */
export function spawnPoliceCar(rng, player, id) {
  const angle = rng.range(0, Math.PI * 2);
  const dist = 620;
  const x = Math.max(120, Math.min(WORLD.width - 120, player.x + Math.cos(angle) * dist));
  const y = Math.max(120, Math.min(CITY.beachY - 60, player.y + Math.sin(angle) * dist));
  return {
    id, x, y, angle: Math.atan2(player.y - y, player.x - x),
    speed: 0, targetSpeed: WANTED.policeSpeed,
    color: '#2f6fd0', kind: 'police', radius: 20, sirenPhase: rng.range(0, 1),
    // Each unit tails a different lane of the player, so the chase fans out
    // instead of every car piling onto the same point.
    chaseOffset: ((id % 3) - 1) * 60,
  };
}

/** An officer on foot. */
export function spawnOfficer(rng, player, id) {
  const angle = rng.range(0, Math.PI * 2);
  return {
    id, x: player.x + Math.cos(angle) * 420, y: player.y + Math.sin(angle) * 420,
    angle: 0, speed: 0, health: 50, radius: 11, fireCooldown: rng.range(0.4, 1.2),
    kind: 'officer', alive: true,
  };
}

/** Raise the wanted level by `amount`, capped at the maximum. */
export function addWanted(state, amount) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.wantedTimer = WANTED.decaySeconds;
  return state.wanted > before;
}

/** Tick the wanted decay; call once a step. Returns true when the level dropped. */
export function tickWanted(state, dt) {
  if (state.wanted === 0) return false;
  state.wantedTimer -= dt;
  if (state.wantedTimer <= 0) {
    state.wanted -= 1;
    state.wantedTimer = WANTED.decaySeconds;
    return true;
  }
  return false;
}

/** How many police cars the current wanted level calls for. */
export function wantedPoliceCount(wanted) {
  return WANTED.policeCars[Math.max(0, Math.min(WANTED.max, wanted))];
}

/** Chase steering: turn toward a point just behind the target (a tail, not a
 * pile-on), drive fast, ram on contact. */
export function stepPoliceCar(car, player, playerCar, city, dt) {
  const target = playerCar ?? player;
  const heading = playerCar ? playerCar.angle : player.angle;
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  // Tail 50 px behind the target, offset sideways by this unit's lane.
  const tx = target.x - fx * 50 - fy * (car.chaseOffset ?? 0);
  const ty = target.y - fy * 50 + fx * (car.chaseOffset ?? 0);
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  car.speed += (car.targetSpeed - car.speed) * 0.8 * dt;
  // Move one axis at a time so a unit slides along a wall instead of driving
  // over a building roof: the law stays on the streets like everyone else.
  const stepX = Math.cos(car.angle) * car.speed * dt;
  const stepY = Math.sin(car.angle) * car.speed * dt;
  const probeX = { x: car.x + stepX, y: car.y, radius: 20 };
  if (!collideBuildings(city, probeX)) car.x += stepX;
  const probeY = { x: car.x, y: car.y + stepY, radius: 20 };
  if (!collideBuildings(city, probeY)) car.y += stepY;
  car.sirenPhase += dt;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const touching = dx * dx + dy * dy < 44 * 44;
  // The shove itself lives in the world step (with a cooldown); a ram must not
  // pin the player's car to a standstill by multiplying its speed away.
  return touching;
}

/** An officer chases the player on foot and fires when close enough. */
export function stepOfficer(officer, player, dt, rng) {
  if (!officer.alive) return false;
  const dx = player.x - officer.x;
  const dy = player.y - officer.y;
  const dist = Math.hypot(dx, dy);
  officer.angle = Math.atan2(dy, dx);
  if (dist > 300) {
    officer.x += (dx / dist) * 200 * dt;
    officer.y += (dy / dist) * 200 * dt;
  }
  officer.fireCooldown -= dt;
  if (dist < 320 && officer.fireCooldown <= 0) {
    officer.fireCooldown = rng.range(0.9, 1.6);
    return true;
  }
  return false;
}
