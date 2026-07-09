-- Rematch + in-lobby config editing.
-- Both RPCs are SECURITY DEFINER and authorize the caller by proving they hold the
-- host's participant_token, so anonymous hosts (host_user_id IS NULL) work the same
-- as signed-in hosts without loosening the table RLS policies.

-- Reset a finished room back to the lobby with a fresh seed, clearing every
-- participant's results so the same players can replay in place.
CREATE OR REPLACE FUNCTION reset_room_for_rematch(
  p_room_id UUID,
  p_token UUID,
  p_seed BIGINT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM multiplayer_participants
    WHERE room_id = p_room_id AND participant_token = p_token AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Only the host can restart the room';
  END IF;

  UPDATE multiplayer_rooms
  SET status = 'waiting', seed = p_seed
  WHERE id = p_room_id;

  UPDATE multiplayer_participants
  SET current_score = 0,
      progress_pct = 0,
      finished_at = NULL,
      xp_earned = 0,
      position = NULL
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Host-only edit of room settings while still in the lobby (status = 'waiting').
CREATE OR REPLACE FUNCTION update_room_config(
  p_room_id UUID,
  p_token UUID,
  p_game_type TEXT,
  p_difficulty TEXT,
  p_typing_mode TEXT,
  p_code_language TEXT,
  p_question_count INT,
  p_time_limit_seconds INT,
  p_max_players INT
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
      max_players = p_max_players
  WHERE id = p_room_id
    AND status = 'waiting';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
