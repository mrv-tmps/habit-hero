import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Coins, Gem, Timer, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useGameSessions } from '@/hooks/useGameSessions';
import { useCoinRushEngine } from '@/hooks/useCoinRushEngine';
import { Arena } from '@/components/coinrush/Arena';
import { Joystick } from '@/components/coinrush/Joystick';
import {
  CR_ROUND_OPTIONS,
  CR_DEFAULT_ROUND,
  CR_DIFFICULTY,
  type CRDifficulty,
  XP_PER_SESSION_CAP,
} from '@/config/constants';
import { cn } from '@/lib/utils';

const BEST_SCORE_KEY = 'coin-rush-best';

function getLocalBest(): number {
  return parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10) || 0;
}

function setLocalBest(score: number) {
  const current = getLocalBest();
  if (score > current) localStorage.setItem(BEST_SCORE_KEY, String(score));
}

export default function CoinRush() {
  const { user } = useAuth();
  const {
    saveSession,
    loading: sessionLoading,
    todaySessionCount,
    canEarnXp,
  } = useGameSessions('coin-rush', {
    customXpFormula: (score) => Math.min(Math.floor(score / 10), XP_PER_SESSION_CAP),
  });

  // ── Pre-game state ────────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState<CRDifficulty>('medium');
  const [roundSeconds, setRoundSeconds] = useState(CR_DEFAULT_ROUND);
  const [authBest, setAuthBest] = useState<number | null>(null);

  // ── Game session params (set on Start) ───────────────────────────────
  const [gameKey, setGameKey] = useState(0);
  const [seed, setSeed] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    xpEarned: number;
    newBest: boolean;
    newTitle: string | null;
  } | null>(null);

  const arenaRef = useRef<HTMLElement>(null);
  const gameResultSavedRef = useRef(false);

  // ── Countdown overlay ─────────────────────────────────────────────────
  const [countdownLabel, setCountdownLabel] = useState<string>('');
  useEffect(() => {
    if (!isPlaying || startAt === 0) return;
    let rafId: number;
    function tick() {
      const ms = startAt - Date.now();
      if (ms > 2000) setCountdownLabel('3');
      else if (ms > 1000) setCountdownLabel('2');
      else if (ms > 0) setCountdownLabel('1');
      else if (ms > -500) setCountdownLabel('GO!');
      else { setCountdownLabel(''); return; }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, startAt]);

  // ── Load auth best ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || sessionLoading) return;
    // game_sessions is not in generated types; same cast used by all game hooks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    db.from('game_sessions')
      .select('score_wpm')
      .eq('user_id', user.id)
      .eq('game_type', 'coin-rush')
      .order('score_wpm', { ascending: false })
      .limit(1)
      .then(({ data }: { data: { score_wpm: number }[] | null }) => {
        setAuthBest(data?.[0]?.score_wpm ?? 0);
      });
  }, [user, sessionLoading]);

  const currentBest = user ? (authBest ?? null) : getLocalBest();
  const bestLabel = currentBest !== null && currentBest > 0 ? `Best: ${currentBest} pts` : null;

  // ── Engine ────────────────────────────────────────────────────────────
  const {
    phase,
    coins,
    saws,
    cfg,
    score,
    gemCount: _gemCount,
    stunned,
    timeRemaining,
    pops,
    ownPosRef: _ownPosRef,
    setInputVector,
    registerAvatarEl,
  } = useCoinRushEngine({
    seed,
    difficulty,
    durationMs: roundSeconds * 1000,
    startAt,
    arenaRef,
  });

  // ── Save result when phase becomes 'done' ────────────────────────────
  useEffect(() => {
    if (phase !== 'done' || !isPlaying || gameResultSavedRef.current) return;
    gameResultSavedRef.current = true;

    (async () => {
      let xpEarned = 0;
      let newTitle: string | null = null;

      if (user) {
        const result = await saveSession(score, 100);
        xpEarned = result?.xpEarned ?? 0;
        newTitle = result?.newTitleUnlocked ?? null;
        // Update auth best
        if (authBest === null || score > authBest) setAuthBest(score);
      } else {
        setLocalBest(score);
      }

      const prevBest = user ? (authBest ?? 0) : getLocalBest();
      setSavedResult({
        xpEarned,
        newBest: score > (user ? (authBest ?? 0) : prevBest),
        newTitle,
      });
    })();
  }, [phase, isPlaying, score, user, saveSession, authBest]);

  // ── Keyboard input ────────────────────────────────────────────────────
  const keysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isPlaying) return;
    function onKeyDown(e: KeyboardEvent) {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let rafId: number;
    function tick() {
      const keys = keysRef.current;
      let dx = 0, dy = 0;
      if (keys.has('ArrowLeft')  || keys.has('a') || keys.has('A')) dx -= 1;
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dx += 1;
      if (keys.has('ArrowUp')    || keys.has('w') || keys.has('W')) dy -= 1;
      if (keys.has('ArrowDown')  || keys.has('s') || keys.has('S')) dy += 1;
      setInputVector(dx, dy);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, setInputVector]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    gameResultSavedRef.current = false;
    setSavedResult(null);
    setSeed(Math.floor(Math.random() * 2 ** 31));
    setStartAt(Date.now() + 3000);
    setGameKey(k => k + 1);
    setIsPlaying(true);
  }, []);

  const handlePlayAgain = useCallback(() => {
    handleStart();
  }, [handleStart]);

  const handleQuit = useCallback(() => {
    setIsPlaying(false);
    setSavedResult(null);
    setInputVector(0, 0);
    keysRef.current.clear();
  }, [setInputVector]);

  // ── Results screen ────────────────────────────────────────────────────
  if (isPlaying && phase === 'done' && savedResult) {
    const best = user ? (authBest ?? 0) : getLocalBest();
    return (
      <div className="min-h-screen page-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-lg p-6 space-y-4 card-glow">
            <div className="text-center space-y-1">
              <p className="font-pixel text-lg text-primary">Time!</p>
              <p className="font-mono text-4xl text-primary font-bold">{score}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Coins className="w-3.5 h-3.5" /> points collected
              </p>
            </div>

            {savedResult.newBest && (
              <div className="text-center">
                <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-pixel animate-titlePulse">
                  New best!
                </span>
              </div>
            )}

            {user && savedResult.xpEarned > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                +{savedResult.xpEarned} XP earned
                {savedResult.newTitle && (
                  <> · <span className="text-primary">{savedResult.newTitle}</span> unlocked!</>
                )}
              </p>
            )}

            {!user && (
              <p className="text-center text-xs text-muted-foreground">
                Sign in to save your score and earn XP.
              </p>
            )}

            {best > 0 && (
              <p className="text-center font-mono text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Best: {best} pts
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handlePlayAgain} className="w-full font-pixel text-xs">
                Play Again
              </Button>
              <Button
                variant="outline"
                className="w-full font-pixel text-xs"
                asChild
              >
                <Link to="/games/room/new?game=coin-rush">
                  <Users className="w-3.5 h-3.5 mr-2" />
                  Play with friends
                </Link>
              </Button>
              <Button variant="ghost" className="w-full font-pixel text-xs" onClick={handleQuit}>
                Back to Games
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active game ───────────────────────────────────────────────────────
  if (isPlaying) {
    const showCountdown = countdownLabel !== '';
    const nearEnd = timeRemaining <= 10 && timeRemaining > 0 && phase === 'active';

    return (
      <div data-mode="arcade" className="min-h-screen flex flex-col items-center select-none">
        {/* HUD top bar */}
        <div className="w-full z-10 px-4 py-2 flex items-center justify-between bg-background/80 backdrop-blur-sm">
          <button
            onClick={handleQuit}
            className="text-muted-foreground hover:text-foreground text-xs font-mono cursor-pointer"
            aria-label="Quit game"
          >
            ✕
          </button>
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-primary" />
            <span className={cn(
              'font-mono text-sm text-primary',
              nearEnd && 'animate-pulse-glow',
            )}>
              {timeRemaining}s
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-sm">{score}</span>
          </div>
        </div>

        {/* Arena */}
        <div className="flex-1 flex items-center justify-center w-full px-4 pt-2 pb-32 relative">
          <Arena
            key={gameKey}
            arenaRef={arenaRef as React.RefObject<HTMLElement>}
            coins={coins}
            saws={saws}
            cfg={cfg}
            phase={phase}
            stunned={stunned}
            startAt={startAt}
            pops={pops}
            registerAvatarEl={registerAvatarEl}
          />

          {/* 3-2-1 countdown overlay */}
          {showCountdown && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <span
                key={countdownLabel}
                className="font-pixel text-5xl text-primary animate-countdown-pop"
              >
                {countdownLabel}
              </span>
            </div>
          )}
        </div>

        {/* Virtual joystick */}
        <Joystick
          onVector={setInputVector}
          className="bottom-8"
        />
      </div>
    );
  }

  // ── Start card ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="bg-card rounded-lg p-6 space-y-5 card-glow">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <h1 className="font-pixel text-xl text-primary">Coin Rush</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Grab as many coins as you can before the clock runs out.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-none">
            <li>Move with <kbd className="font-mono bg-secondary px-1 rounded text-xs">WASD</kbd> / arrow keys, or the on-screen joystick</li>
            <li>Gold circles <span className="text-[hsl(var(--coin))]">●</span> = +1 pt &nbsp;·&nbsp; purple diamonds <span className="text-[hsl(var(--gem))]">◆</span> = +5 pts (expire fast!)</li>
            <li>Red saw blades freeze you for 2 s — no points lost</li>
          </ul>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Difficulty</label>
            <Select
              value={difficulty}
              onValueChange={v => setDifficulty(v as CRDifficulty)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CR_DIFFICULTY.map(d => (
                  <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Round length */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Round length</label>
            <Select
              value={String(roundSeconds)}
              onValueChange={v => setRoundSeconds(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CR_ROUND_OPTIONS.map(s => (
                  <SelectItem key={s} value={String(s)}>{s} seconds</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current best */}
          {bestLabel && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="w-3.5 h-3.5" />
              <span className="font-mono text-sm">{bestLabel}</span>
            </div>
          )}

          {/* XP info */}
          {user && (
            <p className="text-xs text-muted-foreground">
              {canEarnXp
                ? `Sessions today: ${todaySessionCount}/3 — XP available`
                : 'Daily XP cap reached (3/3). You can still play!'}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleStart} className="w-full font-pixel text-xs" size="lg">
              Start
            </Button>
            <Button
              variant="outline"
              className="w-full font-pixel text-xs"
              size="lg"
              asChild
            >
              <Link to="/games/room/new?game=coin-rush">
                <Users className="w-3.5 h-3.5 mr-2" />
                Play with friends →
              </Link>
            </Button>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link
            to="/games"
            className="text-xs text-muted-foreground hover:text-foreground font-mono"
          >
            ← Back to Games
          </Link>
        </div>
      </div>
    </div>
  );
}
