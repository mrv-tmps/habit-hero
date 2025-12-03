import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { CharacterCard } from '@/components/CharacterCard';
import { DynamicStatCard } from '@/components/DynamicStatCard';
import { GuestBanner } from '@/components/GuestBanner';
import { MessageToast } from '@/components/MessageToast';
import { Button } from '@/components/ui/button';
import { LeaderboardModal } from '@/components/LeaderboardModal';
import { DashboardHeader } from '@/components/DashboardHeader';

const Dashboard = () => {
  const { user, isGuest, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    profile,
    stats,
    loading,
    completeStat,
    canComplete,
    level,
    xpProgress,
    xpToNextLevel,
  } = useUserData();
  const [message, setMessage] = useState<string | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!loading && profile && !profile.onboarding_completed) {
      navigate('/onboarding');
    }
  }, [loading, profile, navigate]);

  const handleComplete = async (statId: string) => {
    const result = await completeStat(statId);

    if (!result.success) {
      setMessage(`⏰ ${result.message}`);
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (result.leveledUp) {
      setIsLevelingUp(true);
      setTimeout(() => setIsLevelingUp(false), 500);
      setMessage(`🎉 LEVEL UP! Now level ${result.newLevel}!`);
    } else {
      setMessage('+1 XP!');
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse font-pixel">Loading...</div>
      </div>
    );
  }

  // If no profile or stats, redirect to onboarding
  if (!profile || stats.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No character found</p>
          <Button onClick={() => navigate('/onboarding')}>Create Character</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none -z-10" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 lg:py-12 space-y-8">
        {/* Header */}
        <DashboardHeader onOpenLeaderboard={() => setLeaderboardOpen(true)} />

        <main className="grid gap-6 lg:grid-cols-[360px,minmax(0,1fr)] lg:items-start lg:gap-8 lg:min-h-[calc(100vh-12rem)]">
          <section className="flex flex-col gap-6 lg:sticky lg:top-12">
            {/* Guest Banner */}
            {isGuest && <GuestBanner />}

            {/* Character Card */}
            <CharacterCard
              avatar={profile.avatar}
              name={profile.character_name}
              level={level}
              xpProgress={xpProgress}
              xpToNextLevel={xpToNextLevel}
              totalPoints={profile.total_xp}
              isLevelingUp={isLevelingUp}
            />
          </section>

          {/* Stats Grid */}
          <section className="flex flex-col gap-4 lg:self-stretch">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Daily Quests
              </h3>
              <span className="text-xs text-muted-foreground">
                {stats.length} quest{stats.length !== 1 ? 's' : ''} tracked
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <DynamicStatCard
                  key={stat.id}
                  stat={stat}
                  canComplete={canComplete(stat.id)}
                  onComplete={() => handleComplete(stat.id)}
                />
              ))}
            </div>
          </section>
        </main>

        <LeaderboardModal
          open={leaderboardOpen}
          onOpenChange={setLeaderboardOpen}
        />

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-center lg:justify-end">
          {!isGuest && (
            <Button variant="ghost" size="sm" onClick={handleLogout} className="sm:hidden">
              Logout
            </Button>
          )}
        </div>
      </div>

      <MessageToast message={message} />
    </div>
  );
};

export default Dashboard;
