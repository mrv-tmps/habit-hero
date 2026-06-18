import { useHabitTracker } from '@/hooks/useHabitTracker';
import { CharacterCard } from '@/components/CharacterCard';
import { StatCard } from '@/components/StatCard';
import { GitHubSetup } from '@/components/GitHubSetup';
import { MessageToast } from '@/components/MessageToast';
import { ResetButton } from '@/components/ResetButton';
import logo from '@/assets/habit-quest-logo.png';

const Index = () => {
  const {
    data,
    message,
    isLevelingUp,
    canComplete,
    completeStat,
    resetProgress,
    githubConfig,
    saveGitHubConfig,
    clearGitHubConfig,
  } = useHabitTracker();

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none" />

      <div className="relative max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src={logo}
              alt="Habit Quest logo"
              className="h-16 w-auto mx-auto drop-shadow"
            />
          </div>
          <div className="space-y-1">
            <h1 className="font-pixel text-lg text-primary text-glow">
              HABIT QUEST
            </h1>
            <p className="text-sm text-muted-foreground">
              Level up your life, one habit at a time
            </p>
          </div>
        </header>

        {/* Character Card */}
        <CharacterCard
          avatar={data.avatar}
          level={data.level}
          isLevelingUp={isLevelingUp}
        />

        {/* Stats Grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Daily Quests
          </h3>
          <div className="grid gap-3">
            <StatCard
              type="strength"
              value={data.stats.strength}
              canComplete={canComplete('strength')}
              onComplete={() => completeStat('strength')}
            />
            <StatCard
              type="intelligence"
              value={data.stats.intelligence}
              canComplete={canComplete('intelligence')}
              onComplete={() => completeStat('intelligence')}
            />
            <StatCard
              type="endurance"
              value={data.stats.endurance}
              canComplete={canComplete('endurance')}
              onComplete={() => completeStat('endurance')}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <ResetButton onReset={resetProgress} />
          <GitHubSetup
            isConnected={!!githubConfig}
            onSave={saveGitHubConfig}
            onDisconnect={clearGitHubConfig}
          />
        </div>
      </div>

      {/* Message Toast */}
      <MessageToast message={message} />
    </div>
  );
};

export default Index;
