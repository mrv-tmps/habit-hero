import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Award, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMultiplayerRoom, getStoredToken } from '@/hooks/useMultiplayerRoom';
import { slotColor } from '@/components/multiplayer/playerColors';
import type { MultiplayerParticipant, RankedResult, MultiplayerRoom } from '@/types/multiplayer';
import { cn } from '@/lib/utils';

interface MultiplayerResultsProps {
  room: MultiplayerRoom;
  rankings: RankedResult[];
  participants: MultiplayerParticipant[];
  ownNickname: string;
  scoreUnit: 'points' | 'wpm' | 'dmg';
  title?: string;
}

function RankIcon({ position }: { position: number }) {
  if (position === 1) return <Trophy className="w-4 h-4 text-primary shrink-0" />;
  if (position === 2) return <Medal className="w-4 h-4 text-primary opacity-75 shrink-0" />;
  return <Award className="w-4 h-4 text-muted-foreground shrink-0" />;
}

export default function MultiplayerResults({
  room,
  rankings,
  participants,
  ownNickname,
  scoreUnit,
  title = 'Race Complete!',
}: MultiplayerResultsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resetRoomForRematch } = useMultiplayerRoom();
  const [isResetting, setIsResetting] = useState(false);

  const isHost = useMemo(
    () => participants.find(p => p.nickname === ownNickname)?.is_host ?? false,
    [participants, ownNickname],
  );

  // On rematch the host flips the room status back to 'waiting'. Every client
  // watches that DB change directly rather than a broadcast — a broadcast can be
  // dropped when the host navigates away mid-send, which stranded other players.
  useEffect(() => {
    const channel = supabase
      .channel(`room-rematch:${room.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'multiplayer_rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload: { new?: { status?: string } }) => {
          if (payload.new?.status === 'waiting') {
            navigate(`/games/room/${room.code}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, room.code, navigate]);

  async function handlePlayAgain() {
    const token = getStoredToken(room.code);
    if (!token) return;
    setIsResetting(true);
    try {
      const seed = Math.floor(Math.random() * 2 ** 31);
      await resetRoomForRematch(room.id, token, seed);
      // Host leaves immediately; other clients follow via the status change above.
      navigate(`/games/room/${room.code}`);
    } catch {
      setIsResetting(false);
    }
  }

  const hasAuthPlayer = rankings.some(r => r.user_id !== null);

  const nicknameToSlot = useMemo(() => {
    const m: Record<string, number> = {};
    participants.forEach((p, i) => { m[p.nickname] = i; });
    return m;
  }, [participants]);

  function scoreLabel(r: RankedResult): string {
    if (scoreUnit === 'wpm') return `${r.wpm ?? r.score} wpm`;
    if (scoreUnit === 'dmg') return `${r.score} dmg`;
    return `${r.score} ${r.score === 1 ? 'pt' : 'pts'}`;
  }

  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
        <h1 className="font-pixel text-xl text-xpGlow animate-titlePulse text-center">
          {title}
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
          {isHost ? (
            <Button
              className="flex-1 cursor-pointer"
              onClick={handlePlayAgain}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Restarting…
                </>
              ) : (
                'Play Again'
              )}
            </Button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm font-sans">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Waiting for host…
            </div>
          )}
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() => navigate('/games')}
          >
            Back to Games
          </Button>
        </div>

        <p className="text-muted-foreground text-xs text-center font-sans">
          {isHost
            ? 'Play again keeps everyone in this lobby.'
            : 'The host can restart to play again with the same players.'}
        </p>
      </div>
    </div>
  );
}
