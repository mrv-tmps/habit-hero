import { cn } from '@/lib/utils';

interface CharacterCardProps {
  avatar: string;
  name?: string;
  level: number;
  xpProgress: number;
  xpToNextLevel: number;
  totalPoints: number;
  isLevelingUp: boolean;
}

export function CharacterCard({ 
  avatar,
  name,
  level, 
  xpProgress, 
  xpToNextLevel, 
  totalPoints,
  isLevelingUp 
}: CharacterCardProps) {
  return (
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

        {/* XP Bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>XP</span>
            <span>{xpToNextLevel} to next level</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500 animate-pulse-glow"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Total Points: {totalPoints}
          </p>
        </div>
      </div>
    </div>
  );
}
