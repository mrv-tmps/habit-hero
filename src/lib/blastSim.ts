import {
  BA_CANVAS_W,
  BA_CANVAS_H,
  BA_GRAVITY,
  BA_WIND_MAX,
  BA_UNIT_W,
  BA_UNIT_H,
  BA_KNOCKBACK_SCALE,
  BA_WEAPONS,
  type BlastWeaponId,
} from '@/config/constants';
import { isSolid } from '@/lib/blastTerrain';

// DETERMINISM INVARIANT: no Math.sin/cos/tan/pow anywhere in the step loop.
// Trig happens once on the shooter's client (drag vector -> vx/vy); the payload
// carries velocities, so every client's replay is bit-identical.

export interface UnitState {
  id: string;
  nickname: string;
  colorIndex: number;
  hp: number;
  x: number;
  y: number;
  facing: -1 | 1;
  isLocal: boolean;
}

export interface ShotInput {
  weapon: BlastWeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SimFrame {
  x: number;
  y: number;
  t: number;
}

export interface Carve {
  x: number;
  y: number;
  r: number;
}

// Authoritative turn boundary broadcast by the host after every shot or skip.
// Non-hosts snap to this state, so drift (missed events, throttled tabs) self-heals.
export interface TurnResolution {
  resolved_turn: number;
  next_turn: number;
  next_active_id: string;
  hp: Record<string, number>;
  positions: Record<string, { x: number; y: number }>;
  carve: Carve | null;
}

export interface ShotResult {
  frames: SimFrame[];
  explosionAt: { x: number; y: number } | null;
  carves: Carve[];
  damage: Record<string, number>;
  knockback: Record<string, { dx: number; dy: number }>;
}

const MAX_STEPS = 1200;
const OUT_MARGIN = 50;

function unitHit(unit: UnitState, px: number, py: number): boolean {
  const hw = BA_UNIT_W / 2 + 1.5;
  return (
    px >= unit.x - hw &&
    px <= unit.x + hw &&
    py >= unit.y - BA_UNIT_H - 1.5 &&
    py <= unit.y + 1.5
  );
}

// Pure: does not mutate terrain or units; caller applies carves/damage/knockback.
export function simulateShot(
  input: ShotInput,
  terrain: Uint8Array,
  units: UnitState[],
  wind: number,
  shooterId: string,
): ShotResult {
  const cfg = BA_WEAPONS[input.weapon];
  const frames: SimFrame[] = [];
  let x = input.x;
  let y = input.y;
  let vx = input.vx;
  let vy = input.vy;
  let explosionAt: { x: number; y: number } | null = null;

  const alive = units.filter(u => u.hp > 0);

  for (let step = 0; step < MAX_STEPS; step++) {
    if (cfg.windAffected) vx += wind;
    vy += BA_GRAVITY;

    // Axis-separated movement so bounces reflect off the blocking axis
    const nx = x + vx;
    if (isSolid(terrain, nx, y)) {
      if (cfg.restitution > 0) {
        vx = -vx * cfg.restitution;
      } else {
        explosionAt = { x, y };
        break;
      }
    } else {
      x = nx;
    }

    const ny = y + vy;
    if (isSolid(terrain, x, ny)) {
      if (cfg.restitution > 0) {
        vy = -vy * cfg.restitution;
        vx *= 0.85;
      } else {
        explosionAt = { x, y };
        break;
      }
    } else {
      y = ny;
    }

    frames.push({ x, y, t: step });

    if (cfg.explodeOnUnitContact) {
      // Ignore the shooter for the first few steps so the shot can leave the barrel
      const hit = alive.find(u => (step > 6 || u.id !== shooterId) && unitHit(u, x, y));
      if (hit) {
        explosionAt = { x, y };
        break;
      }
    }

    if (cfg.fuseSteps !== null && step >= cfg.fuseSteps) {
      explosionAt = { x, y };
      break;
    }

    if (x < -OUT_MARGIN || x > BA_CANVAS_W + OUT_MARGIN || y > BA_CANVAS_H + OUT_MARGIN) {
      break;
    }
  }

  const damage: Record<string, number> = {};
  const knockback: Record<string, { dx: number; dy: number }> = {};
  const carves: Carve[] = [];

  if (explosionAt) {
    if (cfg.carves) carves.push({ x: explosionAt.x, y: explosionAt.y, r: cfg.radius });

    for (const unit of alive) {
      const dx = unit.x - explosionAt.x;
      const dy = unit.y - BA_UNIT_H / 2 - explosionAt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const reach = cfg.radius + BA_UNIT_W / 2;
      if (dist > reach) continue;

      const falloff = 1 - dist / reach;
      const dmg = Math.max(1, Math.round(cfg.damage * falloff));
      damage[unit.id] = dmg;

      const safeDist = Math.max(dist, 1);
      knockback[unit.id] = {
        dx: (dx / safeDist) * dmg * BA_KNOCKBACK_SCALE,
        // Upward bias makes hits pop units off the ground, Worms-style
        dy: (dy / safeDist) * dmg * BA_KNOCKBACK_SCALE - dmg * 0.12,
      };
    }
  }

  return { frames, explosionAt, carves, damage, knockback };
}

// Deterministic per-turn wind in [-BA_WIND_MAX, BA_WIND_MAX]
export function windAt(seed: number, turnIndex: number): number {
  let a = (seed ^ Math.imul(turnIndex + 1, 2654435761)) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return (r * 2 - 1) * BA_WIND_MAX;
}

// After carves/knockback: pop units out of solid ground, then drop them to the surface.
export function settleUnits(terrain: Uint8Array, units: UnitState[]): void {
  for (const unit of units) {
    if (unit.hp <= 0) continue;
    unit.x = Math.max(BA_UNIT_W / 2, Math.min(BA_CANVAS_W - BA_UNIT_W / 2, unit.x));
    let y = Math.min(unit.y, BA_CANVAS_H - 1);
    while (y > 0 && isSolid(terrain, unit.x, y)) y--;
    while (y < BA_CANVAS_H - 1 && !isSolid(terrain, unit.x, y + 1)) y++;
    unit.y = y;
  }
}
