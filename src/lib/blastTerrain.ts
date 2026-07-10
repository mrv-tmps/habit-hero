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

// smoothstep interpolation — deliberately trig-free so terrain is bit-identical cross-browser
function smoothLerp(a: number, b: number, t: number): number {
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

// 1-bit solidity map (row-major, y * W + x); 1 = solid ground
export function generateTerrain(seed: number): Uint8Array {
  const rng = mulberry32(seed);
  const controlCount = Math.floor(W / CONTROL_SPACING) + 2;
  const controls: number[] = [];
  for (let i = 0; i < controlCount; i++) {
    controls.push(MIN_SURFACE + rng() * (MAX_SURFACE - MIN_SURFACE));
  }

  const terrain = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    const ci = Math.floor(x / CONTROL_SPACING);
    const t = (x % CONTROL_SPACING) / CONTROL_SPACING;
    const surfaceY = Math.floor(smoothLerp(controls[ci], controls[ci + 1], t));
    for (let y = surfaceY; y < H; y++) {
      terrain[y * W + x] = 1;
    }
  }
  return terrain;
}

export function isSolid(terrain: Uint8Array, x: number, y: number): boolean {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= W) return false;
  if (yi >= H) return true;
  if (yi < 0) return false;
  return terrain[yi * W + xi] === 1;
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
      if (dx * dx + dy * dy <= r2) terrain[y * W + x] = 0;
    }
  }
}

// First solid pixel from the top of the column; H - 1 when the column is empty
export function surfaceYAt(terrain: Uint8Array, x: number): number {
  const xi = Math.max(0, Math.min(W - 1, Math.round(x)));
  for (let y = 0; y < H; y++) {
    if (terrain[y * W + xi] === 1) return y;
  }
  return H - 1;
}

export function spawnPositions(
  seed: number,
  terrain: Uint8Array,
  count: number,
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
    const x = Math.round(margin + slot * i + slot / 2 + jitter);
    positions.push({ x, y: surfaceYAt(terrain, x) - 1 });
  }
  return positions;
}
