-- Typing race config: word mode and, when mode = 'code', which language snippet to type
ALTER TABLE multiplayer_rooms ADD COLUMN IF NOT EXISTS typing_mode TEXT CHECK (typing_mode IN ('english', 'code'));
ALTER TABLE multiplayer_rooms ADD COLUMN IF NOT EXISTS code_language TEXT CHECK (code_language IN ('javascript', 'python', 'c'));
