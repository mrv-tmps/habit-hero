export type RoomStatus = 'waiting' | 'active' | 'finished';
export type GameType = 'math-buzzer' | 'typing-race';
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

export type MultiplayerEvent =
  | { type: 'game_start'; seed: number; start_at: string }
  | { type: 'player_ready'; nickname: string }
  | { type: 'game_begin' }
  | { type: 'answer_claimed'; question_idx: number; by_nickname: string }
  | { type: 'progress_update'; nickname: string; progress_pct: number; current_score: number; wpm?: number }
  | { type: 'player_finished'; nickname: string; final_score: number; wpm?: number }
  | { type: 'game_end'; rankings: RankedResult[] }
  | { type: 'question_advance'; question_idx: number; claimer_nickname: string };
