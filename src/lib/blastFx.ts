import { BA_CANVAS_W, BA_CANVAS_H } from '@/config/constants';

// Cosmetic-only effects for Blast Arena: particles, camera shake, screen flash,
// floating damage numbers, ambient clouds and wind streaks. Nothing here reads or
// writes simulation state — the renderer feeds positions in, effects draw pixels out.
// Determinism is unaffected: a client with different effects still computes the
// same terrain, HP, and positions.

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

const PARTICLE_POOL_SIZE = 220;
const NUMBER_LIFE_MS = 900;
const SHAKE_MS = 150;
const FLASH_MS = 120;
const CLOUD_COUNT = 4;
const STREAK_COUNT = 6;
const RING_MS = 320;

interface FxParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
  lifeMs: number;
  size: number;
  color: string;
  gravity: number;
}

interface FxRing {
  x: number;
  y: number;
  maxR: number;
  bornAt: number;
}

export interface FxDamageNumber {
  x: number;
  y: number;
  text: string;
  bornAt: number;
}

interface FxCloud {
  x: number;
  y: number;
  w: number;
  drift: number;
}

interface FxStreak {
  x: number;
  y: number;
}

export interface BlastFxState {
  reducedMotion: boolean;
  particles: FxParticle[];
  rings: FxRing[];
  numbers: FxDamageNumber[];
  clouds: FxCloud[];
  streaks: FxStreak[];
  shakeAmp: number;
  shakeUntil: number;
  flashUntil: number;
  lastFrameAt: number;
}

export function createFxState(reducedMotion: boolean): BlastFxState {
  const rng = mulberry32(Date.now() & 0x7fffffff);
  return {
    reducedMotion,
    particles: Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, bornAt: 0, lifeMs: 0, size: 1, color: '', gravity: 0,
    })),
    rings: [],
    numbers: [],
    clouds: Array.from({ length: CLOUD_COUNT }, (_, i) => ({
      x: rng() * BA_CANVAS_W,
      y: 8 + i * 12 + rng() * 8,
      w: 24 + rng() * 30,
      drift: 0.05 + rng() * 0.08,
    })),
    streaks: Array.from({ length: STREAK_COUNT }, () => ({
      x: rng() * BA_CANVAS_W,
      y: 10 + rng() * (BA_CANVAS_H * 0.4),
    })),
    shakeAmp: 0,
    shakeUntil: 0,
    flashUntil: 0,
    lastFrameAt: 0,
  };
}

function spawnParticle(
  fx: BlastFxState,
  p: Omit<FxParticle, 'active' | 'bornAt'>,
  now: number,
): void {
  let slot = fx.particles.find(q => !q.active);
  if (!slot) {
    // Pool exhausted: recycle the oldest live particle
    slot = fx.particles.reduce((a, b) => (a.bornAt <= b.bornAt ? a : b));
  }
  Object.assign(slot, p, { active: true, bornAt: now });
}

export interface FxPalette {
  explosion: string;
  smoke: string;
  dirt: string;
  terrain: string;
  cloud: string;
  trajectory: string;
  hazard: string;
}

// Debris/smoke are seeded from the blast position so both multiplayer clients see
// the same burst, purely for visual parity.
export function spawnExplosionFx(
  fx: BlastFxState,
  pal: FxPalette,
  x: number,
  y: number,
  r: number,
  now: number,
): void {
  fx.shakeAmp = Math.min(4, 1 + r * 0.18);
  fx.shakeUntil = now + SHAKE_MS;
  fx.flashUntil = now + FLASH_MS;
  if (fx.reducedMotion) return;

  fx.rings.push({ x, y, maxR: r * 1.6, bornAt: now });

  const rng = mulberry32((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663));
  const debrisCount = 8 + Math.floor(rng() * 9);
  for (let i = 0; i < debrisCount; i++) {
    const speed = 0.4 + rng() * 1.4;
    const dirX = rng() * 2 - 1;
    const dirY = -(0.3 + rng() * 0.9);
    // Terrain fragments (bigger, terrain-colored) mixed with hot debris
    const isFragment = rng() < 0.4;
    spawnParticle(fx, {
      x, y,
      vx: dirX * speed,
      vy: dirY * speed * 1.4,
      lifeMs: 500 + rng() * 400,
      size: isFragment ? 2 : 1,
      color: isFragment ? (rng() < 0.5 ? pal.terrain : pal.dirt) : pal.explosion,
      gravity: 0.05,
    }, now);
  }
  const smokeCount = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < smokeCount; i++) {
    spawnParticle(fx, {
      x: x + (rng() * 2 - 1) * r * 0.4,
      y: y + (rng() * 2 - 1) * r * 0.3,
      vx: (rng() * 2 - 1) * 0.15,
      vy: -(0.15 + rng() * 0.2),
      lifeMs: 700 + rng() * 500,
      size: 2,
      color: pal.smoke,
      gravity: -0.002,
    }, now);
  }
}

// Boot impact: comedic dust cloud, light shake, no flash
export function spawnBootImpactFx(
  fx: BlastFxState,
  pal: FxPalette,
  x: number,
  y: number,
  now: number,
): void {
  fx.shakeAmp = 1;
  fx.shakeUntil = now + SHAKE_MS * 0.6;
  if (fx.reducedMotion) return;
  const rng = mulberry32((Math.round(x) * 83492791) ^ Math.round(y));
  for (let i = 0; i < 8; i++) {
    spawnParticle(fx, {
      x, y,
      vx: (rng() * 2 - 1) * 0.8,
      vy: -(0.1 + rng() * 0.5),
      lifeMs: 350 + rng() * 250,
      size: rng() < 0.5 ? 2 : 1,
      color: pal.smoke,
      gravity: 0.01,
    }, now);
  }
}

// Hard landing: dust burst + screen shake scaled with the fall damage taken
export function spawnLandingFx(
  fx: BlastFxState,
  pal: FxPalette,
  x: number,
  y: number,
  dmg: number,
  now: number,
): void {
  fx.shakeAmp = Math.min(4, 1 + dmg * 0.08);
  fx.shakeUntil = now + SHAKE_MS;
  if (fx.reducedMotion) return;
  const rng = mulberry32((Math.round(x) * 40503) ^ (Math.round(y) * 73856093));
  for (let i = 0; i < 10; i++) {
    spawnParticle(fx, {
      x: x + (rng() * 2 - 1) * 3,
      y,
      vx: (rng() * 2 - 1) * 0.9,
      vy: -(0.1 + rng() * 0.4),
      lifeMs: 300 + rng() * 250,
      size: rng() < 0.5 ? 2 : 1,
      color: rng() < 0.5 ? pal.dirt : pal.smoke,
      gravity: 0.01,
    }, now);
  }
}

// Splash where a unit hits the hazard floor
export function spawnSplashFx(fx: BlastFxState, pal: FxPalette, x: number, y: number, now: number): void {
  fx.shakeAmp = 1;
  fx.shakeUntil = now + SHAKE_MS * 0.6;
  if (fx.reducedMotion) return;
  const rng = mulberry32((Math.round(x) * 19349663) ^ Math.round(y));
  for (let i = 0; i < 12; i++) {
    spawnParticle(fx, {
      x: x + (rng() * 2 - 1) * 4,
      y,
      vx: (rng() * 2 - 1) * 0.6,
      vy: -(0.4 + rng() * 1.0),
      lifeMs: 350 + rng() * 300,
      size: rng() < 0.4 ? 2 : 1,
      color: pal.hazard,
      gravity: 0.06,
    }, now);
  }
}

export function spawnMuzzleFx(fx: BlastFxState, pal: FxPalette, x: number, y: number, now: number): void {
  if (fx.reducedMotion) return;
  for (let i = 0; i < 4; i++) {
    spawnParticle(fx, {
      x, y,
      vx: (Math.random() * 2 - 1) * 0.5,
      vy: -Math.random() * 0.4,
      lifeMs: 180 + Math.random() * 120,
      size: 1,
      color: pal.explosion,
      gravity: 0,
    }, now);
  }
}

export function spawnTrailSmoke(fx: BlastFxState, pal: FxPalette, x: number, y: number, now: number): void {
  if (fx.reducedMotion) return;
  spawnParticle(fx, {
    x, y,
    vx: (Math.random() * 2 - 1) * 0.05,
    vy: -0.05,
    lifeMs: 400 + Math.random() * 200,
    size: 1,
    color: pal.smoke,
    gravity: -0.001,
  }, now);
}

export function spawnWalkDust(fx: BlastFxState, pal: FxPalette, x: number, y: number, now: number): void {
  if (fx.reducedMotion) return;
  spawnParticle(fx, {
    x, y,
    vx: (Math.random() * 2 - 1) * 0.2,
    vy: -0.1 - Math.random() * 0.1,
    lifeMs: 250,
    size: 1,
    color: pal.dirt,
    gravity: 0,
  }, now);
}

// KO poof: gray burst where the unit fell
export function spawnKoFx(fx: BlastFxState, pal: FxPalette, x: number, y: number, now: number): void {
  if (fx.reducedMotion) return;
  const rng = mulberry32((Math.round(x) * 2654435761) ^ Math.round(y));
  for (let i = 0; i < 10; i++) {
    const a = i / 10;
    spawnParticle(fx, {
      x, y: y - 4,
      vx: (a < 0.5 ? -1 : 1) * (0.2 + rng() * 0.6),
      vy: -(0.2 + rng() * 0.6),
      lifeMs: 450 + rng() * 300,
      size: rng() < 0.4 ? 2 : 1,
      color: pal.smoke,
      gravity: 0.005,
    }, now);
  }
}

export function spawnDamageNumber(fx: BlastFxState, x: number, y: number, amount: number, now: number): void {
  fx.numbers.push({ x, y, text: String(amount), bornAt: now });
}

export function fxShakeOffset(fx: BlastFxState, now: number): { x: number; y: number } {
  if (fx.reducedMotion || now >= fx.shakeUntil) return { x: 0, y: 0 };
  const decay = (fx.shakeUntil - now) / SHAKE_MS;
  const amp = fx.shakeAmp * decay;
  return {
    x: (Math.random() * 2 - 1) * amp,
    y: (Math.random() * 2 - 1) * amp,
  };
}

// Advance + draw the particle layer (call inside the shaken transform, after terrain/units)
export function drawFxParticles(ctx: CanvasRenderingContext2D, fx: BlastFxState, ringColor: string, now: number): void {
  const dt = fx.lastFrameAt > 0 ? Math.min(3, (now - fx.lastFrameAt) / (1000 / 60)) : 1;
  fx.lastFrameAt = now;

  for (const p of fx.particles) {
    if (!p.active) continue;
    const age = now - p.bornAt;
    if (age >= p.lifeMs) {
      p.active = false;
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = 1 - age / p.lifeMs;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  fx.rings = fx.rings.filter(ring => now - ring.bornAt < RING_MS);
  for (const ring of fx.rings) {
    const t = (now - ring.bornAt) / RING_MS;
    ctx.globalAlpha = (1 - t) * 0.7;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.maxR * t, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function pruneNumbers(fx: BlastFxState, now: number): FxDamageNumber[] {
  fx.numbers = fx.numbers.filter(n => now - n.bornAt < NUMBER_LIFE_MS);
  return fx.numbers;
}

export function numberProgress(n: FxDamageNumber, now: number): number {
  return Math.min(1, (now - n.bornAt) / NUMBER_LIFE_MS);
}

// Ambient layer: drifting clouds behind the terrain and wind streaks in the sky.
// Draw before terrain so gameplay readability is never affected.
export function drawFxAmbient(
  ctx: CanvasRenderingContext2D,
  fx: BlastFxState,
  pal: FxPalette,
  wind: number,
  windMax: number,
  now: number,
): void {
  if (fx.reducedMotion) return;
  const dt = Math.min(3, fx.lastFrameAt > 0 ? (now - fx.lastFrameAt) / (1000 / 60) : 1);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.cloud;
  for (const cloud of fx.clouds) {
    cloud.x += cloud.drift * (wind >= 0 ? 1 : -1) * dt;
    if (cloud.x > BA_CANVAS_W + cloud.w) cloud.x = -cloud.w;
    if (cloud.x < -cloud.w) cloud.x = BA_CANVAS_W + cloud.w;
    const cx = Math.round(cloud.x);
    const cy = Math.round(cloud.y);
    ctx.fillRect(cx, cy, Math.round(cloud.w), 3);
    ctx.fillRect(cx + 4, cy - 2, Math.round(cloud.w * 0.6), 2);
    ctx.fillRect(cx + 2, cy + 3, Math.round(cloud.w * 0.75), 2);
  }
  ctx.globalAlpha = 1;

  // Streaks only when the wind is worth reading
  const strength = Math.abs(wind) / windMax;
  if (strength > 0.25) {
    ctx.globalAlpha = 0.25 + strength * 0.3;
    ctx.fillStyle = pal.trajectory;
    const speed = wind * 220;
    for (const streak of fx.streaks) {
      streak.x += speed * dt;
      if (streak.x > BA_CANVAS_W + 12) streak.x = -12;
      if (streak.x < -12) streak.x = BA_CANVAS_W + 12;
      ctx.fillRect(Math.round(streak.x), Math.round(streak.y), Math.max(3, Math.round(6 * strength)), 1);
    }
    ctx.globalAlpha = 1;
  }
}

// Full-canvas explosion flash — draw last, outside the shake transform
export function drawFxScreenFlash(ctx: CanvasRenderingContext2D, fx: BlastFxState, color: string, now: number): void {
  if (fx.reducedMotion || now >= fx.flashUntil) return;
  ctx.globalAlpha = ((fx.flashUntil - now) / FLASH_MS) * 0.18;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, BA_CANVAS_W, BA_CANVAS_H);
  ctx.globalAlpha = 1;
}
