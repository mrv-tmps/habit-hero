import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useGameSessions } from '@/hooks/useGameSessions';
import { MATH_TIMER_OPTIONS, XP_PER_SESSION_CAP } from '@/config/constants';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'active' | 'done';
type TimerMode = typeof MATH_TIMER_OPTIONS[number];

interface MathProblem {
  question: string;
  answer: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(): MathProblem {
  const opIdx = randInt(0, 3);

  switch (opIdx) {
    case 0: {
      const a = randInt(10, 99);
      const b = randInt(10, 99);
      return { question: `${a} + ${b}`, answer: a + b };
    }
    case 1: {
      const a = randInt(20, 99);
      const b = randInt(1, Math.min(a - 1, 30));
      return { question: `${a} − ${b}`, answer: a - b };
    }
    case 2: {
      const a = randInt(2, 12);
      const b = randInt(2, 12);
      return { question: `${a} × ${b}`, answer: a * b };
    }
    default: {
      const divisor = randInt(2, 12);
      const quotient = randInt(2, 12);
      return { question: `${divisor * quotient} ÷ ${divisor}`, answer: quotient };
    }
  }
}

// XP formula: 20 correct @ 100% acc = 10 XP cap; scales linearly below that.
// accuracy is 0-100 (percentage).
function mathXp(score: number, accuracy: number): number {
  return Math.min(Math.floor((score / 2) * (accuracy / 100)), XP_PER_SESSION_CAP);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MathChallenge() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { stats: userStats, loading: statsLoading } = useUserData();
  const {
    statMapping,
    todaySessionCount,
    canEarnXp,
    loading: sessionsLoading,
    saveSession,
    saveStatMapping,
  } = useGameSessions('math', { customXpFormula: mathXp });

  // ── Game state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<TimerMode>(30);
  const [phase, setPhase] = useState<Phase>('idle');
  const [problem, setProblem] = useState<MathProblem>(generateProblem);
  const [inputValue, setInputValue] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(null);

  // Track counts in refs so the done effect always sees the final values.
  const correctRef = useRef(0);
  const totalRef = useRef(0);
  const [correctCount, setCorrectCountState] = useState(0);
  const [totalCount, setTotalCountState] = useState(0);

  // ── Result state ────────────────────────────────────────────────────────────
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionAccuracy, setSessionAccuracy] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newTitle, setNewTitle] = useState<string | null>(null);

  // ── Stat picker ─────────────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedStatId, setSelectedStatId] = useState('');

  // ── Refs ────────────────────────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mobile detection ────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 768px)').matches);
  }, []);

  // ── Auto-open stat picker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionsLoading && !statsLoading && !isGuest && statMapping === null && userStats.length > 0) {
      setPickerOpen(true);
      setSelectedStatId(userStats[0].id);
    }
  }, [sessionsLoading, statsLoading, isGuest, statMapping, userStats]);

  // ── Sync timeLeft when mode changes while idle ──────────────────────────────
  useEffect(() => {
    if (phase === 'idle') setTimeLeft(mode);
  }, [mode, phase]);

  // ── Focus input ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done') inputRef.current?.focus();
  }, [phase]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setPhase('done');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);
  useEffect(() => () => { if (feedbackRef.current) clearTimeout(feedbackRef.current); }, []);

  // ── Save session when done ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done') return;

    const finalScore = correctRef.current;
    const finalAccuracy =
      totalRef.current > 0 ? Math.round((correctRef.current / totalRef.current) * 100) : 0;

    setSessionScore(finalScore);
    setSessionAccuracy(finalAccuracy);

    if (!user || isGuest) {
      setSessionXp(0);
      return;
    }

    setSessionSaving(true);
    saveSession(finalScore, finalAccuracy).then(result => {
      if (result) {
        setSessionXp(result.xpEarned);
        setLeveledUp(result.leveledUp);
        setNewTitle(result.newTitleUnlocked);
      }
      setSessionSaving(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback((newMode?: TimerMode) => {
    stopTimer();
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
    const m = newMode ?? mode;
    setPhase('idle');
    setProblem(generateProblem());
    setInputValue('');
    correctRef.current = 0;
    totalRef.current = 0;
    setCorrectCountState(0);
    setTotalCountState(0);
    setTimeLeft(m);
    setLastResult(null);
    setSessionScore(0);
    setSessionAccuracy(0);
    setSessionXp(0);
    setLeveledUp(false);
    setNewTitle(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [stopTimer, mode]);

  const changeMode = (m: TimerMode) => {
    setMode(m);
    reset(m);
  };

  // ── Submit answer ───────────────────────────────────────────────────────────
  const submitAnswer = useCallback(() => {
    if (!inputValue.trim()) return;
    const userAnswer = parseInt(inputValue, 10);
    if (isNaN(userAnswer)) {
      setInputValue('');
      return;
    }

    const isCorrect = userAnswer === problem.answer;

    if (phase === 'idle') {
      setPhase('active');
      startTimer();
    }

    totalRef.current += 1;
    if (isCorrect) correctRef.current += 1;
    setTotalCountState(totalRef.current);
    setCorrectCountState(correctRef.current);

    setLastResult(isCorrect ? 'correct' : 'incorrect');
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
    feedbackRef.current = setTimeout(() => setLastResult(null), 400);

    setProblem(generateProblem());
    setInputValue('');
  }, [inputValue, problem.answer, phase, startTimer]);

  // ── Key handler ─────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase === 'done') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  };

  // ── Stat picker submit ───────────────────────────────────────────────────────
  const handlePickerSave = async () => {
    if (!selectedStatId) return;
    await saveStatMapping(selectedStatId);
    setPickerOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const mappedStatName = userStats.find(s => s.id === statMapping)?.stat_name ?? null;
  const xpSessionsLeft = Math.max(0, 3 - todaySessionCount);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen page-bg flex flex-col select-none"
      onClick={() => { if (phase !== 'done') inputRef.current?.focus(); }}
    >
      {/* Stat picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link a stat to this game</DialogTitle>
            <DialogDescription>
              Choose which stat earns XP from the Math Challenge. This is set once and saved permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <Select value={selectedStatId} onValueChange={setSelectedStatId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a stat…" />
              </SelectTrigger>
              <SelectContent>
                {userStats.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.emoji} {s.stat_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                Skip for now
              </Button>
              <Button size="sm" disabled={!selectedStatId} onClick={handlePickerSave}>
                Save &amp; Play
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex flex-col items-center px-4 sm:px-8 pt-10 sm:pt-14 pb-8">
        <div className="w-full max-w-[680px] flex flex-col gap-3">

          {/* Back nav */}
          <button
            onClick={() => navigate('/games')}
            onMouseDown={e => e.preventDefault()}
            className="self-start flex items-center gap-1.5 text-sm font-mono text-focused-dim hover:text-focused-correct transition-colors cursor-pointer"
            aria-label="Back to games"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            games
          </button>

          {/* Main card */}
          <div data-mode="focused" className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">

            {/* Controls bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-1">
                {MATH_TIMER_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => changeMode(opt as TimerMode)}
                    onMouseDown={e => e.preventDefault()}
                    className={cn(
                      'font-mono text-sm px-3 py-1 rounded-md transition-colors cursor-pointer',
                      mode === opt
                        ? 'text-focused-caret bg-white/[0.08]'
                        : 'text-focused-dim hover:text-focused-correct',
                    )}
                    aria-label={`${opt} second mode`}
                    aria-pressed={mode === opt}
                  >
                    {opt}s
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4">
                {phase === 'active' && (
                  <span className="font-mono text-sm text-focused-dim tabular-nums">
                    {correctCount} <span className="text-xs opacity-60">correct</span>
                  </span>
                )}
                <span
                  className={cn(
                    'font-mono text-2xl font-bold tabular-nums w-10 text-right',
                    phase === 'active' && timeLeft <= 10
                      ? 'text-focused-incorrect'
                      : 'text-focused-caret',
                  )}
                >
                  {timeLeft}
                </span>
                <button
                  onClick={() => reset()}
                  onMouseDown={e => e.preventDefault()}
                  className="text-focused-dim hover:text-focused-correct transition-colors cursor-pointer"
                  aria-label="Restart challenge"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            {phase !== 'done' ? (
              <div className="px-5 sm:px-7 pt-6 pb-8 flex flex-col items-center gap-8">

                {/* Stat / session info */}
                {!!user && (
                  <div className="w-full flex items-center justify-between text-xs text-focused-dim font-mono">
                    <span>
                      {statMapping
                        ? <>stat <span className="text-focused-correct">{mappedStatName}</span></>
                        : (
                          <button
                            className="underline underline-offset-2 hover:text-focused-correct transition-colors cursor-pointer"
                            onMouseDown={e => e.preventDefault()}
                            onClick={e => { e.stopPropagation(); setPickerOpen(true); }}
                          >
                            link a stat to earn XP
                          </button>
                        )
                      }
                    </span>
                    <span>
                      {canEarnXp
                        ? (xpSessionsLeft > 0 ? `${xpSessionsLeft} xp session${xpSessionsLeft !== 1 ? 's' : ''} left` : '')
                        : <span className="opacity-50">free play · no xp</span>
                      }
                    </span>
                  </div>
                )}

                {/* Problem display */}
                <div className="text-center">
                  <span className="font-mono text-5xl font-bold text-focused-correct tracking-wide">
                    {problem.question}
                  </span>
                  <span className="font-mono text-5xl font-bold text-focused-dim ml-3">=</span>
                </div>

                {/* Answer input */}
                <div className="flex flex-col items-center gap-2 w-full max-w-[180px]">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={inputValue}
                    onChange={e => {
                      if (phase === 'done') return;
                      setInputValue(e.target.value.replace(/[^0-9]/g, ''));
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      if (phase === 'active') requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    className={cn(
                      'w-full text-center font-mono text-3xl font-bold bg-transparent border-b-2 outline-none pb-1 transition-colors duration-150',
                      lastResult === 'correct'
                        ? 'border-focused-correct text-focused-correct'
                        : lastResult === 'incorrect'
                        ? 'border-focused-incorrect text-focused-incorrect'
                        : 'border-focused-dim text-focused-correct focus:border-focused-caret',
                    )}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="Your answer"
                  />
                  <span className="text-xs font-mono text-focused-dim">
                    {phase === 'idle' ? 'enter answer to begin' : 'press enter to submit'}
                  </span>
                </div>

              </div>
            ) : (
              /* Results screen */
              <div className="px-5 sm:px-7 py-8 flex flex-col items-center gap-8">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="font-mono text-4xl font-bold text-focused-correct">{sessionScore}</p>
                    <p className="text-focused-dim text-xs font-mono mt-2">correct</p>
                  </div>
                  <div>
                    <p className="font-mono text-4xl font-bold text-focused-correct">{sessionAccuracy}%</p>
                    <p className="text-focused-dim text-xs font-mono mt-2">acc</p>
                  </div>
                  <div>
                    <p className={cn(
                      'font-mono text-4xl font-bold',
                      sessionXp > 0 ? 'text-focused-caret' : 'text-focused-dim',
                    )}>
                      {sessionSaving ? '…' : `+${sessionXp}`}
                    </p>
                    <p className="text-focused-dim text-xs font-mono mt-2">xp</p>
                  </div>
                </div>

                <div className="text-center text-xs font-mono text-focused-dim space-y-1.5">
                  {!user ? (
                    <p>
                      <button
                        className="underline underline-offset-2 hover:text-focused-correct transition-colors cursor-pointer"
                        onClick={() => navigate('/auth')}
                      >
                        sign in
                      </button>{' '}
                      to earn XP and track your sessions.
                    </p>
                  ) : sessionXp > 0 ? (
                    <>
                      <p>xp → <span className="text-focused-correct">{mappedStatName}</span></p>
                      {leveledUp && <p className="text-focused-caret">level up!</p>}
                      {newTitle && <p className="text-focused-caret">new title: {newTitle}</p>}
                    </>
                  ) : !canEarnXp ? (
                    <p className="opacity-50">free play · no xp (3/3 sessions used today)</p>
                  ) : !statMapping ? (
                    <p>
                      <button
                        className="underline underline-offset-2 hover:text-focused-correct transition-colors cursor-pointer"
                        onClick={() => setPickerOpen(true)}
                      >
                        link a stat
                      </button>{' '}
                      to earn xp next time.
                    </p>
                  ) : sessionScore === 0 ? (
                    <p className="opacity-50">no correct answers · no xp earned</p>
                  ) : null}
                </div>

                <div className="flex gap-4 justify-center font-mono text-sm">
                  <button
                    onClick={() => reset()}
                    className="flex items-center gap-1.5 text-focused-dim hover:text-focused-correct transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    retry
                  </button>
                  <span className="text-focused-dim">·</span>
                  <button
                    onClick={() => navigate('/games')}
                    className="text-focused-dim hover:text-focused-correct transition-colors cursor-pointer"
                  >
                    games hub
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile warning */}
          {isMobile && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-500/[0.07] border border-yellow-500/20 px-4 py-2.5 text-yellow-400/70 text-xs">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Best on desktop with a physical keyboard.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
