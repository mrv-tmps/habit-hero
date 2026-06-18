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
import { WORD_LIST } from '@/data/wordList';
import { TYPING_WORD_POOL_SIZE, TYPING_TIMER_OPTIONS } from '@/config/constants';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'active' | 'done';
type TimerMode = typeof TYPING_TIMER_OPTIONS[number];

interface WordResult {
  typed: string;
  target: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generatePool(): string[] {
  return [...WORD_LIST].sort(() => Math.random() - 0.5).slice(0, TYPING_WORD_POOL_SIZE);
}

function computeFinalMetrics(results: WordResult[], mode: number) {
  const correctWords = results.filter(r => r.typed === r.target).length;
  const wpm = Math.round((correctWords / mode) * 60);

  const totalTyped = results.reduce((s, r) => s + r.typed.length, 0);
  const correctTyped = results.reduce(
    (s, r) => s + r.typed.split('').filter((c, i) => c === r.target[i]).length,
    0,
  );
  const accuracy = totalTyped > 0 ? Math.round((correctTyped / totalTyped) * 100) : 100;

  return { wpm, accuracy };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TypingTest() {
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
  } = useGameSessions('typing');

  // ── Game state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<TimerMode>(30);
  const [phase, setPhase] = useState<Phase>('idle');
  const [words, setWords] = useState<string[]>(generatePool);
  const [wordIdx, setWordIdx] = useState(0);
  const [typedChars, setTypedChars] = useState('');
  const [wordResults, setWordResults] = useState<WordResult[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [scrollOffset, setScrollOffset] = useState(0);

  // ── Result state ────────────────────────────────────────────────────────────
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionWpm, setSessionWpm] = useState(0);
  const [sessionAccuracy, setSessionAccuracy] = useState(100);
  const [sessionXp, setSessionXp] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newTitle, setNewTitle] = useState<string | null>(null);

  // ── Stat picker ─────────────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedStatId, setSelectedStatId] = useState('');

  // ── Refs ────────────────────────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const innerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Sync timeLeft when mode changes while idle ───────────────────────────────
  useEffect(() => {
    if (phase === 'idle') setTimeLeft(mode);
  }, [mode, phase]);

  // ── Focus input when active ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'active') inputRef.current?.focus();
  }, [phase]);

  // ── Scroll current word into view ────────────────────────────────────────────
  useEffect(() => {
    const el = wordRefs.current[wordIdx];
    if (!el || !innerRef.current) return;
    const lineH = el.offsetHeight + 4;
    setScrollOffset(Math.max(0, el.offsetTop - lineH));
  }, [wordIdx]);

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

  // ── Save session when done ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done') return;

    const { wpm, accuracy } = computeFinalMetrics(wordResults, mode);
    setSessionWpm(wpm);
    setSessionAccuracy(accuracy);

    if (!user || isGuest) {
      setSessionXp(0);
      return;
    }

    setSessionSaving(true);
    saveSession(wpm, accuracy).then(result => {
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
    const m = newMode ?? mode;
    setPhase('idle');
    setWords(generatePool());
    setWordIdx(0);
    setTypedChars('');
    setWordResults([]);
    setTimeLeft(m);
    setScrollOffset(0);
    setSessionWpm(0);
    setSessionAccuracy(100);
    setSessionXp(0);
    setLeveledUp(false);
    setNewTitle(null);
    wordRefs.current = [];
    // Re-focus input after reset so typing can start immediately
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [stopTimer, mode]);

  const changeMode = (m: TimerMode) => {
    setMode(m);
    reset(m);
  };

  // ── Keyboard handler ─────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase === 'done') return;

    if (e.key.length === 1 || e.key === 'Backspace' || e.key === ' ') {
      e.preventDefault();
    }

    if (phase === 'idle') {
      if (e.key.length !== 1) return;
      setPhase('active');
      startTimer();
      setTypedChars(e.key);
      return;
    }

    if (e.key === ' ') {
      if (typedChars.length === 0) return;
      setWordResults(prev => [...prev, { typed: typedChars, target: words[wordIdx] }]);
      setWordIdx(prev => prev + 1);
      setTypedChars('');
      return;
    }

    if (e.key === 'Backspace') {
      setTypedChars(prev => prev.slice(0, -1));
      return;
    }

    if (e.key.length === 1) {
      setTypedChars(prev => prev + e.key);
    }
  };

  // ── Stat picker submit ────────────────────────────────────────────────────────
  const handlePickerSave = async () => {
    if (!selectedStatId) return;
    await saveStatMapping(selectedStatId);
    setPickerOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // ── Word rendering ────────────────────────────────────────────────────────────
  const renderWord = (word: string, wIdx: number) => {
    const isPast = wIdx < wordIdx;
    const isCurrent = wIdx === wordIdx;

    const typed = isPast
      ? (wordResults[wIdx]?.typed ?? '')
      : isCurrent
      ? typedChars
      : '';

    const charSpans: React.ReactNode[] = word.split('').map((char, cIdx) => {
      const charTyped = typed[cIdx];
      let cls = 'text-focused-dim';
      if (charTyped !== undefined) {
        cls = charTyped === char ? 'text-focused-correct' : 'text-focused-incorrect';
      }
      return <span key={cIdx} className={cls}>{char}</span>;
    });

    // Extra chars typed beyond word length
    if (isCurrent && typedChars.length > word.length) {
      typedChars.slice(word.length).split('').forEach((c, i) => {
        charSpans.push(
          <span key={`x${i}`} className="text-focused-incorrect">{c}</span>,
        );
      });
    }

    // Caret — visible in idle and active, hidden when done
    if (isCurrent && phase !== 'done') {
      const caretPos = Math.min(typedChars.length, charSpans.length);
      charSpans.splice(
        caretPos,
        0,
        <span
          key="caret"
          className="inline-block w-0.5 h-[1.2em] bg-focused-caret animate-caret-blink align-[-0.15em] mx-px"
          aria-hidden="true"
        />,
      );
    }

    const hasError = isPast && wordResults[wIdx]?.typed !== word;

    return (
      <span
        key={wIdx}
        ref={el => { wordRefs.current[wIdx] = el; }}
        className={cn(
          'inline-block mr-3 mb-2',
          hasError && 'underline decoration-destructive underline-offset-2',
        )}
      >
        {charSpans}
      </span>
    );
  };

  // ── Live WPM ─────────────────────────────────────────────────────────────────
  const elapsedSeconds = mode - timeLeft;
  const liveWpm = elapsedSeconds > 0
    ? Math.round((wordResults.filter(r => r.typed === r.target).length / elapsedSeconds) * 60)
    : 0;

  const mappedStatName = userStats.find(s => s.id === statMapping)?.stat_name ?? null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div data-mode="focused" className="min-h-screen flex flex-col select-none">

      {/* Stat picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link a stat to this game</DialogTitle>
            <DialogDescription>
              Choose which stat earns XP from the Typing Test. This is set once and saved permanently.
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

      {/* Focused-mode header */}
      <header className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5 shrink-0">
        {/* Left: back + mode selector */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/games')}
            onMouseDown={e => e.preventDefault()}
            className="text-focused-dim hover:text-focused-correct transition-colors cursor-pointer"
            aria-label="Back to games"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {TYPING_TIMER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => changeMode(opt as TimerMode)}
                onMouseDown={e => e.preventDefault()}
                className={cn(
                  'font-mono text-sm px-3 py-1 rounded-md transition-colors cursor-pointer',
                  mode === opt
                    ? 'text-focused-caret bg-white/5'
                    : 'text-focused-dim hover:text-focused-correct',
                )}
                aria-label={`${opt} second mode`}
                aria-pressed={mode === opt}
              >
                {opt}s
              </button>
            ))}
          </div>
        </div>

        {/* Right: live WPM + timer + restart */}
        <div className="flex items-center gap-5">
          {phase === 'active' && (
            <span className="font-mono text-sm text-focused-dim tabular-nums">
              {liveWpm} <span className="text-xs opacity-60">wpm</span>
            </span>
          )}

          <span
            className={cn(
              'font-mono text-xl font-semibold tabular-nums w-8 text-right',
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
            aria-label="Restart test"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile warning */}
      {isMobile && (
        <div className="flex items-center gap-2 px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs shrink-0">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Best on desktop with a physical keyboard.</span>
        </div>
      )}

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-12 cursor-text"
        onClick={() => { if (phase !== 'done') inputRef.current?.focus(); }}
      >
        {phase !== 'done' ? (
          <div className="w-full max-w-[720px] flex flex-col gap-8">

            {/* Stat / session info */}
            {!isGuest && (
              <div className="flex items-center justify-between text-xs text-focused-dim font-mono">
                <span>
                  {statMapping
                    ? <>stat <span className="text-focused-correct">{mappedStatName}</span></>
                    : <button
                        className="underline underline-offset-2 hover:text-focused-correct transition-colors cursor-pointer"
                        onMouseDown={e => e.preventDefault()}
                        onClick={e => { e.stopPropagation(); setPickerOpen(true); }}
                      >
                        link a stat to earn XP
                      </button>
                  }
                </span>
                <span>
                  {canEarnXp
                    ? <>{TYPING_TIMER_OPTIONS.length - todaySessionCount < 1 ? '' : `${3 - todaySessionCount} xp session${3 - todaySessionCount !== 1 ? 's' : ''} left`}</>
                    : <span className="text-focused-incorrect">xp cap reached today</span>
                  }
                </span>
              </div>
            )}

            {/* Word display */}
            <div
              className="overflow-hidden relative"
              style={{ height: '9rem' }}
            >
              <div
                ref={innerRef}
                className="font-mono text-2xl leading-[3rem]"
                style={{
                  transform: `translateY(-${scrollOffset}px)`,
                  transition: 'transform 80ms ease-out',
                }}
              >
                {words.map((word, i) => renderWord(word, i))}
              </div>
              {/* Bottom fade */}
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-focused-bg to-transparent pointer-events-none" />
            </div>

            {/* Idle hint */}
            {phase === 'idle' && (
              <p className="text-center text-focused-dim text-sm font-mono opacity-60">
                start typing to begin
              </p>
            )}
          </div>
        ) : (
          /* Results screen */
          <div className="w-full max-w-sm flex flex-col gap-8">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="font-mono text-4xl font-bold text-focused-correct">{sessionWpm}</p>
                <p className="text-focused-dim text-xs font-mono mt-2">wpm</p>
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

            {/* Context line */}
            <div className="text-center text-xs font-mono text-focused-dim space-y-1.5">
              {isGuest ? (
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
                <p className="text-focused-incorrect">xp cap reached (3/3 sessions today)</p>
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
              ) : null}
            </div>

            {/* Action row */}
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

      {/* Hidden keyboard sink — positioned off-screen, not pointer-events:none */}
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Re-capture focus during active play so buttons don't break typing
          if (phase === 'active') {
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        className="fixed -left-96 -top-96 opacity-0 w-px h-px"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
