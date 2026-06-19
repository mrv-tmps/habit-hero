import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GameSession {
  id: string;
  score_wpm: number;
  accuracy: number;
  xp_earned: number;
  completed_at: string;
}

export interface TypingHistoryData {
  sessions: GameSession[];
  bestWpm: number;
  bestAccuracy: number;
  totalXp: number;
  loading: boolean;
}

export function useTypingHistory(): TypingHistoryData {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const db = supabase as any;
    db
      .from('game_sessions')
      .select('id, score_wpm, accuracy, xp_earned, completed_at')
      .eq('user_id', user.id)
      .eq('game_type', 'typing')
      .order('completed_at', { ascending: false })
      .limit(100)
      .then(({ data }: { data: GameSession[] | null }) => {
        setSessions(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const bestWpm = sessions.length > 0 ? Math.max(...sessions.map(s => s.score_wpm)) : 0;
  const bestAccuracy = sessions.length > 0 ? Math.max(...sessions.map(s => s.accuracy)) : 0;
  const totalXp = sessions.reduce((sum, s) => sum + s.xp_earned, 0);

  return { sessions, bestWpm, bestAccuracy, totalXp, loading };
}
