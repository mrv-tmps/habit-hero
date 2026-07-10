-- Blast Arena map picker: rooms can pin a map; NULL = random (resolved from seed).

ALTER TABLE multiplayer_rooms
  ADD COLUMN map_id TEXT
  CONSTRAINT multiplayer_rooms_map_id_check
  CHECK (map_id IS NULL OR map_id IN ('grasslands', 'volcano', 'tundra', 'orbit'));

-- Extend the host config RPC with the map choice. Postgres overloads functions by
-- signature, so the old 9-arg version must be dropped explicitly.
DROP FUNCTION IF EXISTS update_room_config(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, INT, INT);

CREATE OR REPLACE FUNCTION update_room_config(
  p_room_id UUID,
  p_token UUID,
  p_game_type TEXT,
  p_difficulty TEXT,
  p_typing_mode TEXT,
  p_code_language TEXT,
  p_question_count INT,
  p_time_limit_seconds INT,
  p_max_players INT,
  p_map_id TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM multiplayer_participants
    WHERE room_id = p_room_id AND participant_token = p_token AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Only the host can change room settings';
  END IF;

  UPDATE multiplayer_rooms
  SET game_type = p_game_type,
      difficulty = p_difficulty,
      typing_mode = p_typing_mode,
      code_language = p_code_language,
      question_count = p_question_count,
      time_limit_seconds = p_time_limit_seconds,
      max_players = p_max_players,
      map_id = p_map_id
  WHERE id = p_room_id
    AND status = 'waiting';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
