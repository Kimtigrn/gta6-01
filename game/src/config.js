// Tuning numbers, colours and names for Solmar Bay, an original sun-soaked coastal
// city. One place for every constant so the other modules never hard-code a number
// that two systems share. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to the window, so no rule depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;

export const CITY = {
  name: 'Solmar Bay',
  // Roads run on a grid; every road centre is a multiple of this spacing.
  spacing: 400,
  firstRoad: 200,
  roadWidth: 96,
  sidewalk: 18,
  // The south edge is the beach and the sea.
  beachY: 2200,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  sprintSpeed: 330,
  health: 100,
  maxAmmo: 120,
  startAmmo: 60,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 700,
  maxSpeed: 560,
  reverseSpeed: 180,
  turnRate: 2.6,
  drag: 0.6,
};

export const TRAFFIC = { count: 22, minSpeed: 110, maxSpeed: 185, countParked: 14 };
export const PEDS = { count: 34, minSpeed: 42, maxSpeed: 78 };
export const BULLET = { speed: 760, life: 0.9, damage: 34 };
export const WANTED = {
  max: 5,
  decaySeconds: 24,
  // How many police cars hunt the player at each wanted level.
  policeCars: [0, 1, 2, 3, 4, 5],
  policeSpeed: 500,
};

export const PALETTE = {
  backdrop: '#0e2a3f',
  grass: '#7fae5a',
  park: '#69a34e',
  sand: '#e8cf96',
  sea: '#2f7fa8',
  seaDeep: '#1f5f86',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: '#c96f4a',
  buildingRoof2: '#b85c72',
  buildingRoof3: '#5a7d9a',
  buildingRoof4: '#d9a441',
  buildingWall: '#8a6f5c',
  text: '#f5f1e6',
  muted: '#cfc8b4',
  hudPanel: 'rgba(12, 20, 28, 0.72)',
  wantedStar: '#ffd23f',
  police: '#2f6fd0',
  policeLight: '#ff3b30',
  player: '#ffd23f',
  enemy: '#e5534b',
  mission: '#ff9f1c',
  money: '#7ed957',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Save slot in this browser only. */
export const SAVE_KEY = 'solmar-bay.save.v1';

/** Rank titles shown as the player's cash grows. */
export const RANKS = [
  { cash: 0, title: 'Nobody' },
  { cash: 500, title: 'Wheelman' },
  { cash: 2000, title: 'Hustler' },
  { cash: 6000, title: 'Shot Caller' },
  { cash: 15000, title: 'King of Solmar Bay' },
];

export function rankFor(cash) {
  let rank = RANKS[0];
  for (const entry of RANKS) if (cash >= entry.cash) rank = entry;
  return rank.title;
}
