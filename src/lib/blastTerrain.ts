import { BA_CANVAS_W, BA_CANVAS_H } from '@/config/constants';

// Same tiny PRNG as mathQuestions/typingWordSets — duplicated per lib by house convention.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = BA_CANVAS_W;
const H = BA_CANVAS_H;
const CONTROL_SPACING = 40;
const MIN_SURFACE = 70;
const MAX_SURFACE = 150;

// Cell values: 0 = air, 1 = dirt (carvable), 2 = rock (indestructible)
export const CELL_AIR = 0;
export const CELL_DIRT = 1;
export const CELL_ROCK = 2;

export type MapStructure = 'hills' | 'islands' | 'caverns' | 'pillars';

export const MAP_STRUCTURES: MapStructure[] = ['hills', 'islands', 'caverns', 'pillars'];

export interface GeneratedMap {
  terrain: Uint8Array;
  // Units whose feet reach this row are KO'd instantly; null = no hazard floor
  hazardY: number | null;
}

// smoothstep interpolation — deliberately trig-free so terrain is bit-identical cross-browser
function smoothLerp(a: number, b: number, t: number): number {
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

// Random structure derived from the shared seed — every client picks the same one.
// Session 14 replaces callers with an explicit picker; this stays as the "Random" path.
export function pickMapStructure(seed: number): MapStructure {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  return MAP_STRUCTURES[Math.floor(rng() * MAP_STRUCTURES.length)];
}

// Rolling-hills base — the original generator, rng consumption unchanged so 'hills'
// output stays bit-identical to pre-structure builds for the same seed.
function fillHills(rng: () => number, terrain: Uint8Array): void {
  const controlCount = Math.floor(W / CONTROL_SPACING) + 2;
  const controls: number[] = [];
  for (let i = 0; i < controlCount; i++) {
    controls.push(MIN_SURFACE + rng() * (MAX_SURFACE - MIN_SURFACE));
  }
  for (let x = 0; x < W; x++) {
    const ci = Math.floor(x / CONTROL_SPACING);
    const t = (x % CONTROL_SPACING) / CONTROL_SPACING;
    const surfaceY = Math.floor(smoothLerp(controls[ci], controls[ci + 1], t));
    for (let y = surfaceY; y < H; y++) {
      terrain[y * W + x] = CELL_DIRT;
    }
  }
}

function fillIslands(rng: () => number, terrain: Uint8Array): void {
  const count = 3 + Math.floor(rng() * 3);
  // Combined platform width must fit max player count × spawn gap (8 × 24 ≈ 192)
  const targetTotal = 200 + rng() * 50;
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < count; i++) {
    const w = 0.7 + rng() * 0.6;
    weights.push(w);
    weightSum += w;
  }
  const margin = 12;
  const free = W - margin * 2 - targetTotal;
  const gapWeights: number[] = [];
  let gapSum = 0;
  for (let i = 0; i <= count; i++) {
    const g = 0.4 + rng() * 0.6;
    gapWeights.push(g);
    gapSum += g;
  }

  let cursor = margin;
  for (let i = 0; i < count; i++) {
    cursor += (gapWeights[i] / gapSum) * free;
    const width = Math.round((weights[i] / weightSum) * targetTotal);
    const topY = 85 + rng() * 40;
    const thickness = 16 + rng() * 12;
    const x0 = Math.round(cursor);
    for (let x = x0; x < x0 + width && x < W; x++) {
      const t = (x - x0) / width;
      // Parabolic edge falloff (trig-free): 1 at center, 0 at the tips
      const edge = 1 - (2 * t - 1) * (2 * t - 1);
      const top = Math.floor(topY + (1 - edge) * 4);
      const bottom = Math.floor(topY + 6 + edge * thickness);
      for (let y = top; y < bottom && y < H; y++) {
        terrain[y * W + x] = CELL_DIRT;
      }
    }
    cursor += width;
  }
}

function fillCaverns(rng: () => number, terrain: Uint8Array): void {
  fillHills(rng, terrain);
  const pockets = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < pockets; i++) {
    const cx = 20 + rng() * (W - 40);
    const sy = surfaceYAt(terrain, cx);
    // depth 0 breaks the surface; deeper pockets become sealed caves
    const depth = rng() * 40;
    const cy = Math.min(H - 14, sy + 4 + depth);
    const r = 7 + rng() * 8;
    carveCircle(terrain, cx, cy, r);
  }
}

function fillPillars(rng: () => number, terrain: Uint8Array): void {
  fillHills(rng, terrain);
  const count = 2 + Math.floor(rng() * 3);
  // One pillar per interior region boundary — spawn areas between them stay reachable
  // by lobbing over the top (pillar tops never reach the ceiling).
  const spacing = W / (count + 1);
  for (let i = 0; i < count; i++) {
    const px = Math.round(spacing * (i + 1) + (rng() - 0.5) * 20);
    const width = 10 + Math.floor(rng() * 5);
    const sy = surfaceYAt(terrain, px);
    const height = 40 + rng() * 30;
    const top = Math.max(24, Math.round(sy - height));
    const x0 = Math.max(0, px - Math.floor(width / 2));
    const x1 = Math.min(W - 1, x0 + width - 1);
    const bottom = Math.min(H - 1, sy + 20);
    for (let x = x0; x <= x1; x++) {
      for (let y = top; y <= bottom; y++) {
        terrain[y * W + x] = CELL_ROCK;
      }
    }
  }
}

const HAZARD_FLOOR_Y = H - 10;

// Seeded cell grid (row-major, y * W + x) plus the structure's hazard floor
export function generateTerrain(seed: number, structure: MapStructure): GeneratedMap {
  const rng = mulberry32(seed);
  const terrain = new Uint8Array(W * H);
  switch (structure) {
    case 'hills':
      fillHills(rng, terrain);
      return { terrain, hazardY: null };
    case 'islands':
      fillIslands(rng, terrain);
      return { terrain, hazardY: HAZARD_FLOOR_Y };
    case 'caverns':
      fillCaverns(rng, terrain);
      return { terrain, hazardY: null };
    case 'pillars':
      fillPillars(rng, terrain);
      return { terrain, hazardY: null };
  }
}

export function isSolid(terrain: Uint8Array, x: number, y: number): boolean {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= W) return false;
  if (yi >= H) return true;
  if (yi < 0) return false;
  return terrain[yi * W + xi] !== CELL_AIR;
}

export function carveCircle(terrain: Uint8Array, cx: number, cy: number, r: number): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Rock is indestructible: craters stop at the rock boundary
      if (dx * dx + dy * dy <= r2 && terrain[y * W + x] === CELL_DIRT) {
        terrain[y * W + x] = CELL_AIR;
      }
    }
  }
}

// First solid pixel from the top of the column; H - 1 when the column is empty
export function surfaceYAt(terrain: Uint8Array, x: number): number {
  const xi = Math.max(0, Math.min(W - 1, Math.round(x)));
  for (let y = 0; y < H; y++) {
    if (terrain[y * W + xi] !== CELL_AIR) return y;
  }
  return H - 1;
}

// A column is spawnable when its surface sits above the hazard floor (an empty
// column reports H - 1, which always fails the hazard check on island maps).
function isSpawnableColumn(terrain: Uint8Array, hazardY: number | null, x: number): boolean {
  const sy = surfaceYAt(terrain, x);
  if (hazardY !== null && sy >= hazardY) return false;
  return sy > 0;
}

export function spawnPositions(
  seed: number,
  terrain: Uint8Array,
  count: number,
  hazardY: number | null,
): { x: number; y: number }[] {
  const rng = mulberry32(seed ^ 0x5f3759df);
  const margin = 30;
  const usable = W - margin * 2;
  const slot = usable / count;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Clamp jitter so adjacent spawns stay >=24px apart (2x the largest weapon
    // radius); at <=4 players slots are wide enough that this never binds.
    const jitter = (rng() - 0.5) * Math.min(slot * 0.5, Math.max(0, slot - 24));
    let x = Math.round(margin + slot * i + slot / 2 + jitter);
    // If the column misses land (island gaps), scan outward to the nearest valid one
    if (!isSpawnableColumn(terrain, hazardY, x)) {
      for (let d = 1; d < W; d++) {
        if (x - d >= 0 && isSpawnableColumn(terrain, hazardY, x - d)) {
          x = x - d;
          break;
        }
        if (x + d < W && isSpawnableColumn(terrain, hazardY, x + d)) {
          x = x + d;
          break;
        }
      }
    }
    positions.push({ x, y: surfaceYAt(terrain, x) - 1 });
  }
  return positions;
}
