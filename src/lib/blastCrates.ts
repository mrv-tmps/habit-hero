import {
  BA_CANVAS_W,
  BA_BONUS_WEAPONS,
  BA_CRATE_INTERVAL_ROUNDS,
} from '@/config/constants';
import { surfaceYAt, isSolid, CELL_DIRT } from '@/lib/blastTerrain';
import type { CrateState } from '@/lib/blastSim';

// Same tiny PRNG as blastTerrain — duplicated per lib by house convention.
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

const EDGE_MARGIN = 12;
const MIN_HEADROOM = 20;

// Terrain-only validity so placement is a pure function of (seed, round, terrain):
// unit positions drift between clients mid-turn, terrain at a round start does not.
function isValidColumn(terrain: Uint8Array, hazardY: number | null, x: number): boolean {
  const sy = surfaceYAt(terrain, x);
  if (sy < MIN_HEADROOM) return false;
  if (hazardY !== null && sy >= hazardY) return false;
  // Dirt only — keeps crates off indestructible rock pillar tops
  return terrain[sy * BA_CANVAS_W + x] === CELL_DIRT && !isSolid(terrain, x, sy - 1);
}

// Round index at which a crate is due; -1 when this round spawns nothing
export function crateDueRound(round: number): number {
  if (round < BA_CRATE_INTERVAL_ROUNDS) return -1;
  return round - (round % BA_CRATE_INTERVAL_ROUNDS);
}

// Deterministic spawn for the given round: every client computes the same crate
// from the shared seed and its (identical) terrain state at the round boundary.
export function pickCrateSpawn(
  seed: number,
  round: number,
  terrain: Uint8Array,
  hazardY: number | null,
): CrateState | null {
  const rng = mulberry32((seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0);
  const weapon = BA_BONUS_WEAPONS[Math.floor(rng() * BA_BONUS_WEAPONS.length)];

  for (let attempt = 0; attempt < 40; attempt++) {
    const x = EDGE_MARGIN + Math.floor(rng() * (BA_CANVAS_W - EDGE_MARGIN * 2));
    if (!isValidColumn(terrain, hazardY, x)) continue;
    return { id: `crate-r${round}`, x, y: surfaceYAt(terrain, x) - 1, weapon };
  }
  return null;
}
