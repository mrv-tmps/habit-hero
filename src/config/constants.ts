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
export const MP_RESULT_DISPLAY_MS = 8000;

// ── Coin Rush ──────────────────────────────────────────────────────────────
export const CR_ROUND_OPTIONS = [60, 90, 120] as const;
export const CR_DEFAULT_ROUND = 90;
export const CR_DIFFICULTY = ['easy', 'medium', 'hard'] as const;
export type CRDifficulty = (typeof CR_DIFFICULTY)[number];
export const CR_POSITION_BROADCAST_MS = 100;
export const CR_COIN_VALUE = 1;
export const CR_GEM_VALUE = 5;
export const CR_STUN_MS = 2000;
export const CR_INVULN_MS = 1000;
export const CR_GEM_LIFETIME_MS = 6000;

export interface CRDifficultyConfig {
  size: number;           // virtual arena side length (square, in logical units)
  coinPopulation: number;
  sawCount: number;
  sawSpeed: number;       // logical units / second
  gemIntervalMs: number;
  avatarSpeed: number;    // logical units / second
  avatarRadius: number;   // logical units
  coinRadius: number;
  gemRadius: number;
  sawRadius: number;
}

export const CR_DIFFICULTY_CONFIG: Record<CRDifficulty, CRDifficultyConfig> = {
  easy: {
    size: 800,
    coinPopulation: 15,
    sawCount: 2,
    sawSpeed: 100,
    gemIntervalMs: 12000,
    avatarSpeed: 200,
    avatarRadius: 22,
    coinRadius: 12,
    gemRadius: 18,
    sawRadius: 30,
  },
  medium: {
    size: 1000,
    coinPopulation: 12,
    sawCount: 3,
    sawSpeed: 140,
    gemIntervalMs: 10000,
    avatarSpeed: 220,
    avatarRadius: 22,
    coinRadius: 12,
    gemRadius: 18,
    sawRadius: 30,
  },
  hard: {
    size: 1200,
    coinPopulation: 9,
    sawCount: 4,
    sawSpeed: 180,
    gemIntervalMs: 8000,
    avatarSpeed: 240,
    avatarRadius: 22,
    coinRadius: 12,
    gemRadius: 18,
    sawRadius: 30,
  },
} as const;
