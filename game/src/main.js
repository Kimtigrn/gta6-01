// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// four screens: title, play, paused and game over. A save in localStorage offers
// Continue on the title screen; progress also auto-saves on every finished job.
//
// ?seed=N fixes the city. ?shot=start|foot|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld, EVENT_CRASH, EVENT_HIT, EVENT_MISSION_DONE, EVENT_MISSION_STEP, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_STEAL, EVENT_WANTED_UP } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { applySave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';
import { objectiveText } from './missions.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

/** Read-only snapshot for automated play-testing (never used by the game itself). */
window.__debugState = () => {
  const player = world.state.player;
  const car = world.playerCar();
  const nearby = world.state.cars
    .filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 140)
    .map((c) => ({ kind: c.kind, x: Math.round(c.x), y: Math.round(c.y), speed: Math.round(c.speed), angle: Math.round(c.angle * 100) / 100 }));
  return {
    x: Math.round(player.x), y: Math.round(player.y),
    inCar: player.inCar, speed: car ? Math.round(car.speed) : 0,
    carAngle: car ? Math.round(car.angle * 100) / 100 : null,
    health: Math.round(player.health), ammo: player.ammo,
    cash: world.state.cash, wanted: world.state.wanted,
    objective: objectiveText(world.state.mission),
    missionTarget: world.state.missionTarget,
    cars: world.state.cars.length,
    pedsAlive: world.state.peds.filter((p) => p.alive).length,
    police: world.state.cars.filter((c) => c.kind === 'police').length,
    message: world.state.message,
    nearby,
  };
};

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.hasSave, world.state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let saveExists = hasSave();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(continueSave) {
    world.reset();
    if (continueSave) {
      const data = loadSave();
      if (data) {
        applySave(world.state, data);
        world.beginStory();
        // Resume mid-mission: re-arm the current step's spawns.
        world.state.mission.active = true;
        announce('Continued your story.');
      }
    } else {
      world.beginStory();
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the mission marker — gold diamond on the map.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(`Flatlined in Solmar Bay. Cash $${world.state.cash}. Jobs done ${world.state.stats.missionsDone}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) audio.wantedUp();
    if (events & EVENT_WANTED_UP) audio.wantedUp();
    if (events & EVENT_MISSION_STEP) audio.missionStart();
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      saveGame(world.state);
    }
  }

  function step() {
    const move = input.move();
    const aimScreen = input.mouse;
    const aimWorld = renderer.screenToWorld(aimScreen.x, aimScreen.y);
    const events = world.step(STEP, { move, sprint: input.sprint(), firing: input.firing() }, aimWorld);
    handleEvents(events);
    audio.engine(world.state.player.inCar ? Math.abs(world.state.player.speed ?? 0) / 560 : 0, world.state.player.inCar);
    audio.siren(STEP, world.state.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(screen === SCREEN_TITLE && saveExists);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_ENTER_CAR) {
        const events = world.enterOrExitCar();
        if (events) handleEvents(events);
        audio.door();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_ENTER_CAR) {
        saveGame(world.state);
        announce('Saved.');
      }
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else if (screen === SCREEN_TITLE) {
      // The title screen's backdrop stays alive: traffic drifts behind the panel.
      while (accumulator >= STEP) {
        world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, firing: false }, null);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, saveExists, world.state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter or click to start the story.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
