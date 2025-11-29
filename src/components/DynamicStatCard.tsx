import { cn } from '@/lib/utils';
import type { UserStat } from '@/hooks/useUserData';

interface DynamicStatCardProps {
  stat: UserStat;
  canComplete: boolean;
  onComplete: () => void;
}

const colorClasses: Record<string, { text: string; glow: string; button: string }> = {
  strength: {
    text: 'text-strength',
    glow: 'stat-glow-strength',
    button: 'bg-strength/20 hover:bg-strength/30 border-strength/50',
  },
  intelligence: {
    text: 'text-intelligence',
    glow: 'stat-glow-intelligence',
    button: 'bg-intelligence/20 hover:bg-intelligence/30 border-intelligence/50',
  },
  endurance: {
    text: 'text-endurance',
    glow: 'stat-glow-endurance',
    button: 'bg-endurance/20 hover:bg-endurance/30 border-endurance/50',
  },
  primary: {
    text: 'text-primary',
    glow: 'card-glow',
    button: 'bg-primary/20 hover:bg-primary/30 border-primary/50',
  },
};

export function DynamicStatCard({ stat, canComplete, onComplete }: DynamicStatCardProps) {
  const colors = colorClasses[stat.color] || colorClasses.primary;

  return (
    <div className={cn(
      "rounded-lg bg-card border border-border p-4 transition-all duration-300",
      colors.glow
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{stat.emoji}</span>
          <div>
            <span className={cn("font-semibold block", colors.text)}>{stat.stat_name}</span>
            {stat.habit_description && (
              <span className="text-xs text-muted-foreground">{stat.habit_description}</span>
            )}
          </div>
        </div>
        <span className={cn("font-pixel text-lg", colors.text)}>{stat.total_points}</span>
      </div>

      <button
        onClick={onComplete}
        disabled={!canComplete}
        className={cn(
          "w-full py-2 px-4 rounded-md border font-medium transition-all duration-200",
          canComplete 
            ? cn(colors.button, "cursor-pointer active:scale-95") 
            : "bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
        )}
      >
        {canComplete ? 'Complete Today' : '✓ Done Today'}
      </button>
    </div>
  );
}
