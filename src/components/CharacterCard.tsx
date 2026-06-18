import { useState } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { cn } from '@/lib/utils';
import { getTitleForXp, TITLE_TIERS, getStarCountForTitle } from '@/lib/titles';
import { RanksModal } from '@/components/RanksModal';

interface CharacterCardProps {
  avatar: string;
  name?: string;
  level: number;
  isLevelingUp: boolean;
}

function getNextTitle(totalXp: number) {
  const currentIndex = TITLE_TIERS.findIndex(t => t.minXp === getTitleForXp(totalXp).minXp);
  if (currentIndex < 0 || currentIndex === TITLE_TIERS.length - 1) return null;
  return TITLE_TIERS[currentIndex + 1];
}

function isTitleRecentlyUnlocked(unlockedAt?: string | null) {
  if (!unlockedAt) return false;
  const unlockedMs = new Date(unlockedAt).getTime();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  return now - unlockedMs <= ONE_DAY;
}

export function CharacterCard({
  avatar,
  name,
  level,
  isLevelingUp
}: CharacterCardProps) {
  const [ranksOpen, setRanksOpen] = useState(false);
  const { profile } = useUserData();
  const totalXp = profile?.total_xp ?? 0;
  const titleText = profile?.current_title ?? getTitleForXp(totalXp).name;
  const starCount = getStarCountForTitle(titleText);
  const recentTitle = isTitleRecentlyUnlocked(profile?.current_title_unlocked_at);
  const nextTitle = getNextTitle(totalXp);
  const xpToNextTitle = nextTitle ? Math.max(0, nextTitle.minXp - totalXp) : 0;
  const currentTitleTier = getTitleForXp(totalXp);
  const rankProgressPct = nextTitle
    ? Math.min(100, Math.max(0, (totalXp - currentTitleTier.minXp) / (nextTitle.minXp - currentTitleTier.minXp) * 100))
    : 100;

  return (
    <>
    <div className="relative rounded-xl bg-card p-6 card-glow border border-border">
      {/* Level badge */}
      <div className="absolute -top-3 -right-3 bg-levelBadge px-3 py-1 rounded-full font-pixel text-xs text-foreground">
        LVL {level}
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            "text-7xl transition-transform duration-300",
            isLevelingUp && "animate-level-up"
          )}
        >
          {avatar}
        </div>

        <h2 className="font-pixel text-sm text-primary text-glow">
          {name || 'Hero'}
        </h2>

        <div className="mt-3 flex flex-col items-center gap-1">
          {/* Title pill */}
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-background/70 border-primary/40 shadow-[0_0_10px_rgba(250,204,21,0.25)]",
              recentTitle && "animate-titlePulse"
            )}
          >
            <span className="text-sm font-semibold text-primary">
              {titleText}
            </span>
            {/* Dynamic stars */}
            <div className="flex items-center gap-[2px]">
              {Array.from({ length: starCount }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "text-[11px]",
                    starCount >= 4 && i >= starCount - 2
                      ? "text-amber-300" // slightly brighter for top tiers
                      : "text-primary"
                  )}
                  aria-hidden="true"
                >
                  ★
                </span>
              ))}
            </div>
          </div>


        </div>

        {/* Rank Progress Bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <button
              onClick={() => setRanksOpen(true)}
              className="flex items-center gap-1 rounded-md bg-muted/60 border border-border/60 px-2 py-0.5 text-xs font-medium text-foreground active:scale-95 transition-transform"
            >
              Rank Progress
              <span className="text-[10px] text-muted-foreground">▶</span>
            </button>
            <span>
              {nextTitle
                ? `${xpToNextTitle.toLocaleString()} XP to ${nextTitle.name}`
                : 'Max rank reached!'}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 animate-pulse-glow"
              style={{ width: `${rankProgressPct}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Lv.{level} · Total XP: {totalXp.toLocaleString()}
          </p>
        </div>
      </div>
    </div>

    <RanksModal open={ranksOpen} onOpenChange={setRanksOpen} totalXp={totalXp} />
    </>
  );
}
