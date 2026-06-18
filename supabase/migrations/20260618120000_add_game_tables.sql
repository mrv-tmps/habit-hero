-- Game sessions: one row per completed minigame session
CREATE TABLE public.game_sessions (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  score_wpm INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Game stat mappings: which stat earns XP for each game (one row per user per game)
CREATE TABLE public.game_stat_mappings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  stat_id UUID NOT NULL REFERENCES public.user_stats(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, game_type)
);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_stat_mappings ENABLE ROW LEVEL SECURITY;

-- game_sessions policies
CREATE POLICY "Users can view own game sessions"
  ON public.game_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game sessions"
  ON public.game_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- game_stat_mappings policies
CREATE POLICY "Users can view own game stat mappings"
  ON public.game_stat_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game stat mappings"
  ON public.game_stat_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game stat mappings"
  ON public.game_stat_mappings FOR UPDATE
  USING (auth.uid() = user_id);
