import {
  BA_DIFFICULTY_CONFIG,
  BA_MAX_LAUNCH_SPEED,
  BA_UNIT_H,
  BA_WEAPONS,
  type BlastDifficulty,
} from '@/config/constants';
import {
  simulateShot,
  type ShotInput,
  type UnitState,
} from '@/lib/blastSim';

const BOOT_RANGE_X = 14;
const BOOT_RANGE_Y = 12;

// Sum of uniforms approximates a gaussian without trig; solo-only so Math.random is fine.
function gauss(): number {
  return Math.random() + Math.random() + Math.random() - 1.5;
}

function candidateScore(
  input: ShotInput,
  terrain: Uint8Array,
  units: UnitState[],
  wind: number,
  shooter: UnitState,
  target: UnitState,
  selfHarmWeight: number,
): number {
  const result = simulateShot(input, terrain, units, wind, shooter.id);
  if (!result.explosionAt) return Number.MAX_SAFE_INTEGER;
  const dx = result.explosionAt.x - target.x;
  const dy = result.explosionAt.y - (target.y - BA_UNIT_H / 2);
  let score = dx * dx + dy * dy;
  // Self-damage is a bad plan; nudge the search away from it
  score += (result.damage[shooter.id] ?? 0) * selfHarmWeight;
  return score;
}

// Candidate-search AI: sample launch velocities, run the real sim, pick the closest
// landing, then blur the winner with difficulty-scaled aim error.
export function chooseAiShot(
  terrain: Uint8Array,
  units: UnitState[],
  shooter: UnitState,
  target: UnitState,
  wind: number,
  difficulty: BlastDifficulty,
): ShotInput {
  const origin = { x: shooter.x, y: shooter.y - BA_UNIT_H };
  const towardTarget = target.x >= shooter.x ? 1 : -1;

  if (
    Math.abs(target.x - shooter.x) <= BOOT_RANGE_X &&
    Math.abs(target.y - shooter.y) <= BOOT_RANGE_Y
  ) {
    const speed = BA_WEAPONS.boot.maxSpeed;
    return { weapon: 'boot', ...origin, vx: towardTarget * speed, vy: -speed * 0.3 };
  }

  const cfg = BA_DIFFICULTY_CONFIG[difficulty];
  let best: ShotInput | null = null;
  let bestScore = Number.MAX_SAFE_INTEGER;

  const tryCandidate = (input: ShotInput) => {
    const score = candidateScore(input, terrain, units, wind, shooter, target, cfg.selfHarmWeight);
    if (score < bestScore) {
      bestScore = score;
      best = input;
    }
  };

  for (let i = 0; i < cfg.bazookaCandidates; i++) {
    const vx = towardTarget * Math.random() * BA_MAX_LAUNCH_SPEED;
    const vy = -Math.random() * BA_MAX_LAUNCH_SPEED;
    tryCandidate({ weapon: 'bazooka', ...origin, vx, vy });
  }
  for (let i = 0; i < cfg.grenadeCandidates; i++) {
    const vx = towardTarget * Math.random() * BA_MAX_LAUNCH_SPEED * 0.8;
    const vy = -Math.random() * BA_MAX_LAUNCH_SPEED;
    tryCandidate({ weapon: 'grenade', ...origin, vx, vy });
  }

  const chosen = best ?? {
    weapon: 'bazooka' as const,
    ...origin,
    vx: towardTarget * BA_MAX_LAUNCH_SPEED * 0.6,
    vy: -BA_MAX_LAUNCH_SPEED * 0.6,
  };

  const err = cfg.aimError;
  return { ...chosen, vx: chosen.vx + gauss() * err, vy: chosen.vy + gauss() * err };
}
