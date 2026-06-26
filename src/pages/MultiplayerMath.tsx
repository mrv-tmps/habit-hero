import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Award, MonitorSmartphone, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMultiplayerMath } from '@/hooks/useMultiplayerMath';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import type { MultiplayerRoom, MultiplayerParticipant, RankedResult } from '@/types/multiplayer';
import { MP_RESULT_DISPLAY_MS } from '@/config/constants';
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

function slotColor(idx: number) {
  return PLAYER_SLOT_COLORS[idx % PLAYER_SLOT_COLORS.length];
}

// ─── Results screen ───────────────────────────────────────────────────────────

interface ResultsProps {
  rankings: RankedResult[];
  participants: MultiplayerParticipant[];
  ownNickname: string;
}

function MultiplayerResults({ rankings, participants, ownNickname }: ResultsProps) {
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

  function RankIcon({ position }: { position: number }) {
    if (position === 1) return <Trophy className="w-4 h-4 text-primary shrink-0" />;
    if (position === 2) return <Medal className="w-4 h-4 text-primary opacity-75 shrink-0" />;
    return <Award className="w-4 h-4 text-muted-foreground shrink-0" />;
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
                  {r.score} {r.score === 1 ? 'pt' : 'pts'}
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
            onClick={() => navigate(`/games/room/new?game=math-buzzer`)}
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

// ─── Ready screen ─────────────────────────────────────────────────────────────

interface ReadyScreenProps {
  room: MultiplayerRoom;
  participants: MultiplayerParticipant[];
  readyNicknames: string[];
  ownNickname: string;
  onReady: () => void;
}

function ReadyScreen({ room, participants, readyNicknames, ownNickname, onReady }: ReadyScreenProps) {
  const [hasMarkedReady, setHasMarkedReady] = useState(false);
  const readySet = new Set(readyNicknames);
  const isLoading = participants.length === 0;

  function handleReady() {
    setHasMarkedReady(true);
    onReady();
  }

  const nicknameToSlot = useMemo(() => {
    const m: Record<string, number> = {};
    participants.forEach((p, i) => { m[p.nickname] = i; });
    return m;
  }, [participants]);

  return (
    <div data-mode="multiplayer" className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center flex flex-col gap-1">
        <p className="font-pixel text-sm text-primary tracking-widest">MATH BUZZER</p>
        <p className="font-mono text-xs text-muted-foreground">
          {room.code} · {room.difficulty ?? 'easy'} · {room.question_count ?? 10} questions
        </p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          participants.map(p => {
            const slotIdx = nicknameToSlot[p.nickname] ?? 0;
            const isReady = readySet.has(p.nickname);
            const isMe = p.nickname === ownNickname;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md border',
                  isMe ? 'bg-secondary border-border' : 'bg-card border-border',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', slotColor(slotIdx))} />
                <span className="font-sans text-sm flex-1 truncate">
                  {p.nickname}
                  {isMe && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
                  {p.is_host && <span className="text-muted-foreground text-xs ml-1">· host</span>}
                </span>
                {isReady ? (
                  <Check className="w-4 h-4 text-[hsl(var(--focused-text-correct))] shrink-0" />
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">…</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handleReady}
          disabled={hasMarkedReady || !ownNickname || isLoading}
          className="min-w-[160px] cursor-pointer"
        >
          {hasMarkedReady ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Waiting…
            </>
          ) : (
            "I'm Ready!"
          )}
        </Button>

        {!isLoading && (
          <p className="text-muted-foreground text-xs font-sans">
            {readyNicknames.length} / {participants.length} ready
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Buzzer overlay ───────────────────────────────────────────────────────────

const BUZZER_DISPLAY_MS = 1500;

interface BuzzerOverlayProps {
  nickname: string;
  question: string;
  answer: number;
  onDone: () => void;
}

function BuzzerOverlay({ nickname, question, answer, onDone }: BuzzerOverlayProps) {
  // Use a ref so the effect only runs once, regardless of prop identity changes
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), BUZZER_DISPLAY_MS);
    return () => clearTimeout(t);
  }, []); // intentionally empty — must only fire once per mount

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="animate-fade-in bg-card border-2 border-primary rounded-2xl px-10 py-8 text-center shadow-2xl flex flex-col gap-3 min-w-[280px]">
        <p className="font-pixel text-xs text-primary animate-pulse-glow tracking-widest">
          CORRECT!
        </p>
        <p className="font-sans text-2xl font-bold text-foreground leading-tight">
          {nickname}
        </p>
        <p className="font-sans text-sm text-muted-foreground">
          buzzed in first
        </p>
        <div className="mt-2 pt-3 border-t border-border flex flex-col gap-1">
          <p className="font-mono text-xs text-muted-foreground">{question}</p>
          <p className="font-mono text-2xl font-bold text-[hsl(var(--focused-text-correct))]">
            = {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Countdown overlay ────────────────────────────────────────────────────────

function CountdownOverlay({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [count, setCount] = useState(3);

  useEffect(() => {
    const t1 = setTimeout(() => setCount(2), 900);
    const t2 = setTimeout(() => setCount(1), 1800);
    const t3 = setTimeout(() => onDoneRef.current(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // intentionally empty

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm">
      <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
        Next question in
      </p>
      <p className="font-pixel text-8xl text-primary animate-pulse-glow leading-none">
        {count}
      </p>
    </div>
  );
}

// ─── Active game ──────────────────────────────────────────────────────────────

export default function MultiplayerMath({ room }: { room: MultiplayerRoom }) {
  const isMobile = useIsMobile();

  const {
    phase,
    questions,
    currentQuestionIdx,
    myScore,
    playerScores,
    timeRemaining,
    submitAnswer,
    rankings,
    ownNickname,
    participants,
    claimerFlash,
    readyNicknames,
    markReady,
  } = useMultiplayerMath(room);

  const [inputValue, setInputValue] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [waitingForAdvance, setWaitingForAdvance] = useState(false);
  const [mobileDismissed, setMobileDismissed] = useState(false);
  const [activeBuzzer, setActiveBuzzer] = useState<{ nickname: string; questionIdx: number } | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Capture claimerFlash into local overlay state
  useEffect(() => {
    if (!claimerFlash) return;
    setActiveBuzzer(claimerFlash);
    setWaitingForAdvance(true);
  }, [claimerFlash]);

  // Reset input when question changes
  useEffect(() => {
    setInputValue('');
    setCorrectFlash(false);
  }, [currentQuestionIdx]);

  // Buzzer done → start countdown (waitingForAdvance stays true)
  const dismissBuzzer = useCallback(() => {
    setActiveBuzzer(null);
    setCountdownActive(true);
  }, []);

  // Countdown done → restore input
  const dismissCountdown = useCallback(() => {
    setCountdownActive(false);
    setWaitingForAdvance(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const nicknameToSlot = useMemo(() => {
    const m: Record<string, number> = {};
    participants.forEach((p, i) => { m[p.nickname] = i; });
    return m;
  }, [participants]);

  function handleSubmit() {
    if (waitingForAdvance || !inputValue.trim()) return;
    const num = parseInt(inputValue.trim(), 10);
    if (isNaN(num)) {
      setShakeKey(k => k + 1);
      setInputValue('');
      return;
    }

    const correct = submitAnswer(num);
    if (correct) {
      setCorrectFlash(true);
      setWaitingForAdvance(true);
      setTimeout(() => setCorrectFlash(false), 150);
    } else {
      setShakeKey(k => k + 1);
      setInputValue('');
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  // ── Ready phase ──────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <ReadyScreen
        room={room}
        participants={participants}
        readyNicknames={readyNicknames}
        ownNickname={ownNickname}
        onReady={markReady}
      />
    );
  }

  // ── Done phase ───────────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <MultiplayerResults
        rankings={rankings}
        participants={participants}
        ownNickname={ownNickname}
      />
    );
  }

  // ── Active phase ─────────────────────────────────────────────────────────────

  const currentQuestion = questions[currentQuestionIdx];
  const total = questions.length;
  const isTimeLimitMode = room.time_limit_seconds !== null;
  const isTimerPulsing = isTimeLimitMode && timeRemaining !== null && timeRemaining <= 10;

  const scoreboardEntries = Object.entries(playerScores).sort(([, a], [, b]) => b - a);
  const leaderScore = scoreboardEntries[0]?.[1] ?? 0;

  const buzzerQuestion = activeBuzzer ? questions[activeBuzzer.questionIdx] : null;

  return (
    <div data-mode="multiplayer" className="min-h-screen flex flex-col">
      {/* Buzzer overlay */}
      {activeBuzzer && buzzerQuestion && (
        <BuzzerOverlay
          nickname={activeBuzzer.nickname}
          question={buzzerQuestion.question}
          answer={buzzerQuestion.answer}
          onDone={dismissBuzzer}
        />
      )}

      {/* Countdown overlay — shown after buzzer dismisses */}
      {countdownActive && (
        <CountdownOverlay onDone={dismissCountdown} />
      )}

      {/* Mobile warning */}
      {isMobile && !mobileDismissed && (
        <div className="z-20 flex items-center gap-2 px-4 py-2 bg-card border-b border-border text-sm font-sans text-muted-foreground">
          <MonitorSmartphone className="w-4 h-4 shrink-0" />
          <span className="flex-1">Multiplayer games work best on a larger screen.</span>
          <button
            onClick={() => setMobileDismissed(true)}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{room.code}</span>
        <span className="font-mono text-sm text-foreground">
          Q {currentQuestionIdx + 1} / {total}
        </span>
        {isTimeLimitMode && timeRemaining !== null && (
          <span
            className={cn(
              'font-mono text-sm text-primary',
              isTimerPulsing && 'animate-pulse-glow',
            )}
          >
            {timeRemaining}s
          </span>
        )}
        {!isTimeLimitMode && (
          <span className="font-mono text-xs text-muted-foreground">
            {myScore} pts
          </span>
        )}
      </div>

      {/* Main question area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        {currentQuestion ? (
          <>
            <p
              className={cn(
                'font-mono text-3xl font-bold text-center transition-colors duration-150',
                correctFlash
                  ? 'text-[hsl(var(--focused-text-correct))]'
                  : 'text-foreground',
              )}
            >
              {currentQuestion.question} = ?
            </p>

            <div
              key={shakeKey}
              className={cn(shakeKey > 0 && 'animate-char-error')}
            >
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={waitingForAdvance}
                placeholder="?"
                className={cn(
                  'font-mono text-2xl text-center max-w-[200px] w-full',
                  'bg-input border border-border rounded-md px-4 py-2',
                  'focus:outline-none focus:ring-1 focus:ring-ring',
                  'disabled:opacity-50',
                  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                )}
                autoFocus
              />
            </div>

            <p className="text-muted-foreground text-xs font-sans">
              Press Enter to submit
            </p>
          </>
        ) : (
          <p className="text-muted-foreground font-sans text-sm">Loading…</p>
        )}
      </div>

      {/* Scoreboard strip */}
      <div className="z-10 bg-card border-t border-border px-4 py-2">
        <div className="flex gap-3 overflow-x-auto">
          {scoreboardEntries.length === 0 ? (
            <div className="h-10" />
          ) : (
            scoreboardEntries.map(([nickname, score]) => {
              const slotIdx = nicknameToSlot[nickname] ?? 0;
              const isLeader = score > 0 && score === leaderScore;
              const isMe = nickname === ownNickname;

              return (
                <div
                  key={nickname}
                  className={cn(
                    'bg-secondary rounded-md px-3 py-2 flex items-center gap-2 shrink-0',
                    isLeader && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', slotColor(slotIdx))} />
                  <span className="font-sans text-sm text-foreground">
                    {nickname.length > 8 ? nickname.slice(0, 8) + '…' : nickname}
                    {isMe && <span className="text-muted-foreground text-xs ml-1">*</span>}
                  </span>
                  <span className="font-pixel text-xs text-primary">{score}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
