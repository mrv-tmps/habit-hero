import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTitleForXp } from '@/lib/titles';
import { XP_PER_SESSION_CAP, DAILY_SESSION_CAP } from '@/config/constants';

export interface SessionResult {
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newTitleUnlocked: string | null;
}

interface UseGameSessionsResult {
  statMapping: string | null;
  todaySessionCount: number;
  canEarnXp: boolean;
  loading: boolean;
  saveSession: (wpm: number, accuracy: number) => Promise<SessionResult | null>;
  saveStatMapping: (statId: string) => Promise<void>;
}

// accuracy is 0-100 (percentage)
function computeXp(wpm: number, accuracy: number): number {
  return Math.min(Math.floor((wpm / 10) * (accuracy / 100)), XP_PER_SESSION_CAP);
}

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface UseGameSessionsOptions {
  customXpFormula?: (score: number, accuracy: number) => number;
}

export function useGameSessions(
  gameType: string,
  options: UseGameSessionsOptions = {},
): UseGameSessionsResult {
  const { user } = useAuth();
  const xpFormulaRef = useRef(options.customXpFormula ?? computeXp);
  xpFormulaRef.current = options.customXpFormula ?? computeXp;

  const [statMapping, setStatMapping] = useState<string | null>(null);
  const [todaySessionCount, setTodaySessionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const db = supabase as any;

      const [sessionsRes, mappingRes] = await Promise.all([
        db
          .from('game_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('game_type', gameType)
          .gte('completed_at', getTodayStart()),
        db
          .from('game_stat_mappings')
          .select('stat_id')
          .eq('user_id', user.id)
          .eq('game_type', gameType)
          .maybeSingle(),
      ]);

      setTodaySessionCount(sessionsRes.count ?? 0);
      setStatMapping(mappingRes.data?.stat_id ?? null);
    } catch (err) {
      console.error('useGameSessions load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, gameType]);

  useEffect(() => { load(); }, [load]);

  const saveStatMapping = useCallback(async (statId: string) => {
    if (!user) return;
    const db = supabase as any;

    await db.from('game_stat_mappings').upsert(
      { user_id: user.id, game_type: gameType, stat_id: statId },
      { onConflict: 'user_id,game_type' },
    );
    setStatMapping(statId);
  }, [user, gameType]);

  const saveSession = useCallback(async (
    wpm: number,
    accuracy: number,
  ): Promise<SessionResult | null> => {
    if (!user) return null;

    const canEarn = todaySessionCount < DAILY_SESSION_CAP;
    const xpEarned = canEarn && statMapping ? xpFormulaRef.current(wpm, accuracy) : 0;

    const db = supabase as any;

    // Insert session record
    await db.from('game_sessions').insert({
      user_id: user.id,
      game_type: gameType,
      score_wpm: wpm,
      accuracy,
      xp_earned: xpEarned,
      completed_at: new Date().toISOString(),
    });

    setTodaySessionCount(c => c + 1);

    if (xpEarned === 0 || !statMapping) {
      return { xpEarned: 0, leveledUp: false, newLevel: 0, newTitleUnlocked: null };
    }

    // Update stat points
    const { data: statRow } = await supabase
      .from('user_stats')
      .select('total_points')
      .eq('id', statMapping)
      .single();

    await supabase
      .from('user_stats')
      .update({ total_points: (statRow?.total_points ?? 0) + xpEarned })
      .eq('id', statMapping);

    // Update profile XP + title
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single();

    const oldXp = profileRow?.total_xp ?? 0;
    const newXp = oldXp + xpEarned;
    const oldTitle = getTitleForXp(oldXp).name;
    const newTitleTier = getTitleForXp(newXp);
    const titleChanged = newTitleTier.name !== oldTitle;

    const profileUpdate: Record<string, unknown> = { total_xp: newXp };
    if (titleChanged) {
      profileUpdate.current_title = newTitleTier.name;
      profileUpdate.current_title_unlocked_at = new Date().toISOString();
    }

    await supabase.from('profiles').update(profileUpdate).eq('id', user.id);

    const oldLevel = Math.floor(oldXp / 10) + 1;
    const newLevel = Math.floor(newXp / 10) + 1;

    return {
      xpEarned,
      leveledUp: newLevel > oldLevel,
      newLevel,
      newTitleUnlocked: titleChanged ? newTitleTier.name : null,
    };
  }, [user, gameType, statMapping, todaySessionCount]);

  return {
    statMapping,
    todaySessionCount,
    canEarnXp: todaySessionCount < DAILY_SESSION_CAP,
    loading,
    saveSession,
    saveStatMapping,
  };
}
