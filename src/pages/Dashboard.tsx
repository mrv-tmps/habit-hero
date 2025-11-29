import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { CharacterCard } from '@/components/CharacterCard';
import { DynamicStatCard } from '@/components/DynamicStatCard';
import { GuestBanner } from '@/components/GuestBanner';
import { MessageToast } from '@/components/MessageToast';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none" />

      <div className="relative max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="font-pixel text-lg text-primary text-glow">HABIT QUEST</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              📊
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
              ⚙️
            </Button>
          </div>
        </header>

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

        {/* Stats Grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Daily Quests
          </h3>
          <div className="grid gap-3">
            {stats.map((stat) => (
              <DynamicStatCard
                key={stat.id}
                stat={stat}
                canComplete={canComplete(stat.id)}
                onComplete={() => handleComplete(stat.id)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border text-center">
          {!isGuest && (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
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
