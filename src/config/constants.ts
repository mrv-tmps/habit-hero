export const XP_PER_SESSION_CAP = 10;
export const DAILY_SESSION_CAP = 3;
export const TYPING_TIMER_OPTIONS = [30, 60] as const;
export const TYPING_WORD_POOL_SIZE = 50;
export const MATH_TIMER_OPTIONS = [30, 60] as const;
export const TITLE_TIERS = 16;
export const MAX_LEADERBOARD_ENTRIES = 20;

export const MP_ROOM_CODE_LENGTH = 4;
export const MP_MAX_PLAYERS = 8;
export const MP_XP_MULTIPLIER_1ST = 1.5;
export const MP_XP_MULTIPLIER_2ND = 1.25;
export const MP_XP_MULTIPLIER_DEFAULT = 1.0;
export const MP_PROGRESS_BROADCAST_MS = 250;
export const MP_QUESTION_COUNT_OPTIONS = [10, 20, 30] as const;
export const MP_TIME_LIMIT_OPTIONS = [30, 60, 90] as const;
export const MP_MATH_DIFFICULTY = ['easy', 'medium', 'hard'] as const;
export const MP_TYPING_MODE = ['english', 'code'] as const;
export const MP_CODE_LANGUAGES = ['javascript', 'python', 'c'] as const;
export const MP_TYPING_WORD_COUNT = 60;
export const MP_RESULT_DISPLAY_MS = 8000;
// A readied client re-announces itself on this interval until the game begins,
// recovering from a dropped one-shot game_begin broadcast; capped to bound traffic.
export const MP_READY_RESYNC_MS = 1500;
export const MP_READY_RESYNC_MAX = 20;

// Blast Arena (turn-based artillery)
export const BA_CANVAS_W = 320;
export const BA_CANVAS_H = 180;
export const BA_SIM_STEP_HZ = 60;
export const BA_GRAVITY = 0.06;
// Stronger wind makes the wind-affected bazooka a skill shot instead of a default pick
export const BA_WIND_MAX = 0.018;
export const BA_TURN_TIME_MS = 30000;
export const BA_MAX_ROUNDS = 10;
export const BA_SUDDEN_DEATH_DRAIN = 10;
export const BA_UNIT_HP = 100;
export const BA_UNIT_W = 6;
export const BA_UNIT_H = 8;
export const BA_WALK_STAMINA_PX = 40;
export const BA_MAX_LAUNCH_SPEED = 3.4;
export const BA_COUNTDOWN_MS = 3000;
export const BA_AI_THINK_MS = 1000;
// Host waits this long past the turn deadline before skipping — absorbs in-flight shots
export const BA_SKIP_GRACE_MS = 2000;
// Force-apply a host resolution if local playback hasn't finished (throttled background tab)
export const BA_RESOLUTION_FORCE_MS = 5000;

export interface BlastWeaponConfig {
  label: string;
  damage: number;
  radius: number;
  windAffected: boolean;
  restitution: number;
  fuseSteps: number | null;
  carves: boolean;
  maxSpeed: number;
  explodeOnUnitContact: boolean;
}

// Niches: bazooka = versatile but wind-sensitive; grenade = highest damage, needs a lob;
// boot = close-range finisher whose damage-scaled knockback shoves units off ledges.
export const BA_WEAPONS = {
  bazooka: {
    label: 'Bazooka', damage: 30, radius: 12, windAffected: true,
    restitution: 0, fuseSteps: null, carves: true,
    maxSpeed: BA_MAX_LAUNCH_SPEED, explodeOnUnitContact: true,
  },
  grenade: {
    label: 'Grenade', damage: 45, radius: 14, windAffected: false,
    restitution: 0.5, fuseSteps: 180, carves: true,
    maxSpeed: BA_MAX_LAUNCH_SPEED, explodeOnUnitContact: false,
  },
  boot: {
    label: 'Boot', damage: 22, radius: 10, windAffected: false,
    restitution: 0, fuseSteps: 10, carves: false,
    maxSpeed: 1.6, explodeOnUnitContact: true,
  },
} as const satisfies Record<string, BlastWeaponConfig>;

export type BlastWeaponId = keyof typeof BA_WEAPONS;

// aimError perturbs the AI's chosen launch velocity (px/step); knockback scale is shared
export const BA_KNOCKBACK_SCALE = 0.28;
// candidates scale the AI's search budget (plan quality); grenadeShare is the fraction of
// candidates spent on grenade lobs; selfHarmWeight is how hard self-damage is penalized.
export const BA_DIFFICULTY_CONFIG = {
  easy: { aimError: 1.1, bazookaCandidates: 10, grenadeCandidates: 0, selfHarmWeight: 10 },
  medium: { aimError: 0.45, bazookaCandidates: 24, grenadeCandidates: 12, selfHarmWeight: 40 },
  hard: { aimError: 0.12, bazookaCandidates: 40, grenadeCandidates: 24, selfHarmWeight: 80 },
} as const;

export type BlastDifficulty = keyof typeof BA_DIFFICULTY_CONFIG;
