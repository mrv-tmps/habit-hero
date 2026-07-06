import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { slotColor } from '@/components/multiplayer/playerColors';
import type { MultiplayerParticipant, RankedResult } from '@/types/multiplayer';
import { MP_RESULT_DISPLAY_MS } from '@/config/constants';
import { cn } from '@/lib/utils';

interface MultiplayerResultsProps {
  rankings: RankedResult[];
  participants: MultiplayerParticipant[];
  ownNickname: string;
  scoreUnit: 'points' | 'wpm';
  playAgainGameId: string;
}

function RankIcon({ position }: { position: number }) {
  if (position === 1) return <Trophy className="w-4 h-4 text-primary shrink-0" />;
  if (position === 2) return <Medal className="w-4 h-4 text-primary opacity-75 shrink-0" />;
  return <Award className="w-4 h-4 text-muted-foreground shrink-0" />;
}

export default function MultiplayerResults({
  rankings,
  participants,
  ownNickname,
  scoreUnit,
  playAgainGameId,
}: MultiplayerResultsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(Math.ceil(MP_RESULT_DISPLAY_MS / 1000));

  useEffect(() => {
    const timer = setTimeout(() => navigate('/games'), MP_RESULT_DISPLAY_MS);
    const interval = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [navigate]);

  const hasAuthPlayer = rankings.some(r => r.user_id !== null);

  const nicknameToSlot = useMemo(() => {
    const m: Record<string, number> = {};
    participants.forEach((p, i) => { m[p.nickname] = i; });
    return m;
  }, [participants]);

  function scoreLabel(r: RankedResult): string {
    if (scoreUnit === 'wpm') return `${r.wpm ?? r.score} wpm`;
    return `${r.score} ${r.score === 1 ? 'pt' : 'pts'}`;
  }

  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
        <h1 className="font-pixel text-xl text-xpGlow animate-titlePulse text-center">
          Race Complete!
        </h1>

        <div className="flex flex-col gap-1">
          {rankings.map(r => {
            const isMe = r.nickname === ownNickname;
            const slotIdx = nicknameToSlot[r.nickname] ?? 0;

            return (
              <div
                key={r.nickname}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2',
                  isMe ? 'bg-secondary/60' : '',
                )}
              >
                <RankIcon position={r.position} />
                <span className={cn('w-2 h-2 rounded-full shrink-0', slotColor(slotIdx))} />
                <span className="font-sans text-sm text-foreground flex-1 truncate">
                  {r.nickname}
                  {isMe && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
                </span>
                <span className="font-mono text-sm text-foreground shrink-0">
                  {scoreLabel(r)}
                </span>
                {hasAuthPlayer && (
                  <span className="font-mono text-xs text-muted-foreground shrink-0 w-20 text-right">
                    {r.user_id && r.xp_earned > 0 ? (
                      <>
                        +{r.xp_earned} XP
                        {r.position <= 2 && (
                          <span className="text-muted-foreground text-xs ml-1">
                            {r.position === 1 ? '(×1.5)' : '(×1.25)'}
                          </span>
                        )}
                      </>
                    ) : r.user_id ? (
                      <span className="text-muted-foreground">+0 XP</span>
                    ) : (
                      '—'
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!user && (
          <p className="text-muted-foreground text-xs text-center font-sans">
            Sign in to earn XP for your wins.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 cursor-pointer"
            onClick={() => navigate(`/games/room/new?game=${playAgainGameId}`)}
          >
            Play Again
          </Button>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() => navigate('/games')}
          >
            Back to Games
          </Button>
        </div>

        <p className="text-muted-foreground text-xs text-center font-sans">
          Returning to games in {countdown}s…
        </p>
      </div>
    </div>
  );
}
