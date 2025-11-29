import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { UserStat } from '@/hooks/useUserData';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setConfirmOpen(false);
    onComplete();
  };

  const handleTriggerClick = () => {
    if (!canComplete) return;
    setConfirmOpen(true);
  };

  return (
    <div
      className={cn(
        "rounded-lg bg-card border border-border p-4 transition-all duration-300",
        colors.glow
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-2xl shrink-0">{stat.emoji}</span>
          <div className="min-w-0">
            <span className={cn("font-semibold block leading-tight break-words", colors.text)}>
              {stat.stat_name}
            </span>
            {stat.habit_description && (
              <span className="text-xs text-muted-foreground break-words leading-snug pt-2">
                {stat.habit_description}
              </span>
            )}
          </div>
        </div>
        <span className={cn("font-pixel text-lg shrink-0 text-right", colors.text)}>
          {stat.total_points}
        </span>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <button
            onClick={handleTriggerClick}
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
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log {stat.stat_name} today?</AlertDialogTitle>
            <AlertDialogDescription>
              This will record today's completion for {stat.stat_name} and update your stats instantly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Yes, I completed it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
