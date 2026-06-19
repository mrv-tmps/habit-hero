import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Zap, Hash, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTypingHistory, type GameSession } from '@/hooks/useTypingHistory';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

function StatCard({
  icon: Icon,
  label,
  value,
  primary,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  primary?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-mono">{label}</span>
      </div>
      <p className={cn(
        'text-2xl font-bold font-mono tabular-nums',
        primary ? 'text-primary' : 'text-foreground',
      )}>
        {value}
      </p>
    </div>
  );
}

function SessionRow({ session, isBestWpm }: { session: GameSession; isBestWpm: boolean }) {
  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-secondary/40 transition-colors">
      <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
        {formatSessionDate(session.completed_at)}
      </td>
      <td className={cn(
        'py-3 px-4 text-right font-mono font-semibold tabular-nums',
        isBestWpm ? 'text-primary' : 'text-foreground',
      )}>
        {session.score_wpm}
        {isBestWpm && <span className="ml-1 text-[10px] text-primary/60 font-normal">pb</span>}
      </td>
      <td className="py-3 px-4 text-right font-mono tabular-nums text-foreground">
        {session.accuracy}%
      </td>
      <td className={cn(
        'py-3 px-4 text-right font-mono tabular-nums',
        session.xp_earned > 0 ? 'text-primary' : 'text-muted-foreground',
      )}>
        +{session.xp_earned}
      </td>
    </tr>
  );
}

export default function TypingHistory() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const { sessions, bestWpm, bestAccuracy, totalXp, loading } = useTypingHistory();

  return (
    <div className="min-h-screen page-bg p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/games/typing')}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            aria-label="Back to Typing Test"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Typing Test</span>
          </Button>
          <div>
            <h1 className="font-pixel text-primary text-glow text-sm leading-none">
              TYPING HISTORY
            </h1>
            <p className="text-muted-foreground text-xs mt-1">
              Personal bests and session log
            </p>
          </div>
        </div>

        {/* Personal bests */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Trophy} label="Best WPM" value={bestWpm} primary />
          <StatCard icon={Target} label="Best Acc" value={`${bestAccuracy}%`} />
          <StatCard icon={Hash} label="Sessions" value={sessions.length} />
          <StatCard icon={Zap} label="Total XP" value={`+${totalXp}`} primary />
        </div>

        {/* Session log */}
        {loading ? (
          <div className="text-muted-foreground text-sm font-mono animate-pulse px-1">
            loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/50 p-10 flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-sm">No sessions recorded yet.</p>
            <Button size="sm" onClick={() => navigate('/games/typing')}>
              Play your first game
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-muted-foreground text-xs font-mono">
                  <th className="text-left py-3 px-4 font-normal">date</th>
                  <th className="text-right py-3 px-4 font-normal">wpm</th>
                  <th className="text-right py-3 px-4 font-normal">acc</th>
                  <th className="text-right py-3 px-4 font-normal">xp</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isBestWpm={s.score_wpm === bestWpm && bestWpm > 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Guest sign-in prompt */}
        {isGuest && (
          <div className="mt-6 rounded-xl border border-border bg-card/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              <button
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
                onClick={() => navigate('/auth')}
              >
                Sign in
              </button>{' '}
              to save your sessions and track progress over time.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
