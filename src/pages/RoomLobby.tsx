import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useMultiplayerRoom, getStoredToken } from '@/hooks/useMultiplayerRoom';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { useAuth } from '@/contexts/AuthContext';
import type { MultiplayerRoom, MultiplayerParticipant } from '@/types/multiplayer';
import { cn } from '@/lib/utils';

const PLAYER_SLOT_COLORS = [
  'bg-[hsl(var(--player-1))]',
  'bg-[hsl(var(--player-2))]',
  'bg-[hsl(var(--player-3))]',
  'bg-[hsl(var(--player-4))]',
  'bg-[hsl(var(--player-5))]',
  'bg-[hsl(var(--player-6))]',
  'bg-[hsl(var(--player-7))]',
  'bg-[hsl(var(--player-8))]',
];

function slotColor(index: number): string {
  return PLAYER_SLOT_COLORS[index % PLAYER_SLOT_COLORS.length];
}

export default function RoomLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchRoom, fetchParticipants, joinRoom, leaveRoom, startGame } = useMultiplayerRoom();
  const { broadcast, onEvent, presenceList, trackPresence } = useRealtimeRoom(code ?? null);

  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [ownParticipant, setOwnParticipant] = useState<MultiplayerParticipant | null>(null);
  const [showNicknameOverlay, setShowNicknameOverlay] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const presenceTracked = useRef(false);

  const loadRoomAndParticipant = useCallback(async () => {
    if (!code) return;

    const r = await fetchRoom(code);
    if (!r) {
      setLoadError('Room not found.');
      return;
    }
    setRoom(r);

    const parts = await fetchParticipants(r.id);
    setParticipants(parts);

    const token = getStoredToken(code);
    if (token) {
      const own = parts.find(p => p.participant_token === token) ?? null;
      if (own) {
        setOwnParticipant(own);
      } else {
        setShowNicknameOverlay(true);
      }
    } else {
      setShowNicknameOverlay(true);
    }
  }, [code, fetchRoom, fetchParticipants]);

  useEffect(() => {
    loadRoomAndParticipant();
  }, [loadRoomAndParticipant]);

  // Track own presence once participant is known
  useEffect(() => {
    if (ownParticipant && !presenceTracked.current) {
      trackPresence({
        nickname: ownParticipant.nickname,
        user_id: ownParticipant.user_id,
        is_host: ownParticipant.is_host,
      });
      presenceTracked.current = true;
    }
  }, [ownParticipant, trackPresence]);

  // Subscribe to postgres changes on participants table
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`participants:${room.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_participants',
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          const parts = await fetchParticipants(room.id);
          setParticipants(parts);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, fetchParticipants]);

  // Listen for game_start broadcast
  useEffect(() => {
    const unsub = onEvent(event => {
      if (event.type === 'game_start' && code) {
        navigate(`/games/room/${code}/play`);
      }
    });
    return unsub;
  }, [onEvent, navigate, code]);

  async function handleJoin() {
    if (!code || !nicknameInput.trim()) {
      setNicknameError('Nickname is required');
      return;
    }
    if (nicknameInput.trim().length > 16) {
      setNicknameError('Max 16 characters');
      return;
    }
    if (!room) return;

    const taken = participants.some(
      p => p.nickname.toLowerCase() === nicknameInput.trim().toLowerCase(),
    );
    if (taken) {
      setNicknameError('This nickname is already taken in this room');
      return;
    }

    setIsJoining(true);
    setNicknameError('');
    try {
      const { room: updatedRoom } = await joinRoom(code, nicknameInput.trim(), user?.id ?? null);
      setRoom(updatedRoom);

      const token = getStoredToken(code);
      if (token) {
        const parts = await fetchParticipants(updatedRoom.id);
        setParticipants(parts);
        const own = parts.find(p => p.participant_token === token) ?? null;
        setOwnParticipant(own);
      }

      setShowNicknameOverlay(false);
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  }

  async function handleLeave() {
    if (!ownParticipant) return;
    await leaveRoom(ownParticipant.id);
    navigate('/games');
  }

  async function handleStartGame() {
    if (!room || !ownParticipant?.is_host) return;
    setIsStarting(true);
    try {
      const seed = Math.floor(Math.random() * 2 ** 31);
      await startGame(room.id);
      broadcast({ type: 'game_start', seed, start_at: new Date().toISOString() });
      navigate(`/games/room/${code}/play`);
    } catch {
      setIsStarting(false);
    }
  }

  function handleCopyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canStart = participants.length >= 2;

  const displayPlayers = participants.length > 0 ? participants : [];
  const emptySlots = room ? Math.max(0, room.max_players - displayPlayers.length) : 0;

  if (loadError) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <p className="text-muted-foreground font-sans">{loadError}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg p-4 md:p-8">
      {/* Nickname entry overlay */}
      {showNicknameOverlay && (
        <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold font-sans">Enter a nickname to join</h2>
            <div className="flex flex-col gap-1">
              <Label className="text-sm font-sans">Nickname</Label>
              <Input
                value={nicknameInput}
                onChange={e => {
                  setNicknameInput(e.target.value);
                  setNicknameError('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="YourName"
                maxLength={16}
                className="font-mono text-base"
                autoFocus
              />
              {nicknameError && (
                <p className="text-destructive text-xs mt-1">{nicknameError}</p>
              )}
            </div>
            <Button
              onClick={handleJoin}
              disabled={!nicknameInput.trim() || isJoining}
              className="w-full cursor-pointer"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Joining…
                </>
              ) : (
                'Join Room'
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <h1 className="font-pixel text-primary text-glow text-sm mb-6">LOBBY</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: Player list */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold font-sans">Players</h2>

            <div className="flex flex-col gap-2">
              {displayPlayers.map((p, idx) => {
                const isMe = p.id === ownParticipant?.id;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 bg-secondary/40 animate-fade-in"
                  >
                    <span className={cn('w-3 h-3 rounded-full shrink-0', slotColor(idx))} />
                    <span className="font-sans text-sm text-foreground flex-1">{p.nickname}</span>
                    {p.is_host && (
                      <Badge variant="secondary" className="text-xs font-sans">
                        Host
                      </Badge>
                    )}
                    {isMe && (
                      <span className="text-muted-foreground text-xs">(you)</span>
                    )}
                  </div>
                );
              })}

              {Array.from({ length: emptySlots }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="h-10 rounded-md border border-dashed border-border"
                />
              ))}
            </div>
          </div>

          {/* Right: Room info + controls */}
          <div className="flex flex-col gap-4">
            {/* Room code block */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">
                Room Code
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-bold text-primary tracking-widest">
                  {code}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyCode}
                  aria-label="Copy room code"
                  className="cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Game summary */}
            <div className="rounded-lg bg-secondary p-3 flex flex-col gap-1">
              <p className="text-sm font-sans text-muted-foreground capitalize">
                <span className="text-foreground font-medium">Game: </span>
                {room.game_type === 'math-buzzer' ? 'Math Buzzer' : 'Typing Race'}
              </p>
              {room.difficulty && (
                <p className="text-sm font-sans text-muted-foreground capitalize">
                  <span className="text-foreground font-medium">Difficulty: </span>
                  {room.difficulty}
                </p>
              )}
              {room.question_count && (
                <p className="text-sm font-sans text-muted-foreground">
                  <span className="text-foreground font-medium">Questions: </span>
                  {room.question_count}
                </p>
              )}
              {room.time_limit_seconds && (
                <p className="text-sm font-sans text-muted-foreground">
                  <span className="text-foreground font-medium">Time limit: </span>
                  {room.time_limit_seconds}s
                </p>
              )}
              <p className="text-sm font-sans text-muted-foreground">
                <span className="text-foreground font-medium">Max players: </span>
                {room.max_players}
              </p>
            </div>

            {/* Controls */}
            {ownParticipant?.is_host ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      className="w-full cursor-pointer"
                      disabled={!canStart || isStarting}
                      onClick={handleStartGame}
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Starting…
                        </>
                      ) : (
                        'Start Game'
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canStart && (
                  <TooltipContent>Need at least 2 players</TooltipContent>
                )}
              </Tooltip>
            ) : ownParticipant ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-sans">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Waiting for host to start…
              </div>
            ) : null}

            {ownParticipant && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeave}
                className="text-destructive hover:text-destructive mt-4 cursor-pointer"
              >
                Leave Room
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
