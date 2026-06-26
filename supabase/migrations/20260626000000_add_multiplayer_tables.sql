-- multiplayer_rooms
CREATE TABLE multiplayer_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL CHECK (game_type IN ('math-buzzer', 'typing-race')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  question_count INT,
  time_limit_seconds INT,
  max_players INT NOT NULL DEFAULT 8,
  seed BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- multiplayer_participants
CREATE TABLE multiplayer_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES multiplayer_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  progress_pct FLOAT DEFAULT 0,
  current_score INT DEFAULT 0,
  finished_at TIMESTAMPTZ,
  xp_earned INT DEFAULT 0,
  position INT,
  participant_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Postgres trigger: promote next participant to host when host row is deleted
CREATE OR REPLACE FUNCTION promote_next_host()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_host THEN
    UPDATE multiplayer_participants
    SET is_host = true
    WHERE id = (
      SELECT id FROM multiplayer_participants
      WHERE room_id = OLD.room_id
        AND id != OLD.id
        AND finished_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_participant_delete
AFTER DELETE ON multiplayer_participants
FOR EACH ROW EXECUTE FUNCTION promote_next_host();

-- RLS
ALTER TABLE multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE multiplayer_participants ENABLE ROW LEVEL SECURITY;

-- Rooms: anyone can read (for join-by-code lookup); authenticated users can insert
CREATE POLICY "rooms_select" ON multiplayer_rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON multiplayer_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR true);
CREATE POLICY "rooms_update_host" ON multiplayer_rooms FOR UPDATE USING (host_user_id = auth.uid() OR host_user_id IS NULL);

-- Participants: anyone can insert (guests use participant_token); anyone can read; update via RPC only
CREATE POLICY "participants_select" ON multiplayer_participants FOR SELECT USING (true);
CREATE POLICY "participants_insert" ON multiplayer_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participants_delete_own" ON multiplayer_participants FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- RPC for anonymous participant progress updates (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION update_participant_progress(
  p_token UUID,
  p_progress_pct FLOAT,
  p_current_score INT
) RETURNS VOID AS $$
  UPDATE multiplayer_participants
  SET progress_pct = p_progress_pct, current_score = p_current_score
  WHERE participant_token = p_token;
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable realtime postgres changes for lobby player list
ALTER TABLE multiplayer_rooms REPLICA IDENTITY FULL;
ALTER TABLE multiplayer_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE multiplayer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE multiplayer_participants;
