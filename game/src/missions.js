// The story and its missions. Rio Vega, a driver-for-hire in Solmar Bay, takes
// jobs from Mara Solano, a fixer who runs the city's night work from a cafe in
// Civic Plaza. Five jobs, each a chain of steps; finishing one pays cash and
// unlocks the next. Every step is one of a few kinds the world already knows
// how to test: go somewhere, drive somewhere, steal a marked car, defeat a
// number of gunmen, pick something up, or lose the cops.
export const STORY = {
  hero: 'Rio Vega',
  fixer: 'Mara Solano',
  city: 'Solmar Bay',
};

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    brief: 'Mara needs a driver she can trust. Pick up her client at Neon Corner and drive him to the Marina. No trouble, no cops.',
    reward: 250,
    steps: [
      { type: 'goto', x: 1400, y: 600, label: 'Pick up the client at Neon Corner' },
      { type: 'drive', x: 2200, y: 1400, label: 'Drive the client to the Marina' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    brief: 'A collector in Sunset Heights left a red Comet parked and unlocked. Take it. Mara’s garage in Palm Court pays well for a clean steal.',
    reward: 400,
    steps: [
      { type: 'goto', x: 1800, y: 1000, label: 'Find the red Comet in Sunset Heights' },
      { type: 'steal', x: 1800, y: 1000, label: 'Steal the Comet (E to get in)' },
      { type: 'drive', x: 600, y: 1800, label: 'Deliver the Comet to Mara’s garage' },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    brief: 'The Vipers jumped one of Mara’s couriers. Go to their corner on Harbor Lights, settle it, then report back to the cafe.',
    reward: 600,
    steps: [
      { type: 'goto', x: 2600, y: 600, label: 'Reach the Vipers’ corner' },
      { type: 'kill', x: 2600, y: 600, label: 'Deal with the Vipers', count: 3 },
      { type: 'goto', x: 1000, y: 1000, label: 'Report back to Mara’s cafe' },
    ],
  },
  {
    id: 'heat-run',
    title: 'Heat Run',
    brief: 'A package in Old Port, a buyer on the Boardwalk, and the police already watching the docks. Take the package, lose the heat, get paid.',
    reward: 900,
    steps: [
      { type: 'goto', x: 600, y: 1000, label: 'Collect the package in Old Port' },
      { type: 'drive', x: 2600, y: 1800, label: 'Drive the package to the Boardwalk — the cops are coming', wanted: 2 },
      { type: 'escape', label: 'Lose the cops (get your wanted level to zero)' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    brief: 'The Bay Bank moves its weekend cash at dawn. Mara has the route, the guards and the timing. Take the cash, reach the hideout, and Solmar Bay is yours.',
    reward: 2000,
    steps: [
      { type: 'goto', x: 1800, y: 600, label: 'Reach the Bay Bank' },
      { type: 'kill', x: 1800, y: 600, label: 'Get past the bank guards', count: 2 },
      { type: 'take', x: 1800, y: 600, label: 'Grab the cash' },
      { type: 'drive', x: 200, y: 1800, label: 'Drive the cash to the hideout' },
      { type: 'escape', label: 'Lose the cops and lie low' },
    ],
  },
];

/** Fresh mission progress: nothing started yet. */
export function createMissionState() {
  return { index: 0, step: 0, kills: 0, active: false, done: false, storyDone: false, targetCarId: -1 };
}

/** The mission currently offered (or null when the story is finished). */
export function currentMission(progress) {
  if (progress.storyDone || progress.index >= MISSIONS.length) return null;
  return MISSIONS[progress.index];
}

/** The step the player is on right now (or null). */
export function currentStep(progress) {
  const mission = currentMission(progress);
  if (!mission || progress.step >= mission.steps.length) return null;
  return mission.steps[progress.step];
}

/** Human-readable objective line for the HUD. */
export function objectiveText(progress) {
  const mission = currentMission(progress);
  if (!mission) return progress.storyDone ? 'Story complete — Solmar Bay is yours.' : 'No job yet.';
  const step = currentStep(progress);
  if (!step) return mission.title;
  if (step.type === 'kill') return `${mission.title}: ${step.label} (${progress.kills}/${step.count})`;
  return `${mission.title}: ${step.label}`;
}

/**
 * Start the next mission. Returns the mission, or null when the story is done.
 * The world uses the returned mission to spawn its marked car or its gunmen.
 */
export function startMission(progress) {
  const mission = currentMission(progress);
  if (!mission) return null;
  progress.active = true;
  progress.step = 0;
  progress.kills = 0;
  progress.targetCarId = -1;
  return mission;
}

/** Move to the next step; returns 'step' or 'mission' when the mission is done. */
export function advanceStep(progress) {
  const mission = currentMission(progress);
  if (!mission) return null;
  progress.step += 1;
  progress.kills = 0;
  if (progress.step >= mission.steps.length) {
    progress.active = false;
    progress.done = true;
    progress.index += 1;
    if (progress.index >= MISSIONS.length) progress.storyDone = true;
    return 'mission';
  }
  return 'step';
}

/** Cash reward for the mission that just finished. */
export function missionReward(mission) {
  return mission ? mission.reward : 0;
}
