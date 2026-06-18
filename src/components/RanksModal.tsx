import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TITLE_TIERS, getStarCountForTitle } from '@/lib/titles';

interface RanksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalXp: number;
}

export function RanksModal({ open, onOpenChange, totalXp }: RanksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-pixel text-lg text-primary text-glow">
            All Ranks
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Earn XP by completing daily quests to advance your rank.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {TITLE_TIERS.map((tier, index) => {
            const isCurrent = totalXp >= tier.minXp &&
              (index === TITLE_TIERS.length - 1 || totalXp < TITLE_TIERS[index + 1].minXp);
            const isUnlocked = totalXp >= tier.minXp;
            const starCount = getStarCountForTitle(tier.name);

            return (
              <div
                key={tier.name}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-2.5',
                  isCurrent
                    ? 'bg-primary/10 border-primary/60 shadow-[0_0_16px_rgba(250,204,21,0.25)]'
                    : isUnlocked
                      ? 'bg-background/70 border-border/70'
                      : 'bg-background/30 border-border/30 opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <div className="w-5 text-center text-sm shrink-0">
                    {isCurrent ? '→' : isUnlocked ? '✓' : ''}
                  </div>

                  <div>
                    <p className={cn(
                      'text-sm font-semibold',
                      isCurrent ? 'text-primary' : isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {tier.name}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] font-normal text-primary/70 uppercase tracking-wide">
                          current
                        </span>
                      )}
                    </p>
                    {/* Stars */}
                    <div className="flex items-center gap-[2px] mt-0.5">
                      {Array.from({ length: starCount }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            'text-[10px]',
                            isCurrent || isUnlocked
                              ? starCount >= 4 && i >= starCount - 2 ? 'text-amber-300' : 'text-primary'
                              : 'text-muted-foreground/40'
                          )}
                          aria-hidden="true"
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={cn(
                    'text-xs',
                    isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}>
                    {tier.minXp === 0 ? 'Starting rank' : `${tier.minXp.toLocaleString()} XP`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
