import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bomb, RotateCcw, Users } from 'lucide-react';
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
import { useBlastEngine } from '@/hooks/useBlastEngine';
import { chooseAiShot } from '@/lib/blastAi';
import type { UnitState } from '@/lib/blastSim';
import BlastCanvas from '@/components/blast/BlastCanvas';
import BlastHud from '@/components/blast/BlastHud';
import {
  BA_AI_THINK_MS,
  BA_COUNTDOWN_MS,
  BA_DIFFICULTY_CONFIG,
  BA_WEAPONS,
  XP_PER_SESSION_CAP,
  type BlastDifficulty,
} from '@/config/constants';
import { cn } from '@/lib/utils';

const BEST_KEY = 'blast-arena-best';
const LOCAL_UNIT_ID = 'player';
const AI_UNIT_ID = 'ai';

// score = damage dealt; accuracy is overloaded as a win flag (100 = won, 0 = lost)
function blastXp(damage: number, accuracy: number): number {
  return accuracy > 0 ? Math.min(Math.floor(damage / 10), XP_PER_SESSION_CAP) : 0;
}

function getBestWins(): number {
  return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
}

// ─── Match ────────────────────────────────────────────────────────────────────

interface MatchProps {
  seed: number;
  startAt: number;
  difficulty: BlastDifficulty;
  characterName: string;
  onEnd: (winner: UnitState | null, damageDealt: Record<string, number>) => void;
}

function BlastMatch({ seed, startAt, difficulty, characterName, onEnd }: MatchProps) {
  // Stable identity — the engine re-initializes its world when this array changes
  const unitInits = useMemo(
    () => [
      { id: LOCAL_UNIT_ID, nickname: characterName, colorIndex: 1, isLocal: true },
      { id: AI_UNIT_ID, nickname: 'Rival Bot', colorIndex: 5, isLocal: false },
    ],
    [characterName],
  );
  const engine = useBlastEngine({ seed, startAt, unitInits });

  const {
    phase, countdown, turnIndex, activeUnit, wind, turnTimeLeft, winner, damageDealt,
    selectedWeapon, setWeapon, staminaLeft,
    commitShot, applyRemoteShot, setWalkHeld, updateAim, clearAim,
    registerCanvas, getSimState,
  } = engine;

  const isLocalTurn = phase === 'aiming' && !!activeUnit?.isLocal;

  // AI turn driver
  useEffect(() => {
    if (phase !== 'aiming' || !activeUnit || activeUnit.isLocal) return;
    const timeout = setTimeout(() => {
      const { terrain, units, wind: currentWind } = getSimState();
      const shooter = units.find(u => u.id === activeUnit.id);
      const target = units.find(u => u.isLocal && u.hp > 0);
      if (!shooter || !target) return;
      applyRemoteShot(chooseAiShot(terrain, units, shooter, target, currentWind, difficulty), turnIndex);
    }, BA_AI_THINK_MS);
    return () => clearTimeout(timeout);
  }, [phase, turnIndex, activeUnit, difficulty, getSimState, applyRemoteShot]);

  // Keyboard: arrows/AD walk, 1/2/3 weapon
  useEffect(() => {
    const weaponIds = Object.keys(BA_WEAPONS) as (keyof typeof BA_WEAPONS)[];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        setWalkHeld(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        setWalkHeld(1);
      } else if (e.key >= '1' && e.key <= '3') {
        setWeapon(weaponIds[parseInt(e.key, 10) - 1]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) setWalkHeld(0);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setWalkHeld, setWeapon]);

  // Report end exactly once
  const endedRef = useRef(false);
  useEffect(() => {
    if (phase === 'done' && !endedRef.current) {
      endedRef.current = true;
      onEnd(winner, damageDealt);
    }
  }, [phase, winner, damageDealt, onEnd]);

  const turnLabel =
    phase === 'projectile' ? '...' : isLocalTurn ? 'your turn' : `${activeUnit?.nickname ?? ''}'s turn`;

  return (
    <div className="relative w-full flex flex-col gap-3">
      <BlastHud
        turnLabel={turnLabel}
        isLocalTurn={isLocalTurn}
        timeLeft={turnTimeLeft}
        wind={wind}
        selectedWeapon={selectedWeapon}
        setWeapon={setWeapon}
        staminaLeft={staminaLeft}
        setWalkHeld={setWalkHeld}
      />
      <BlastCanvas
        registerCanvas={registerCanvas}
        updateAim={updateAim}
        clearAim={clearAim}
        commitShot={commitShot}
        maxSpeed={BA_WEAPONS[selectedWeapon].maxSpeed}
        canAim={isLocalTurn}
      />
      <p className="text-center text-xs font-mono text-focused-dim">
        drag to aim, release to fire · arrows to walk · 1/2/3 weapons
      </p>

      {phase === 'countdown' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <span
            key={countdown}
            className="font-pixel text-6xl text-focused-caret animate-countdown-pop"
          >
            {countdown}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'idle' | 'playing' | 'results';

interface MatchConfig {
  id: number;
  seed: number;
  startAt: number;
}

interface MatchOutcome {
  won: boolean;
  draw: boolean;
  damage: number;
  xp: number;
  leveledUp: boolean;
  newTitle: string | null;
  saving: boolean;
}

export default function BlastArena() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { profile, stats: userStats, loading: statsLoading } = useUserData();
  const {
    statMapping,
    todaySessionCount,
    canEarnXp,
    loading: sessionsLoading,
    saveSession,
    saveStatMapping,
  } = useGameSessions('blast-arena', { customXpFormula: blastXp });

  const [pageState, setPageState] = useState<PageState>('idle');
  const [difficulty, setDifficulty] = useState<BlastDifficulty>('medium');
  const [match, setMatch] = useState<MatchConfig | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [bestWins, setBestWins] = useState(getBestWins);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedStatId, setSelectedStatId] = useState('');

  useEffect(() => {
    if (!sessionsLoading && !statsLoading && !isGuest && user && statMapping === null && userStats.length > 0) {
      setPickerOpen(true);
      setSelectedStatId(userStats[0].id);
    }
  }, [sessionsLoading, statsLoading, isGuest, user, statMapping, userStats]);

  const startMatch = () => {
    setOutcome(null);
    setMatch({
      id: Date.now(),
      seed: Math.floor(Math.random() * 2 ** 31),
      startAt: Date.now() + BA_COUNTDOWN_MS,
    });
    setPageState('playing');
  };

  const handleMatchEnd = useCallback(
    (winner: UnitState | null, damageDealt: Record<string, number>) => {
      const won = winner?.id === LOCAL_UNIT_ID;
      const damage = damageDealt[LOCAL_UNIT_ID] ?? 0;

      if (won) {
        const wins = getBestWins() + 1;
        localStorage.setItem(BEST_KEY, String(wins));
        setBestWins(wins);
      }

      const base: MatchOutcome = {
        won,
        draw: winner === null,
        damage,
        xp: 0,
        leveledUp: false,
        newTitle: null,
        saving: false,
      };

      if (user && !isGuest) {
        setOutcome({ ...base, saving: true });
        saveSession(damage, won ? 100 : 0).then(result => {
          setOutcome({
            ...base,
            xp: result?.xpEarned ?? 0,
            leveledUp: result?.leveledUp ?? false,
            newTitle: result?.newTitleUnlocked ?? null,
            saving: false,
          });
        });
      } else {
        setOutcome(base);
      }
      setPageState('results');
    },
    [user, isGuest, saveSession],
  );

  const handlePickerSave = async () => {
    if (!selectedStatId) return;
    await saveStatMapping(selectedStatId);
    setPickerOpen(false);
  };

  const mappedStatName = userStats.find(s => s.id === statMapping)?.stat_name ?? null;
  const xpSessionsLeft = Math.max(0, 3 - todaySessionCount);
  const characterName = profile?.character_name || 'You';

  return (
    <div className={cn('min-h-screen flex flex-col select-none', pageState === 'playing' ? '' : 'page-bg')}>
      {/* Stat picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link a stat to this game</DialogTitle>
            <DialogDescription>
              Choose which stat earns XP from Blast Arena. This is set once and saved permanently.
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

      <div
        data-mode={pageState === 'playing' ? 'arcade' : undefined}
        className="flex-1 flex flex-col items-center px-4 sm:px-8 pt-10 sm:pt-14 pb-8"
      >
        <div className="w-full max-w-[760px] flex flex-col gap-3">
          <button
            onClick={() => navigate('/games')}
            onMouseDown={e => e.preventDefault()}
            className="self-start flex items-center gap-1.5 text-sm font-mono text-focused-dim hover:text-focused-correct transition-colors cursor-pointer"
            aria-label="Back to games"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            games
          </button>

          {pageState === 'idle' && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 sm:px-7 py-8 flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <Bomb className="w-8 h-8 text-primary" />
                <h1 className="font-pixel text-lg text-foreground">Blast Arena</h1>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Turn-based artillery. Walk, aim with a slingshot drag, and blast the
                  terrain out from under your rival. Last one standing wins.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {(Object.keys(BA_DIFFICULTY_CONFIG) as BlastDifficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    onMouseDown={e => e.preventDefault()}
                    className={cn(
                      'font-mono text-sm px-3 py-1 rounded-md transition-colors cursor-pointer capitalize',
                      difficulty === d
                        ? 'text-primary bg-white/[0.08]'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-pressed={difficulty === d}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center gap-3">
                <Button onClick={startMatch} className="px-8">
                  Start Battle
                </Button>
                <button
                  onClick={() => navigate('/games/room/new?game=blast-arena')}
                  className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  play with friends
                </button>
              </div>

              <div className="text-xs font-mono text-muted-foreground space-y-1 text-center">
                {bestWins > 0 && <p>wins: <span className="text-foreground">{bestWins}</span></p>}
                {!!user && !isGuest && (
                  <p>
                    {statMapping
                      ? <>stat <span className="text-foreground">{mappedStatName}</span>{canEarnXp ? ` · ${xpSessionsLeft} xp session${xpSessionsLeft !== 1 ? 's' : ''} left` : ' · free play, no xp'}</>
                      : (
                        <button
                          className="underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
                          onClick={() => setPickerOpen(true)}
                        >
                          link a stat to earn XP
                        </button>
                      )}
                  </p>
                )}
              </div>
            </div>
          )}

          {pageState === 'playing' && match && (
            <BlastMatch
              key={match.id}
              seed={match.seed}
              startAt={match.startAt}
              difficulty={difficulty}
              characterName={characterName}
              onEnd={handleMatchEnd}
            />
          )}

          {pageState === 'results' && outcome && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 sm:px-7 py-8 flex flex-col items-center gap-6">
              <h2 className={cn('font-pixel text-xl', outcome.won ? 'text-primary text-glow' : 'text-muted-foreground')}>
                {outcome.draw ? 'Draw' : outcome.won ? 'Victory!' : 'Defeat'}
              </h2>

              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <p className="font-mono text-4xl font-bold text-foreground">{outcome.damage}</p>
                  <p className="text-muted-foreground text-xs font-mono mt-2">damage dealt</p>
                </div>
                <div>
                  <p className={cn('font-mono text-4xl font-bold', outcome.xp > 0 ? 'text-primary' : 'text-muted-foreground')}>
                    {outcome.saving ? '…' : `+${outcome.xp}`}
                  </p>
                  <p className="text-muted-foreground text-xs font-mono mt-2">xp</p>
                </div>
              </div>

              <div className="text-center text-xs font-mono text-muted-foreground space-y-1.5">
                {!user ? (
                  <p>
                    <button
                      className="underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => navigate('/auth')}
                    >
                      sign in
                    </button>{' '}
                    to earn XP and track your battles.
                  </p>
                ) : outcome.xp > 0 ? (
                  <>
                    <p>xp → <span className="text-foreground">{mappedStatName}</span></p>
                    {outcome.leveledUp && <p className="text-primary">level up!</p>}
                    {outcome.newTitle && <p className="text-primary">new title: {outcome.newTitle}</p>}
                  </>
                ) : outcome.won && !canEarnXp ? (
                  <p className="opacity-60">free play · no xp (3/3 sessions used today)</p>
                ) : !outcome.won ? (
                  <p className="opacity-60">win a battle to earn xp</p>
                ) : null}
              </div>

              <div className="flex gap-4 justify-center font-mono text-sm">
                <button
                  onClick={startMatch}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  rematch
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => navigate('/games')}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  games hub
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
