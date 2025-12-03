import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LeaderboardEntry {
  id: string;
  character_name: string;
  avatar: string;
  total_xp: number;
  current_title: string;
}

interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLeaderboard(limit = 20): UseLeaderboardResult {
  const { user, isGuest } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    if (!user || isGuest) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_leaderboard', {
        limit_count: limit,
        offset_count: 0,
      });

      if (error) throw error;

      setEntries(
        (data || []).map((row: any) => ({
          id: row.id,
          character_name: row.character_name,
          avatar: row.avatar,
          total_xp: row.total_xp ?? 0,
          current_title: row.current_title ?? 'New Traveler',
        }))
      );
    } catch (err: any) {
      console.error('Failed to load leaderboard:', err);
      setError(err.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isGuest]);

  return {
    entries,
    loading,
    error,
    refetch: fetchLeaderboard,
  };
}
