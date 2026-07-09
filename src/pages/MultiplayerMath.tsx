import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MonitorSmartphone, X, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMultiplayerMath } from '@/hooks/useMultiplayerMath';
import { useIsMobile } from '@/hooks/use-mobile';
import ReadyScreen from '@/components/multiplayer/ReadyScreen';
import MultiplayerResults from '@/components/multiplayer/MultiplayerResults';
import CountdownOverlay from '@/components/multiplayer/CountdownOverlay';
import { slotColor } from '@/components/multiplayer/playerColors';
import type { MultiplayerRoom } from '@/types/multiplayer';
import { cn } from '@/lib/utils';

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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/85 backdrop-blur-md">
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

// ─── Mobile numeric keypad ────────────────────────────────────────────────────
// Renders an in-app keypad so input is identical across Android and iOS. iOS
// Safari never opens the native keyboard from a programmatic focus and its
// numeric keypad has no Enter key, which made the buzzer race unfair on iPhones.

interface NumericKeypadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onToggleSign: () => void;
  onSubmit: () => void;
  disabled: boolean;
}

function NumericKeypad({ onDigit, onBackspace, onToggleSign, onSubmit, disabled }: NumericKeypadProps) {
  const keyCls =
    'h-14 rounded-md bg-secondary text-foreground font-mono text-2xl flex items-center justify-center ' +
    'select-none touch-manipulation cursor-pointer active:bg-secondary/60 disabled:opacity-40';

  return (
    <div className="w-full max-w-[280px] flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} type="button" disabled={disabled} onClick={() => onDigit(d)} className={keyCls}>
            {d}
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={onToggleSign} className={keyCls} aria-label="Toggle negative sign">
          ±
        </button>
        <button type="button" disabled={disabled} onClick={() => onDigit('0')} className={keyCls}>
          0
        </button>
        <button type="button" disabled={disabled} onClick={onBackspace} className={keyCls} aria-label="Backspace">
          <Delete className="w-6 h-6" />
        </button>
      </div>
      <Button size="lg" onClick={onSubmit} disabled={disabled} className="h-14 text-lg cursor-pointer">
        Submit
      </Button>
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

  // Mobile keypad handlers — drive the same inputValue used by handleSubmit.
  function handleDigit(d: string) {
    if (waitingForAdvance) return;
    setInputValue(v => (v.replace('-', '').length >= 6 ? v : v + d));
  }
  function handleBackspace() {
    if (waitingForAdvance) return;
    setInputValue(v => v.slice(0, -1));
  }
  function handleToggleSign() {
    if (waitingForAdvance) return;
    setInputValue(v => (v.startsWith('-') ? v.slice(1) : '-' + v));
  }

  // ── Ready phase ──────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <ReadyScreen
        title="MATH BUZZER"
        subtitle={`${room.code} · ${room.difficulty ?? 'easy'} · ${room.question_count ?? 10} questions`}
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
        room={room}
        rankings={rankings}
        participants={participants}
        ownNickname={ownNickname}
        scoreUnit="points"
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
        <CountdownOverlay label="Next question in" onDone={dismissCountdown} />
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
        {!currentQuestion ? (
          <p className="text-muted-foreground font-sans text-sm">Loading…</p>
        ) : waitingForAdvance ? (
          // Hide the live question while the buzzer/countdown overlays are up —
          // currentQuestionIdx has already advanced, so rendering it here would
          // leak the next problem through the blur.
          <p className="text-muted-foreground font-sans text-sm">Get ready…</p>
        ) : (
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

            {isMobile ? (
              <>
                <div
                  key={shakeKey}
                  className={cn(
                    'font-mono text-2xl text-center w-full max-w-[200px] min-h-[3rem]',
                    'bg-input border rounded-md px-4 py-2 flex items-center justify-center',
                    correctFlash
                      ? 'border-[hsl(var(--focused-text-correct))]'
                      : 'border-border',
                    shakeKey > 0 && 'animate-char-error',
                  )}
                >
                  {inputValue || <span className="text-muted-foreground">?</span>}
                </div>

                <NumericKeypad
                  onDigit={handleDigit}
                  onBackspace={handleBackspace}
                  onToggleSign={handleToggleSign}
                  onSubmit={handleSubmit}
                  disabled={waitingForAdvance}
                />
              </>
            ) : (
              <>
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
            )}
          </>
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
