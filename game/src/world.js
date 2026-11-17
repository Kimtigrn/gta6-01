// The simulation: one state, one fixed step, no drawing and no browser in it.
// It owns the player, every car, pedestrian, officer, enemy, bullet, pickup and
// particle, the wanted level, the clock, and the mission machine, and it reports
// what happened as bit flags so main.js can play the matching sounds.
import { BULLET, CAR, CITY, FIELD, PEDS, PLAYER, STEP, TRAFFIC, WANTED, WORLD } from './config.js';
import { generateCity, pointInBuilding } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, damagePlayer, stepDriving, stepOnFoot } from './player.js';
import { spawnParkedCar, spawnPedestrian, spawnTrafficCar, stepPedestrian, stepTrafficCar } from './traffic.js';
import { addWanted, spawnOfficer, spawnPoliceCar, stepOfficer, stepPoliceCar, tickWanted, wantedPoliceCount } from './police.js';
import { burst, createBullets, createParticles, fireBullet, makePickup, spawnEnemy, stepBullets, stepEnemy, stepParticles, stepPickups } from './combat.js';
import { advanceStep, currentMission, currentStep, missionReward, startMission } from './missions.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_OVER = 4;
export const EVENT_WANTED_UP = 8;
export const EVENT_WANTED_DOWN = 16;
export const EVENT_MISSION_STEP = 32;
export const EVENT_MISSION_DONE = 64;
export const EVENT_SHOOT = 128;
export const EVENT_CRASH = 256;
export const EVENT_STEAL = 512;
export const EVENT_MESSAGE = 1024;

const START = { x: 1000, y: 1060 };
const HOSPITAL = { x: 1000, y: 1800 };

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = generateCity(rng);
  const state = {
    seed, city, rng, elapsed: 0, clockMinutes: 9 * 60,
    cash: 0, wanted: 0, wantedTimer: 0,
    player: createPlayer(START.x, START.y),
    cars: [], peds: [], officers: [], enemies: [],
    bullets: createBullets(), particles: createParticles(), pickups: [],
    mission: null, message: '', messageTimer: 0,
    missionTarget: null,
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, shotsFired: 0 },
    over: false, storyToast: '',
  };
  let nextCarId = 1;
  let nextPedId = 1;
  let nextOfficerId = 1;

  function spawnCars() {
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      state.cars.push(spawnTrafficCar(rng, city.roads, nextCarId++));
    }
    for (let i = 0; i < TRAFFIC.countParked; i += 1) {
      state.cars.push(spawnParkedCar(rng, city.roads, nextCarId++));
    }
  }

  function spawnPeds() {
    for (let i = 0; i < PEDS.count; i += 1) {
      state.peds.push(spawnPedestrian(rng, city.roads, nextPedId++));
    }
  }

  function scatterPickups() {
    const kinds = ['cash', 'cash', 'cash', 'health', 'ammo', 'cash', 'health', 'ammo'];
    for (let i = 0; i < 16; i += 1) {
      const spot = openSpot();
      const kind = kinds[i % kinds.length];
      state.pickups.push(makePickup(kind, spot.x, spot.y, kind === 'cash' ? 25 : 0));
    }
  }

  /** A random point on the open street, never inside a building. */
  function openSpot() {
    for (let tries = 0; tries < 24; tries += 1) {
      const x = rng.range(200, WORLD.width - 200);
      const y = rng.range(200, CITY.beachY - 100);
      if (!pointInBuilding(city, x, y, 20)) return { x, y };
    }
    return { x: 1000, y: 1000 };
  }

  function setMessage(text) {
    state.message = text;
    state.messageTimer = 4;
  }

  function reset() {
    state.elapsed = 0;
    state.clockMinutes = 9 * 60;
    state.cash = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.player = createPlayer(START.x, START.y);
    state.cars = [];
    state.peds = [];
    state.officers = [];
    state.enemies = [];
    state.bullets = createBullets();
    state.particles = createParticles();
    state.pickups = [];
    state.stats = { kills: 0, carsStolen: 0, missionsDone: 0, shotsFired: 0 };
    state.over = false;
    nextCarId = 1;
    nextPedId = 1;
    nextOfficerId = 1;
    spawnCars();
    spawnPeds();
    scatterPickups();
    state.mission = { index: 0, step: 0, kills: 0, active: false, done: false, storyDone: false, targetCarId: -1 };
  }

  /** Begin the story (or resume it) and announce the first job. */
  function beginStory() {
    const mission = startMission(state.mission);
    if (!mission) return null;
    prepareStep();
    // Keep the toast short: the full brief lives in the mission log, and a
    // long line would spill out of the toast panel.
    setMessage(`${mission.title}: ${mission.steps[0].label}`);
    return mission;
  }

  /** Spawn whatever the current step needs (a marked car, gunmen, wanted heat). */
  function prepareStep() {
    const step = currentStep(state.mission);
    if (!step) return;
    if (step.type === 'steal') {
      const car = {
        id: nextCarId++, x: step.x + 40, y: step.y + 24, angle: 0, speed: 0,
        targetSpeed: 0, color: '#d94f3d', kind: 'mission', radius: 20,
      };
      state.cars.push(car);
      state.mission.targetCarId = car.id;
    }
    if (step.type === 'kill') {
      state.enemies = [];
      for (let i = 0; i < step.count; i += 1) {
        state.enemies.push(spawnEnemy(rng, step.x + rng.range(-90, 90), step.y + rng.range(-90, 90), step.type === 'kill' && state.mission.index === 4 ? 'guard' : 'rival'));
      }
    }
    if (step.wanted) {
      state.wanted = Math.max(state.wanted, step.wanted);
      state.wantedTimer = WANTED.decaySeconds;
    }
  }

  function finishStep() {
    const mission = currentMission(state.mission);
    const result = advanceStep(state.mission);
    if (result === 'mission') {
      const reward = missionReward(mission);
      state.cash += reward;
      state.stats.missionsDone += 1;
      setMessage(`${mission.title} complete! +$${reward}`);
      const next = currentMission(state.mission);
      if (next) {
        startMission(state.mission);
        prepareStep();
        state.message = `${mission.title} complete! +$${reward} — Next job: ${next.title}`;
        state.messageTimer = 6;
      } else {
        state.message = `${mission.title} complete! +$${reward} — Story complete. Solmar Bay is yours, ${'Rio'}.`;
        state.messageTimer = 8;
      }
      return EVENT_MISSION_DONE;
    }
    prepareStep();
    const step = currentStep(state.mission);
    if (step) setMessage(step.label);
    return EVENT_MISSION_STEP;
  }

  /** Enter the nearest car, or get out of the one being driven. Returns an event. */
  function enterOrExitCar() {
    const player = state.player;
    if (player.inCar) {
      const car = state.cars.find((c) => c.id === player.carId);
      if (car) {
        car.kind = 'parked';
        car.speed = 0;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      }
      player.inCar = false;
      player.carId = -1;
      return 0;
    }
    let best = null;
    let bestD = 90 * 90;
    for (const car of state.cars) {
      const d = dist2(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return 0;
    player.inCar = true;
    player.carId = best.id;
    player.x = best.x;
    player.y = best.y;
    let event = 0;
    if (best.kind === 'traffic') {
      if (addWanted(state, 1)) event |= EVENT_WANTED_UP;
      state.stats.carsStolen += 1;
      setMessage('Car stolen! The owner called the cops.');
      event |= EVENT_STEAL;
    } else if (best.kind === 'police') {
      if (addWanted(state, 2)) event |= EVENT_WANTED_UP;
      state.stats.carsStolen += 1;
      setMessage('You stole a police car!');
      event |= EVENT_STEAL;
    } else if (best.kind === 'mission') {
      setMessage('That’s the one. Get it to the garage.');
    }
    best.kind = 'player';
    return event;
  }

  function playerCar() {
    const player = state.player;
    if (!player.inCar) return null;
    return state.cars.find((c) => c.id === player.carId) ?? null;
  }

  function checkMissionStep() {
    const step = currentStep(state.mission);
    if (!step || !state.mission.active) return 0;
    const player = state.player;
    const car = playerCar();
    if (step.type === 'goto' || step.type === 'take') {
      if (dist2(player.x, player.y, step.x, step.y) < 80 * 80) return finishStep();
    } else if (step.type === 'drive') {
      if (car && dist2(car.x, car.y, step.x, step.y) < 90 * 90) return finishStep();
    } else if (step.type === 'steal') {
      if (player.inCar && player.carId === state.mission.targetCarId) return finishStep();
    } else if (step.type === 'kill') {
      if (state.mission.kills >= step.count) return finishStep();
    } else if (step.type === 'escape') {
      if (state.wanted === 0) return finishStep();
    }
    return 0;
  }

  function step(dt, input, aimWorld) {
    let events = 0;
    const player = state.player;
    if (state.over) return events;
    state.elapsed += dt;
    state.clockMinutes += dt * 0.5;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    // Wanted level decays after a quiet spell.
    if (tickWanted(state, dt)) events |= EVENT_WANTED_DOWN;

    // --- Player ---
    const car = playerCar();
    if (player.inCar && car) {
      if (stepDriving(car, state.city, input.move, dt)) {
        events |= EVENT_CRASH;
        burst(state.particles, car.x, car.y, '#e8d44d', 10, 160);
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = car.speed;
    } else {
      stepOnFoot(player, state.city, input.move, input.sprint, dt);
      player.speed = 0;
    }
    player.angle = player.inCar ? player.angle : (aimWorld ? Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x) : player.angle);

    // Shooting (on foot only).
    if (!player.inCar && input.firing && player.ammo > 0 && player.fireCooldown <= 0) {
      const angle = aimWorld ? Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x) : player.angle;
      if (fireBullet(state.bullets, player.x, player.y, angle, true)) {
        player.ammo -= 1;
        player.fireCooldown = 0.18;
        state.stats.shotsFired += 1;
        events |= EVENT_SHOOT;
        burst(state.particles, player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, '#ffd23f', 3, 120);
        // Firing in public draws the law.
        if (state.wanted < 1) addWanted(state, 1);
      }
    }

    // --- Traffic ---
    for (const other of state.cars) {
      if (other.kind === 'traffic') stepTrafficCar(other, state.city, state.cars, dt, rng);
    }
    // Player's car bumping traffic: shove both apart. The speed cost is charged
    // once per contact (a short cooldown), never every frame while they touch —
    // charging it every frame would multiply the speed away to nothing. A car
    // the player rear-ends gets shunted forward at the player's speed, so a
    // shunt clears the road instead of starting a traffic jam.
    if (car) {
      if (car.bumpCd > 0) car.bumpCd -= dt;
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked' || other.kind === 'mission') continue;
        const d2 = dist2(car.x, car.y, other.x, other.y);
        if (d2 < 46 * 46) {
          const d = Math.sqrt(d2) || 1;
          const push = 46 - d;
          const nx = (other.x - car.x) / d;
          const ny = (other.y - car.y) / d;
          other.x += nx * push;
          other.y += ny * push;
          if (other.kind === 'traffic') other.speed = Math.max(other.speed, Math.abs(car.speed) * 0.7);
          if (car.bumpCd <= 0) {
            car.bumpCd = 0.4;
            car.speed *= 0.95;
            if (other.kind === 'police') other.speed *= 0.9;
          }
        }
      }
      // Running over a pedestrian is a crime.
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
          ped.alive = false;
          burst(state.particles, ped.x, ped.y, '#e5534b', 12, 180);
          if (addWanted(state, 1)) events |= EVENT_WANTED_UP;
          setMessage('You hit a pedestrian!');
        }
      }
    } else {
      // A traffic car hitting the player on foot hurts.
      for (const other of state.cars) {
        if (other.kind !== 'traffic' || other.speed < 40) continue;
        if (dist2(player.x, player.y, other.x, other.y) < 30 * 30) {
          if (damagePlayer(player, 18)) { events |= EVENT_OVER; state.over = true; }
          else events |= EVENT_HIT;
          player.x += (player.x - other.x) * 0.4;
          player.y += (player.y - other.y) * 0.4;
          other.speed *= 0.4;
        }
      }
    }

    // --- Pedestrians ---
    const danger = player.inCar && car && Math.abs(car.speed) > 100 ? car : (state.stats.shotsFired > 0 && input.firing ? player : null);
    for (const ped of state.peds) stepPedestrian(ped, state.city, danger, dt, rng);
    // Dead pedestrians are replaced so the streets stay alive.
    if (state.peds.filter((p) => p.alive).length < PEDS.count - 6 && rng.next() < 0.01) {
      state.peds.push(spawnPedestrian(rng, state.city.roads, nextPedId++));
    }

    // --- Police ---
    const wantCount = wantedPoliceCount(state.wanted);
    const policeCars = state.cars.filter((c) => c.kind === 'police');
    if (policeCars.length < wantCount) {
      state.cars.push(spawnPoliceCar(rng, player, nextCarId++));
    } else if (policeCars.length > wantCount) {
      const extra = policeCars[policeCars.length - 1];
      state.cars.splice(state.cars.indexOf(extra), 1);
    }
    for (const cop of state.cars.filter((c) => c.kind === 'police')) {
      if (cop.ramCooldown > 0) cop.ramCooldown -= dt;
      if (stepPoliceCar(cop, player, car, state.city, dt)) {
        if (car) {
          // A ram shoves the car and costs a little speed, at most once a
          // second per unit, so a chase stays a chase instead of a pin.
          if (cop.ramCooldown <= 0) {
            cop.ramCooldown = 1.0;
            const dx = car.x - cop.x;
            const dy = car.y - cop.y;
            const d = Math.hypot(dx, dy) || 1;
            car.x += (dx / d) * 12;
            car.y += (dy / d) * 12;
            car.speed *= 0.95;
            burst(state.particles, car.x, car.y, '#2f6fd0', 6, 140);
          }
        } else if (damagePlayer(player, 10)) {
          events |= EVENT_OVER;
          state.over = true;
        }
      }
    }
    // Police units keep their distance from each other so they fan out.
    const units = state.cars.filter((c) => c.kind === 'police');
    for (let i = 0; i < units.length; i += 1) {
      for (let j = i + 1; j < units.length; j += 1) {
        const a = units[i];
        const b = units[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 52 * 52 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (52 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    // Officers on foot at wanted 2+.
    if (state.wanted >= 2 && state.officers.filter((o) => o.alive).length < state.wanted) {
      state.officers.push(spawnOfficer(rng, player, nextOfficerId++));
    }
    if (state.wanted === 0) state.officers = state.officers.filter((o) => o.alive && Math.hypot(o.x - player.x, o.y - player.y) < 500);
    for (const officer of state.officers) {
      if (stepOfficer(officer, player, dt, rng)) {
        fireBullet(state.bullets, officer.x, officer.y, officer.angle, false);
      }
    }

    // --- Enemies (mission gunmen) ---
    for (const enemy of state.enemies) stepEnemy(enemy, player, dt, rng, state.bullets);

    // --- Bullets ---
    const targets = [
      ...state.enemies,
      ...state.officers,
      ...state.peds.filter((p) => p.alive),
    ];
    const hits = stepBullets(state.bullets, dt, targets, player, null, (damage) => {
      // Bullets that reach a driver hit the car, not the driver: they slow it
      // and spark, but the driver only bleeds on foot.
      if (player.inCar) {
        const driven = playerCar();
        if (driven) driven.speed *= 0.97;
        burst(state.particles, player.x, player.y, '#e8d44d', 4, 120);
        return;
      }
      if (damagePlayer(player, damage)) { events |= EVENT_OVER; state.over = true; }
      else events |= EVENT_HIT;
    });
    for (const target of hits) {
      burst(state.particles, target.x, target.y, '#e5534b', 8, 160);
      if (!target.alive) {
        state.stats.kills += 1;
        if (target.kind === 'officer') {
          if (addWanted(state, 2)) events |= EVENT_WANTED_UP;
          setMessage('You took down an officer — the heat is on.');
        } else if (target.kind === 'rival' || target.kind === 'guard') {
          state.mission.kills += 1;
          state.cash += 50;
          burst(state.particles, target.x, target.y, '#7ed957', 8, 140);
        } else {
          // A pedestrian caught a bullet.
          if (addWanted(state, 1)) events |= EVENT_WANTED_UP;
        }
      }
    }

    // --- Pickups ---
    stepPickups(state.pickups, dt);
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      if (dist2(player.x, player.y, pickup.x, pickup.y) < 30 * 30) {
        if (pickup.kind === 'cash') { state.cash += pickup.value; setMessage(`+$${pickup.value}`); }
        else if (pickup.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); setMessage('Health +40'); }
        else if (pickup.kind === 'ammo') { player.ammo = Math.min(120, player.ammo + 30); setMessage('Ammo +30'); }
        burst(state.particles, pickup.x, pickup.y, '#7ed957', 8, 120);
        state.pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }
    if (state.pickups.length < 10 && rng.next() < 0.005) {
      const kind = rng.next() < 0.5 ? 'cash' : (rng.next() < 0.5 ? 'health' : 'ammo');
      const spot = openSpot();
      state.pickups.push(makePickup(kind, spot.x, spot.y, kind === 'cash' ? 25 : 0));
    }

    stepParticles(state.particles, dt);
    events |= checkMissionStep();
    // Where the HUD's marker and minimap point: the current step's target.
    // Computed after the step check, so the marker never points at the job
    // the player just finished.
    const liveStep = currentStep(state.mission);
    state.missionTarget = (state.mission.active && liveStep && typeof liveStep.x === 'number')
      ? { x: liveStep.x, y: liveStep.y }
      : null;
    return events;
  }

  /** Respawn after death: the hospital, a bill, and a clean slate with the law. */
  function respawn() {
    const player = state.player;
    player.health = PLAYER.health;
    player.x = HOSPITAL.x;
    player.y = HOSPITAL.y;
    player.inCar = false;
    player.carId = -1;
    state.cash = Math.max(0, state.cash - 100);
    state.wanted = 0;
    state.wantedTimer = 0;
    state.officers = [];
    state.enemies = [];
    state.over = false;
    setMessage('You woke up at St. Marina Hospital. -$100.');
  }

  reset();
  return {
    state, reset, step, enterOrExitCar, beginStory, respawn, playerCar,
    get mission() { return state.mission; },
  };
}

export { FIELD, STEP, CAR, BULLET };
