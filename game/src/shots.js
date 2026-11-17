// The staged screenshot scenes behind ?shot=.... Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (drive the road grid toward the mission marker, keep the police in
// frame), so the frame is what a real game really looks like and the same seed
// always gives the same frame. window.__shotReady is set once the scene has
// been painted twice.
import { STEP } from './config.js';
import { nearestRoad } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/**
 * A Manhattan route over the road grid: onto the nearest horizontal road, along
 * it to the target's column, then down that column to the target. Driving the
 * grid keeps the car on asphalt instead of cutting corners through buildings.
 */
function makeDrivePlan(world, targetX, targetY, tail) {
  const state = world.state;
  const car = world.playerCar();
  const px = car ? car.x : state.player.x;
  const py = car ? car.y : state.player.y;
  const roadY = nearestRoad(state.city, py);
  const points = [
    { x: nearestRoad(state.city, px), y: roadY },
    { x: targetX, y: roadY },
    { x: targetX, y: targetY },
  ];
  // Extra legs after the target (a getaway route that stays in the city).
  for (const leg of tail ?? []) points.push({ x: leg.x, y: leg.y });
  // Overshoot the target by one block so the car drives through it instead of
  // circling it once it arrives.
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  points.push({ x: last.x + Math.sign(last.x - prev.x) * 400, y: last.y + Math.sign(last.y - prev.y) * 400 });
  return { points, index: 0, recover: 0 };
}

function angleTo(car, point) {
  return Math.atan2(point.y - car.y, point.x - car.x);
}

function normAngle(diff) {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function driveToward(world, plan) {
  const state = world.state;
  const car = world.playerCar();
  if (!car) return { x: 0, y: 0 };
  // Reverse out of a wedge for a second when stuck (the recovery flag is set
  // by runSteps when the car has not moved for a while).
  if (plan.recover > 0) {
    plan.recover -= 1;
    return { x: 0, y: 1 };
  }
  // Past the last waypoint, keep driving straight down the road instead of
  // circling the point.
  if (plan.done) return { x: 0, y: -1 };
  const speed = Math.abs(car.speed);
  // Start the turn early at speed: aim for the next waypoint while still this
  // far from the current one, so the car arcs through the corner instead of
  // overshooting it into the building on the far side.
  const ahead = Math.max(46, speed * 0.35);
  let point = plan.points[plan.index];
  while (plan.index < plan.points.length - 1 && Math.hypot(point.x - car.x, point.y - car.y) < ahead) {
    plan.index += 1;
    point = plan.points[plan.index];
  }
  if (plan.index === plan.points.length - 1 && Math.hypot(point.x - car.x, point.y - car.y) < ahead) {
    plan.done = true;
    return { x: 0, y: -1 };
  }
  const want = angleTo(car, point);
  const diff = normAngle(want - car.angle);
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  // Brake for a sharp turn at speed so the car makes the corner.
  let gas = Math.abs(diff) > 0.45 && speed > 180 ? 1 : -1;
  // Anticipate the turn at the next waypoint, too.
  if (plan.index < plan.points.length - 1) {
    const next = plan.points[plan.index + 1];
    const turn = Math.abs(normAngle(angleTo(car, next) - want));
    const distToPoint = Math.hypot(point.x - car.x, point.y - car.y);
    if (turn > 0.6 && distToPoint < Math.max(160, speed * 0.45) && speed > 180) gas = 1;
  }
  return { x: steer, y: gas };
}

function autopilotOnFoot(world, targetX, targetY) {
  const player = world.state.player;
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  return {
    x: Math.abs(dx) > 20 ? Math.sign(dx) : 0,
    y: Math.abs(dy) > 20 ? Math.sign(dy) : 0,
  };
}

function runSteps(world, seconds, drive, plan, stopWhen) {
  const steps = Math.floor(seconds / STEP);
  let lastX = 0;
  let lastY = 0;
  let stuckFor = 0;
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    const step = state.missionTarget;
    const targetX = step ? step.x : 1800;
    const targetY = step ? step.y : 1000;
    const move = drive && world.playerCar()
      ? driveToward(world, plan)
      : autopilotOnFoot(world, targetX, targetY);
    world.step(STEP, { move, sprint: false, firing: false }, null);
    if (state.over) break;
    if (stopWhen && stopWhen(state)) break;
    // Stuck detection: a driven car that has barely moved for a second backs
    // out of the wedge instead of pushing against it forever.
    if (drive && plan && world.playerCar()) {
      const car = world.playerCar();
      if (i % 30 === 0) {
        if (Math.hypot(car.x - lastX, car.y - lastY) < 12 && Math.abs(car.speed) < 40) {
          stuckFor += 1;
          if (stuckFor >= 2) {
            plan.recover = 45;
            stuckFor = 0;
          }
        } else {
          stuckFor = 0;
        }
        lastX = car.x;
        lastY = car.y;
      }
    }
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: start (title over downtown), foot (on foot in the city), chase
 * (driving with three wanted stars and police on the tail), mission (a job
 * in progress with its marker and objective on the HUD).
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'start') {
    for (let i = 0; i < 5 / STEP; i += 1) {
      world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, firing: false }, null);
    }
    return { screen: SCREEN_TITLE, hasSave: false };
  }
  if (name === 'foot') {
    world.beginStory();
    // Walk toward the first pickup and stop just short of it, so the frame
    // shows the player on foot with the gold mission marker just ahead.
    runSteps(world, 9, false, null, (state) => {
      const target = state.missionTarget;
      if (!target) return false;
      return Math.hypot(state.player.x - target.x, state.player.y - target.y) < 150;
    });
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  if (name === 'chase') {
    world.beginStory();
    // Pick the client up first, so the chase is the getaway drive itself:
    // the objective reads "Drive the client to the Marina" and the car heads
    // for the Marina with three wanted stars and police on its tail.
    state.player.x = 1400;
    state.player.y = 600;
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, firing: false }, null);
    const parked = state.cars.find((c) => c.kind === 'parked');
    if (parked) {
      parked.x = 1420;
      parked.y = 620;
      state.player.x = 1420;
      state.player.y = 620;
      world.enterOrExitCar();
    }
    state.wanted = 3;
    state.wantedTimer = 24;
    // The getaway runs the Marina road, then turns west along it so the chase
    // stays in the city instead of running off the beach.
    const plan = makeDrivePlan(world, 2200, 1400, [{ x: 1000, y: 1400 }]);
    runSteps(world, 7, true, plan);
    state.wanted = 3;
    state.wantedTimer = 24;
    state.message = 'The Solmar Bay PD is on your tail — lose them!';
    state.messageTimer = 4;
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  // mission: mid-way through the first job, driving the client to the Marina.
  world.beginStory();
  world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, firing: false }, null);
  // Teleport-walk the player to the pickup, then get in a car and drive.
  state.player.x = 1400;
  state.player.y = 600;
  world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, firing: false }, null);
  const parked = state.cars.find((c) => c.kind === 'parked');
  if (parked) {
    parked.x = 1420;
    parked.y = 620;
    state.player.x = 1420;
    state.player.y = 620;
    world.enterOrExitCar();
  }
  const plan = makeDrivePlan(world, 2200, 1400);
  // A short drive, so the frame catches the car mid-route to the Marina with
  // the job still in progress (the world's own toast stays up).
  runSteps(world, 2.5, true, plan);
  return { screen: SCREEN_PLAY, hasSave: false };
}
