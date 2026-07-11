import {
  BA_CANVAS_W,
  BA_CANVAS_H,
  BA_GRAVITY,
  BA_WIND_MAX,
  BA_UNIT_W,
  BA_UNIT_H,
  BA_KNOCKBACK_SCALE,
  BA_FALL_SAFE_PX,
  BA_FALL_DMG_PER_PX,
  BA_FALL_DMG_CAP,
  BA_WEAPONS,
  type BlastWeaponId,
} from '@/config/constants';
import { isSolid, carveCircle } from '@/lib/blastTerrain';

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

// A live (unclaimed) supply crate; logical position is fixed the moment it spawns
export interface CrateState {
  id: string;
  x: number;
  y: number;
  weapon: BlastWeaponId;
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
  // Live crates + per-unit held bonus, so missed crate_picked events self-heal too
  crates: CrateState[];
  bonus: Record<string, BlastWeaponId | null>;
}

export interface ShotResult {
  frames: SimFrame[];
  explosionAt: { x: number; y: number } | null;
  carves: Carve[];
  // Explosion damage only; fall damage from the resulting launch is tracked separately
  damage: Record<string, number>;
  fallDamage: Record<string, number>;
  // Units whose flight ended in the hazard floor — instant KO
  hazardKO: string[];
  // Post-explosion ballistic arcs (t starts at the explosion moment) for playback
  unitFrames: Record<string, SimFrame[]>;
  finalPositions: Record<string, { x: number; y: number }>;
}

const MAX_STEPS = 1200;
const MAX_FLIGHT_STEPS = 600;
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

interface FlightOutcome {
  x: number;
  y: number;
  frames: SimFrame[];
  fallDamage: number;
  drowned: boolean;
}

// Integrate a unit's ballistic flight against (post-carve) terrain. Same axis-separated,
// trig-free stepping as projectiles so every client lands the unit on the same pixel.
function integrateUnitFlight(
  terrain: Uint8Array,
  hazardY: number | null,
  startX: number,
  startY: number,
  vx0: number,
  vy0: number,
): FlightOutcome {
  let x = startX;
  let y = startY;
  let vx = vx0;
  let vy = vy0;
  let peakY = y;
  const frames: SimFrame[] = [];

  for (let step = 0; step < MAX_FLIGHT_STEPS; step++) {
    vy += BA_GRAVITY;

    const nx = Math.max(BA_UNIT_W / 2, Math.min(BA_CANVAS_W - BA_UNIT_W / 2, x + vx));
    if (isSolid(terrain, nx, y - 1)) {
      vx = 0;
    } else {
      x = nx;
    }

    if (vy < 0) {
      const ny = y + vy;
      if (isSolid(terrain, x, ny - BA_UNIT_H)) {
        vy = 0;
      } else {
        y = ny;
        if (y < peakY) peakY = y;
      }
    } else {
      // Descend pixel by pixel so we land exactly on the first solid surface
      let remaining = vy;
      while (remaining > 0) {
        if (hazardY !== null && y >= hazardY) {
          frames.push({ x, y: hazardY, t: step });
          return { x, y: hazardY, frames, fallDamage: 0, drowned: true };
        }
        if (isSolid(terrain, x, y + 1)) {
          const drop = y - peakY;
          const fallDamage =
            drop > BA_FALL_SAFE_PX
              ? Math.floor(Math.min(BA_FALL_DMG_CAP, (drop - BA_FALL_SAFE_PX) * BA_FALL_DMG_PER_PX))
              : 0;
          frames.push({ x, y, t: step });
          return { x, y, frames, fallDamage, drowned: false };
        }
        const d = Math.min(1, remaining);
        y += d;
        remaining -= d;
      }
    }

    if (hazardY !== null && y >= hazardY) {
      frames.push({ x, y: hazardY, t: step });
      return { x, y: hazardY, frames, fallDamage: 0, drowned: true };
    }
    frames.push({ x, y, t: step });
  }

  return { x, y, frames, fallDamage: 0, drowned: false };
}

// Pure: does not mutate terrain or units; caller applies carves/damage/positions.
// When resolveUnits is true (default), post-explosion knockback launches and
// carve-triggered falls are integrated against a scratch copy of the carved terrain.
export function simulateShot(
  input: ShotInput,
  terrain: Uint8Array,
  units: UnitState[],
  wind: number,
  shooterId: string,
  hazardY: number | null = null,
  resolveUnits = true,
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
  const knockback: Record<string, { vx: number; vy: number }> = {};
  const carves: Carve[] = [];
  const fallDamage: Record<string, number> = {};
  const hazardKO: string[] = [];
  const unitFrames: Record<string, SimFrame[]> = {};
  const finalPositions: Record<string, { x: number; y: number }> = {};

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
        vx: (dx / safeDist) * dmg * BA_KNOCKBACK_SCALE,
        // Upward bias makes hits pop units off the ground, Worms-style
        vy: (dy / safeDist) * dmg * BA_KNOCKBACK_SCALE - dmg * 0.02,
      };
    }
  }

  if (resolveUnits && explosionAt) {
    // Flights collide against the terrain as it looks after this shot's craters
    const scratch = new Uint8Array(terrain);
    for (const carve of carves) {
      carveCircle(scratch, carve.x, carve.y, carve.r);
    }

    for (const unit of alive) {
      const postHp = unit.hp - (damage[unit.id] ?? 0);
      if (postHp <= 0) continue;

      const kb = knockback[unit.id];
      const ux = Math.max(BA_UNIT_W / 2, Math.min(BA_CANVAS_W - BA_UNIT_W / 2, unit.x));
      let uy = unit.y;
      // Pop out of any solid the unit ended up inside (shot origin snap edge cases)
      while (uy > 0 && isSolid(scratch, ux, uy)) uy--;

      // Grounded and untouched: nothing to integrate
      if (!kb && isSolid(scratch, ux, uy + 1)) continue;

      const flight = integrateUnitFlight(scratch, hazardY, ux, uy, kb?.vx ?? 0, kb?.vy ?? 0);
      finalPositions[unit.id] = { x: flight.x, y: flight.y };
      if (flight.frames.length > 0) unitFrames[unit.id] = flight.frames;
      if (flight.drowned) hazardKO.push(unit.id);
      else if (flight.fallDamage > 0) fallDamage[unit.id] = flight.fallDamage;
    }
  }

  return { frames, explosionAt, carves, damage, fallDamage, hazardKO, unitFrames, finalPositions };
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
