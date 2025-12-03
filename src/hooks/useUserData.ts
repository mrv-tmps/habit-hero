import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getTitleForXp } from '@/lib/titles';

export interface UserStat {
  id: string;
  stat_name: string;
  emoji: string;
  color: string;
  habit_description: string | null;
  order_index: number;
  total_points: number;
}

export interface UserProfile {
  character_name: string;
  avatar: string;
  total_xp: number;
  onboarding_completed: boolean;
  github_token: string | null;
  github_owner: string | null;
  github_repo: string | null;
  last_github_commit_date: string | null;
  current_title: string | null;
  current_title_unlocked_at: string | null;
}

interface HabitLog {
  stat_id: string;
  completed_date: string;
  stat_name_snapshot: string | null;
  habit_description_snapshot: string | null;
}



export function useUserData() {
  const { user, isGuest } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStat[]>([]);
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Load guest data from localStorage
  const loadGuestData = useCallback(() => {
    const stored = localStorage.getItem('habit-quest-guest-data');
    if (stored) {
      const data = JSON.parse(stored);
      setProfile({
        character_name: data.characterName || 'Hero',
        avatar: data.avatar || '🧑‍🚀',
        total_xp: data.totalXp || 0,
        onboarding_completed: data.onboardingCompleted || false,
        github_token: null,
        github_owner: null,
        github_repo: null,
        last_github_commit_date: null,
        current_title: null,
        current_title_unlocked_at: null,
      });
      setStats(data.stats || []);

      const logs = data.habitLogs || [];
      setAllLogs(logs);
      setTodayLogs(logs.filter((l: HabitLog) => l.completed_date === getTodayDate()));
    }
    setLoading(false);
  }, []);

  // Load user data from database
  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;


      // inside loadUserData, after profileData is fetched:

      if (profileData) {
        const computedTitle = getTitleForXp(profileData.total_xp || 0).name;
        const needsTitleSync =
          !profileData.current_title || profileData.current_title !== computedTitle;

        if (needsTitleSync) {
          await supabase
            .from('profiles')
            .update({
              current_title: computedTitle,
              current_title_unlocked_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }

        setProfile({
          character_name: profileData.character_name || 'Hero',
          avatar: profileData.avatar || '🧑‍🚀',
          total_xp: profileData.total_xp || 0,
          onboarding_completed: profileData.onboarding_completed || false,
          github_token: profileData.github_token,
          github_owner: profileData.github_owner,
          github_repo: profileData.github_repo,
          last_github_commit_date: profileData.last_github_commit_date,
          current_title: needsTitleSync
            ? computedTitle
            : profileData.current_title || computedTitle,
          current_title_unlocked_at:
            profileData.current_title_unlocked_at || new Date().toISOString(),
        });
      }


      // Fetch stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index');

      if (statsError) throw statsError;
      setStats(statsData || []);

      // Fetch all habit logs
      const { data: logsData, error: logsError } = await supabase
        .from('habit_log')
        .select('stat_id, completed_date, stat_name_snapshot, habit_description_snapshot')
        .eq('user_id', user.id);



      if (logsError) throw logsError;

      const logs = logsData || [];
      setAllLogs(logs);
      setTodayLogs(logs.filter(l => l.completed_date === getTodayDate()));
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isGuest) {
      loadGuestData();
    } else if (user) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, [user, isGuest, loadGuestData, loadUserData]);

  const completeStat = useCallback(async (statId: string) => {
    const today = getTodayDate();

    // Check if already completed today
    if (todayLogs.some(l => l.stat_id === statId)) {
      return { success: false, message: 'Already completed today!' };
    }

    if (isGuest) {
      // Handle guest mode
      const stored = localStorage.getItem('habit-quest-guest-data');
      if (!stored) return { success: false, message: 'No data found' };

      const data = JSON.parse(stored);
      const guestStat = data.stats.find((s: UserStat) => s.id === statId);

      const newLog: HabitLog = {
        stat_id: statId,
        completed_date: today,
        stat_name_snapshot: guestStat?.stat_name ?? null,
        habit_description_snapshot: guestStat?.habit_description ?? null,
      };


      data.habitLogs = [...(data.habitLogs || []), newLog];
      data.totalXp = (data.totalXp || 0) + 1;

      // Update stat points
      data.stats = data.stats.map((s: UserStat) =>
        s.id === statId ? { ...s, total_points: s.total_points + 1 } : s
      );

      localStorage.setItem('habit-quest-guest-data', JSON.stringify(data));

      setTodayLogs(prev => [...prev, newLog]);
      setAllLogs(prev => [...prev, newLog]);
      setStats(data.stats);
      setProfile(prev => prev ? { ...prev, total_xp: data.totalXp } : null);

      const newLevel = Math.floor(data.totalXp / 10) + 1;
      const oldLevel = Math.floor((data.totalXp - 1) / 10) + 1;

      return {
        success: true,
        leveledUp: newLevel > oldLevel,
        newLevel,
        newTitleUnlocked: null,
      };
    }

    if (!user) return { success: false, message: 'Not logged in' };

    try {
      // Find the stat we’re logging, so we can snapshot it
      const statToSnapshot = stats.find(s => s.id === statId);

      const { error: logError } = await supabase
        .from('habit_log')
        .insert({
          user_id: user.id,
          stat_id: statId,
          completed_date: today,
          stat_name_snapshot: statToSnapshot?.stat_name ?? null,
          habit_description_snapshot: statToSnapshot?.habit_description ?? null,
        });


      if (logError) throw logError;

      // Update stat total points
      const stat = stats.find(s => s.id === statId);
      if (stat) {
        await supabase
          .from('user_stats')
          .update({ total_points: stat.total_points + 1 })
          .eq('id', statId);
      }

      const oldXp = profile?.total_xp || 0;
      const newXp = oldXp + 1;

      const oldTitleName = getTitleForXp(oldXp).name;
      const newTitleTier = getTitleForXp(newXp);
      const newTitleName = newTitleTier.name;
      const titleChanged = newTitleName !== oldTitleName;
      const nowIso = new Date().toISOString();

      // Update profile total XP + title in DB
      const profileUpdate: Record<string, unknown> = { total_xp: newXp };
      if (titleChanged) {
        profileUpdate.current_title = newTitleName;
        profileUpdate.current_title_unlocked_at = nowIso;
      }

      await supabase.from('profiles').update(profileUpdate).eq('id', user.id);

      // Update local state
      const newLog: HabitLog = {
        stat_id: statId,
        completed_date: today,
        stat_name_snapshot: stat?.stat_name ?? null,
        habit_description_snapshot: stat?.habit_description ?? null,
      };

      setTodayLogs(prev => [...prev, newLog]);
      setAllLogs(prev => [...prev, newLog]);

      setStats(prev =>
        prev.map(s =>
          s.id === statId ? { ...s, total_points: s.total_points + 1 } : s
        )
      );

      setProfile(prev =>
        prev
          ? {
            ...prev,
            total_xp: newXp,
            current_title: titleChanged ? newTitleName : (prev.current_title || newTitleName),
            current_title_unlocked_at: titleChanged
              ? nowIso
              : prev.current_title_unlocked_at,
          }
          : null
      );

      const newLevel = Math.floor(newXp / 10) + 1;
      const oldLevel = Math.floor((newXp - 1) / 10) + 1;

      return {
        success: true,
        leveledUp: newLevel > oldLevel,
        newLevel,
        newTitleUnlocked: titleChanged ? newTitleName : null,   // NEW
      };

    } catch (error: unknown) {
      console.error('Failed to complete stat:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    }
  }, [user, isGuest, todayLogs, stats, profile]);

  const canComplete = useCallback((statId: string): boolean => {
    return !todayLogs.some(l => l.stat_id === statId);
  }, [todayLogs]);

  const level = Math.floor((profile?.total_xp || 0) / 10) + 1;
  const xpProgress = ((profile?.total_xp || 0) % 10) / 10 * 100;
  const xpToNextLevel = 10 - ((profile?.total_xp || 0) % 10);

  return {
    profile,
    stats,
    todayLogs,
    allLogs,
    loading,
    completeStat,
    canComplete,
    level,
    xpProgress,
    xpToNextLevel,
    refetch: isGuest ? loadGuestData : loadUserData,
  };
}
