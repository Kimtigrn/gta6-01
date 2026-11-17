// The city itself: a road grid, the blocks between the roads, the buildings and
// parks inside them, the beach and the sea along the south edge, and the district
// names. Everything is generated once from the seed, so the city never changes
// between visits. Collision is circle-vs-rectangle against the building list.
import { CITY, WORLD } from './config.js';

export const DISTRICTS = [
  { name: 'Old Port', x: 0, y: 0, w: 800, h: 800 },
  { name: 'Marina Row', x: 800, y: 0, w: 800, h: 800 },
  { name: 'Downtown', x: 1600, y: 0, w: 800, h: 800 },
  { name: 'Neon Mile', x: 2400, y: 0, w: 800, h: 800 },
  { name: 'Palm Court', x: 0, y: 800, w: 800, h: 800 },
  { name: 'Civic Plaza', x: 800, y: 800, w: 800, h: 800 },
  { name: 'Sunset Heights', x: 1600, y: 800, w: 800, h: 800 },
  { name: 'Harbor Lights', x: 2400, y: 800, w: 800, h: 800 },
  { name: 'Coral Park', x: 0, y: 1600, w: 1600, h: 600 },
  { name: 'Boardwalk', x: 1600, y: 1600, w: 1600, h: 600 },
];

const ROOFS = ['buildingRoof', 'buildingRoof2', 'buildingRoof3', 'buildingRoof4'];

/** Road centre lines, both directions. */
export function roadLines() {
  const lines = [];
  for (let x = CITY.firstRoad; x < WORLD.width; x += CITY.spacing) lines.push(x);
  return lines;
}

/** Build the city from the seeded random source. */
export function generateCity(rng) {
  const roads = roadLines();
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let bx = 0; bx < roads.length - 1; bx += 1) {
    for (let by = 0; by < roads.length - 1; by += 1) {
      const x0 = roads[bx] + CITY.roadWidth / 2 + CITY.sidewalk;
      const y0 = roads[by] + CITY.roadWidth / 2 + CITY.sidewalk;
      const x1 = roads[bx + 1] - CITY.roadWidth / 2 - CITY.sidewalk;
      const y1 = roads[by + 1] - CITY.roadWidth / 2 - CITY.sidewalk;
      // The bottom row of blocks is the beach, not buildings.
      if (y0 >= CITY.beachY) continue;
      if (rng.next() < 0.22) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = rng.int(4, 9);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(7, 12) });
        }
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const split = rng.next() < 0.5;
      const spots = split
        ? [
            { x: x0, y: y0, w: (x1 - x0) / 2 - 12, h: y1 - y0 },
            { x: x0 + (x1 - x0) / 2 + 12, y: y0, w: (x1 - x0) / 2 - 12, h: y1 - y0 },
          ]
        : [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
      for (const spot of spots) {
        const inset = rng.range(6, 22);
        buildings.push({
          x: spot.x + inset,
          y: spot.y + inset,
          w: spot.w - inset * 2,
          h: spot.h - inset * 2,
          roof: rng.pick(ROOFS),
          height: rng.int(1, 4),
        });
      }
    }
  }
  return { roads, buildings, parks, trees };
}

/** True when the point is on a road (within the asphalt, sidewalks aside). */
export function isOnRoad(city, x, y) {
  const half = CITY.roadWidth / 2 - 4;
  for (const line of city.roads) {
    if (Math.abs(x - line) < half || Math.abs(y - line) < half) return true;
  }
  return false;
}

/** The nearest road centre line on the given axis. */
export function nearestRoad(city, value) {
  let best = city.roads[0];
  for (const line of city.roads) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/** True when the point is inside any building (with a small margin). */
export function pointInBuilding(city, x, y, margin = 4) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return true;
  }
  return false;
}

/** Push a circle out of every building it overlaps; returns true on a hit. */
export function collideBuildings(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    const r = body.radius ?? 14;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * r;
        body.y = cy + (dy / d) * r;
      } else {
        body.y = b.y - r;
      }
    }
  }
  return hit;
}

/** Keep a body inside the world (the sea stops the player at the beach edge). */
export function clampToWorld(body, margin) {
  body.x = Math.max(margin, Math.min(WORLD.width - margin, body.x));
  body.y = Math.max(margin, Math.min(CITY.beachY + 30 - margin, body.y));
}

/** District name for a world point, for the HUD. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return y >= CITY.beachY ? 'Boardwalk Beach' : 'Solmar Bay';
}
