import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useAuth } from '@/contexts/AuthContext';

interface LeaderboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaderboardModal({ open, onOpenChange }: LeaderboardModalProps) {
  const { user, isGuest } = useAuth();
  const { entries, loading, error, refetch } = useLeaderboard(20);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const isCurrentUser = (id: string) => user?.id === id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <DialogTitle className="font-pixel text-lg text-primary text-glow">
              Global Leaderboard
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Ranked by total XP from daily quests.
            </p>
          </div>
          <button
            onClick={refetch}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ⟳ Refresh
          </button>
        </DialogHeader>

        {isGuest && (
          <div className="mt-4 rounded-lg border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
            Sign in to see how you rank against other adventurers.
          </div>
        )}

        {!isGuest && (
          <div className="mt-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading leaderboard...
              </div>
            ) : error ? (
              <div className="py-10 text-center text-sm text-destructive">
                {error}
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No players on the leaderboard yet. Be the first!
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {entries.map((entry, index) => {
                  const rank = index + 1;
                  const icon = getRankIcon(rank);
                  const highlight = isCurrentUser(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm',
                        highlight
                          ? 'bg-primary/10 border-primary/60 shadow-[0_0_16px_rgba(250,204,21,0.30)]'
                          : 'bg-background/70 border-border/70'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 text-center">
                          {icon ? (
                            <span className="text-lg" aria-hidden="true">
                              {icon}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              #{rank}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{entry.avatar}</span>
                          <div>
                            <p
                              className={cn(
                                'font-medium',
                                highlight ? 'text-primary' : 'text-foreground'
                              )}
                            >
                              {entry.character_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {entry.current_title}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">XP</p>
                        <p className="text-sm font-semibold text-primary">
                          {entry.total_xp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
