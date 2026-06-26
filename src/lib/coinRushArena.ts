import {
  CR_DIFFICULTY_CONFIG,
  CR_GEM_LIFETIME_MS,
  type CRDifficulty,
  type CRDifficultyConfig,
} from '@/config/constants';

export type { CRDifficulty };
export type ArenaConfig = CRDifficultyConfig;

export interface Coin {
  id: number;
  x: number;
  y: number;
  kind: 'coin' | 'gem';
  spawnAt: number;   // elapsed ms at spawn
  expireAt: number | null;
}

export interface Saw {
  id: number;
  /** h = moves along x (fixed y lane); v = moves along y (fixed x lane) */
  axis: 'h' | 'v';
  lane: number;    // fixed coordinate in logical units
  min: number;     // patrol range start
  max: number;     // patrol range end
  phase: number;   // 0–1 starting phase offset
}

// ── PRNG ──────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Config ────────────────────────────────────────────────────────────────
export function getArenaConfig(difficulty: CRDifficulty): ArenaConfig {
  return CR_DIFFICULTY_CONFIG[difficulty];
}

// ── Coins ─────────────────────────────────────────────────────────────────
const COIN_MARGIN = 60;

export function getInitialCoins(seed: number, cfg: ArenaConfig): Coin[] {
  const rng = mulberry32(seed);
  const coins: Coin[] = [];
  for (let i = 0; i < cfg.coinPopulation; i++) {
    coins.push({
      id: i,
      x: COIN_MARGIN + rng() * (cfg.size - 2 * COIN_MARGIN),
      y: COIN_MARGIN + rng() * (cfg.size - 2 * COIN_MARGIN),
      kind: 'coin',
      spawnAt: 0,
      expireAt: null,
    });
  }
  return coins;
}

/**
 * Returns the next replacement coin for a given slot index.
 * Each (seed, slotIndex) pair always produces the same coin, on any machine.
 */
export function nextCoin(
  seed: number,
  cfg: ArenaConfig,
  replacedIndex: number,
  elapsedMs: number,
): Coin {
  const slotSeed = ((seed ^ (replacedIndex * 2654435761)) >>> 0);
  const rng = mulberry32(slotSeed);
  return {
    id: 10000 + replacedIndex,
    x: COIN_MARGIN + rng() * (cfg.size - 2 * COIN_MARGIN),
    y: COIN_MARGIN + rng() * (cfg.size - 2 * COIN_MARGIN),
    kind: 'coin',
    spawnAt: elapsedMs,
    expireAt: null,
  };
}

/**
 * Returns the gem that should be active for the given gem cycle index.
 * gemIndex = floor(elapsedMs / cfg.gemIntervalMs)
 */
export function getGemForIndex(
  seed: number,
  gemIndex: number,
  cfg: ArenaConfig,
): Coin {
  const gemSeed = ((seed ^ (gemIndex * 0xdeadbeef + 99999)) >>> 0);
  const rng = mulberry32(gemSeed);
  const spawnAt = gemIndex * cfg.gemIntervalMs;
  return {
    id: 50000 + gemIndex,
    x: COIN_MARGIN + rng() * (cfg.size - 2 * COIN_MARGIN),
    y: COIN_MARGIN + rng() * (cfg.size - 2 * COIN_MARGIN),
    kind: 'gem',
    spawnAt,
    expireAt: spawnAt + CR_GEM_LIFETIME_MS,
  };
}

// ── Saws ──────────────────────────────────────────────────────────────────
const SAW_MARGIN = 80;

export function getSaws(seed: number, cfg: ArenaConfig): Saw[] {
  // Offset the seed so saw positions don't correlate with coin positions.
  const rng = mulberry32(((seed + 12345678) >>> 0));
  const saws: Saw[] = [];
  for (let i = 0; i < cfg.sawCount; i++) {
    const axis: 'h' | 'v' = rng() < 0.5 ? 'h' : 'v';
    const lane = SAW_MARGIN + rng() * (cfg.size - 2 * SAW_MARGIN);
    const phase = rng();
    saws.push({
      id: i,
      axis,
      lane,
      min: SAW_MARGIN,
      max: cfg.size - SAW_MARGIN,
      phase,
    });
  }
  return saws;
}

/**
 * Pure function: returns the (x, y) centre of a saw in logical units at
 * the given elapsed time. Identical on every machine given the same inputs.
 */
export function sawPositionAt(
  saw: Saw,
  elapsedMs: number,
  cfg: ArenaConfig,
): { x: number; y: number } {
  const distance = saw.max - saw.min;
  const periodMs = (distance / cfg.sawSpeed) * 2000; // full back-and-forth
  const t = ((elapsedMs / periodMs) + saw.phase) % 1;
  // Triangle wave: 0 → 1 in first half, 1 → 0 in second half
  const pos = t < 0.5 ? t * 2 : (1 - t) * 2;
  const coord = saw.min + pos * distance;
  return saw.axis === 'h'
    ? { x: coord, y: saw.lane }
    : { x: saw.lane, y: coord };
}

// ── Collision helper ──────────────────────────────────────────────────────
export function circlesOverlap(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const minDist = ar + br;
  return dx * dx + dy * dy < minDist * minDist;
}
