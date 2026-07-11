import type { TurnResolution } from '@/lib/blastSim';

export type RoomStatus = 'waiting' | 'active' | 'finished';
export type GameType = 'math-buzzer' | 'typing-race' | 'blast-arena';
export type MathDifficulty = 'easy' | 'medium' | 'hard';
export type TypingMode = 'english' | 'code';
export type CodeLanguage = 'javascript' | 'python' | 'c';

export interface MultiplayerRoom {
  id: string;
  code: string;
  game_type: GameType;
  difficulty: MathDifficulty | null;
  host_user_id: string | null;
  status: RoomStatus;
  question_count: number | null;
  time_limit_seconds: number | null;
  max_players: number;
  seed: number;
  typing_mode: TypingMode | null;
  code_language: CodeLanguage | null;
  // Blast Arena map (blastMaps registry id); NULL = random, resolved from seed
  map_id: string | null;
  created_at: string;
}

export interface MultiplayerParticipant {
  id: string;
  room_id: string;
  user_id: string | null;
  nickname: string;
  is_host: boolean;
  progress_pct: number;
  current_score: number;
  finished_at: string | null;
  xp_earned: number;
  position: number | null;
  participant_token: string;
  created_at: string;
}

export interface RankedResult {
  nickname: string;
  user_id: string | null;
  score: number;
  wpm?: number;
  position: number;
  xp_earned: number;
}

// Blast Arena: the payload carries velocities (vx/vy), not angles — trig is resolved
// on the shooter's client so every client's deterministic replay is bit-identical.
export interface BlastShotEvent {
  type: 'shot_fired';
  turn_index: number;
  weapon: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type MultiplayerEvent =
  | { type: 'game_start'; seed: number; start_at: string }
  | { type: 'player_ready'; nickname: string }
  | { type: 'game_begin' }
  | { type: 'answer_claimed'; question_idx: number; by_nickname: string }
  | { type: 'progress_update'; nickname: string; progress_pct: number; current_score: number; wpm?: number }
  | { type: 'player_finished'; nickname: string; final_score: number; wpm?: number }
  | { type: 'game_end'; rankings: RankedResult[] }
  | { type: 'question_advance'; question_idx: number; claimer_nickname: string }
  | { type: 'room_updated' }
  | BlastShotEvent
  | { type: 'turn_resolved'; resolution: TurnResolution }
  // Post-fire reposition: the shooter reports its final spot (and hp — falls and
  // hazard hits during the window are local-only) so the host can fold it into
  // the authoritative turn_resolved.
  | { type: 'move_done'; turn_index: number; x: number; y: number; hp: number }
  | { type: 'crate_picked'; crate_id: string; turn_index: number; by_id: string };
