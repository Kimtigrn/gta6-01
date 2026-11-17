// Save and load: one localStorage slot holding the player's cash, story progress,
// position and health. Saving is explicit (the pause menu) and automatic on a
// mission completion, so a closed tab never loses a finished job.
import { SAVE_KEY } from './config.js';

/** The save payload, plain JSON. */
export function buildSave(state) {
  return {
    version: 1,
    cash: state.cash,
    missionIndex: state.mission.index,
    missionStep: state.mission.step,
    missionKills: state.mission.kills,
    storyDone: state.mission.storyDone,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    health: Math.round(state.player.health),
    ammo: state.player.ammo,
    elapsed: Math.round(state.elapsed),
    stats: state.stats,
  };
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}

/** Apply a loaded save to a fresh world state. */
export function applySave(state, data) {
  state.cash = data.cash ?? 0;
  state.elapsed = data.elapsed ?? 0;
  state.player.x = data.x ?? 1000;
  state.player.y = data.y ?? 1060;
  state.player.health = data.health ?? 100;
  state.player.ammo = data.ammo ?? 60;
  state.stats = { ...state.stats, ...(data.stats ?? {}) };
  state.mission.index = data.missionIndex ?? 0;
  state.mission.step = data.missionStep ?? 0;
  state.mission.kills = data.missionKills ?? 0;
  state.mission.storyDone = Boolean(data.storyDone);
  state.mission.active = !state.mission.storyDone;
}
