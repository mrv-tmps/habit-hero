import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MutableRefObject,
  type RefObject,
} from 'react';
import {
  getArenaConfig,
  getInitialCoins,
  nextCoin,
  getGemForIndex,
  getSaws,
  sawPositionAt,
  circlesOverlap,
  type Coin,
  type Saw,
  type ArenaConfig,
} from '@/lib/coinRushArena';
import {
  CR_STUN_MS,
  CR_INVULN_MS,
  CR_COIN_VALUE,
  CR_GEM_VALUE,
  type CRDifficulty,
} from '@/config/constants';

export type { Coin, Saw };

export type GamePhase = 'countdown' | 'active' | 'done';

export interface CollectionPop {
  id: number;
  x: number;
  y: number;
  kind: 'coin' | 'gem';
}

interface UseCoinRushEngineArgs {
  seed: number;
  difficulty: CRDifficulty;
  durationMs: number;
  startAt: number;  // epoch ms; game goes active when Date.now() >= startAt
  onCoinClaim?: (coinId: number, kind: 'coin' | 'gem') => boolean;
  arenaRef: RefObject<HTMLElement>;
}

interface UseCoinRushEngineReturn {
  phase: GamePhase;
  coins: Coin[];
  saws: Saw[];
  cfg: ArenaConfig;
  score: number;
  gemCount: number;
  stunned: boolean;
  timeRemaining: number;
  pops: CollectionPop[];
  ownPosRef: MutableRefObject<{ x: number; y: number }>;
  setInputVector: (dx: number, dy: number) => void;
  registerAvatarEl: (el: HTMLElement | null) => void;
}

export function useCoinRushEngine({
  seed,
  difficulty,
  durationMs,
  startAt,
  onCoinClaim,
  arenaRef,
}: UseCoinRushEngineArgs): UseCoinRushEngineReturn {
  const cfg = getArenaConfig(difficulty);

  // ── Discrete React state (only updated on game events, never per-frame) ─
  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [coins, setCoins] = useState<Coin[]>(() => getInitialCoins(seed, cfg));
  const [saws, setSaws] = useState<Saw[]>(() => getSaws(seed, cfg));
  const [score, setScore] = useState(0);
  const [gemCount, setGemCount] = useState(0);
  const [stunned, setStunned] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(Math.ceil(durationMs / 1000));
  const [pops, setPops] = useState<CollectionPop[]>([]);

  // ── Mutable refs (rAF reads/writes without triggering re-renders) ─────
  const coinsRef = useRef<Coin[]>(coins);
  const sawsRef = useRef<Saw[]>(saws);
  const scoreRef = useRef(0);
  const stunnedRef = useRef(false);
  const phaseRef = useRef<GamePhase>('countdown');
  const gemCountRef = useRef(0);
  const replacementCounterRef = useRef(0);
  const invulnUntilRef = useRef(0);
  const stunUntilRef = useRef(0);
  const ownPosRef = useRef({ x: cfg.size / 2, y: cfg.size / 2 });
  const inputVectorRef = useRef({ dx: 0, dy: 0 });
  const avatarElRef = useRef<HTMLElement | null>(null);
  const lastGemIndexRef = useRef(-1);
  const lastTimeRemainingRef = useRef(Math.ceil(durationMs / 1000));
  const rafRef = useRef<number | null>(null);
  const prevFrameTimeRef = useRef<number | null>(null);
  const onCoinClaimRef = useRef(onCoinClaim);
  onCoinClaimRef.current = onCoinClaim;

  // Keep sawsRef in sync with the stable saws state
  useEffect(() => { sawsRef.current = saws; }, [saws]);

  // ── Stable callbacks ──────────────────────────────────────────────────
  const setInputVector = useCallback((dx: number, dy: number) => {
    inputVectorRef.current = { dx, dy };
  }, []);

  const registerAvatarEl = useCallback((el: HTMLElement | null) => {
    avatarElRef.current = el;
  }, []);

  // ── Main rAF loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const initialCoins = getInitialCoins(seed, cfg);
    const initialSaws = getSaws(seed, cfg);

    coinsRef.current = initialCoins;
    sawsRef.current = initialSaws;
    setSaws(initialSaws);
    scoreRef.current = 0;
    stunnedRef.current = false;
    phaseRef.current = 'countdown';
    gemCountRef.current = 0;
    replacementCounterRef.current = 0;
    invulnUntilRef.current = 0;
    stunUntilRef.current = 0;
    ownPosRef.current = { x: cfg.size / 2, y: cfg.size / 2 };
    lastGemIndexRef.current = -1;
    lastTimeRemainingRef.current = Math.ceil(durationMs / 1000);
    prevFrameTimeRef.current = null;

    setCoins(initialCoins);
    setScore(0);
    setGemCount(0);
    setStunned(false);
    setPhase('countdown');
    setTimeRemaining(Math.ceil(durationMs / 1000));
    setPops([]);

    function loop(now: number) {
      const nowMs = Date.now();
      const elapsedMs = nowMs - startAt;
      const dt = prevFrameTimeRef.current !== null
        ? Math.min((now - prevFrameTimeRef.current) / 1000, 0.1)
        : 0;
      prevFrameTimeRef.current = now;

      // ── Phase: countdown → active ───────────────────────────────────
      if (phaseRef.current === 'countdown' && elapsedMs >= 0) {
        phaseRef.current = 'active';
        setPhase('active');
      }

      // ── Phase: active → done ────────────────────────────────────────
      if (phaseRef.current === 'active' && elapsedMs >= durationMs) {
        phaseRef.current = 'done';
        setPhase('done');
        setTimeRemaining(0);
        return; // stop rAF loop
      }

      // ── Time remaining (discrete: only setState when the second changes)
      if (phaseRef.current === 'active') {
        const remaining = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
        if (remaining !== lastTimeRemainingRef.current) {
          lastTimeRemainingRef.current = remaining;
          setTimeRemaining(remaining);
        }
      }

      // ── Skip per-frame logic during countdown ───────────────────────
      if (phaseRef.current !== 'active' || dt <= 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Stun toggle ─────────────────────────────────────────────────
      const isStunned = nowMs < stunUntilRef.current;
      if (isStunned !== stunnedRef.current) {
        stunnedRef.current = isStunned;
        setStunned(isStunned);
      }

      // ── Movement (locked while stunned) ────────────────────────────
      if (!isStunned) {
        const { dx, dy } = inputVectorRef.current;
        if (dx !== 0 || dy !== 0) {
          const len = Math.sqrt(dx * dx + dy * dy);
          const speed = cfg.avatarSpeed * dt;
          const newX = Math.max(
            cfg.avatarRadius,
            Math.min(cfg.size - cfg.avatarRadius, ownPosRef.current.x + (dx / len) * speed),
          );
          const newY = Math.max(
            cfg.avatarRadius,
            Math.min(cfg.size - cfg.avatarRadius, ownPosRef.current.y + (dy / len) * speed),
          );
          ownPosRef.current = { x: newX, y: newY };
        }
      }

      // ── Write own avatar transform to DOM ───────────────────────────
      const arenaEl = arenaRef.current;
      const avatarEl = avatarElRef.current;
      if (arenaEl && avatarEl) {
        const scale = arenaEl.offsetWidth / cfg.size;
        const { x, y } = ownPosRef.current;
        avatarEl.style.transform = `translate3d(${(x - cfg.avatarRadius) * scale}px, ${(y - cfg.avatarRadius) * scale}px, 0)`;
      }

      // ── Gem lifecycle ────────────────────────────────────────────────
      const gemIndex = Math.floor(Math.max(0, elapsedMs) / cfg.gemIntervalMs);
      if (gemIndex !== lastGemIndexRef.current) {
        lastGemIndexRef.current = gemIndex;
        const gem = getGemForIndex(seed, gemIndex, cfg);
        const withoutGem = coinsRef.current.filter(c => c.kind !== 'gem');
        withoutGem.push(gem);
        coinsRef.current = withoutGem;
        setCoins([...withoutGem]);
      }

      const currentGem = coinsRef.current.find(c => c.kind === 'gem');
      if (currentGem && currentGem.expireAt !== null && elapsedMs >= currentGem.expireAt) {
        const withoutGem = coinsRef.current.filter(c => c.kind !== 'gem');
        coinsRef.current = withoutGem;
        setCoins([...withoutGem]);
      }

      // ── Coin collision ───────────────────────────────────────────────
      const { x: px, y: py } = ownPosRef.current;
      let coinsChanged = false;
      const nextCoins: Coin[] = [];

      for (const coin of coinsRef.current) {
        const r = coin.kind === 'gem' ? cfg.gemRadius : cfg.coinRadius;
        if (!circlesOverlap(px, py, cfg.avatarRadius, coin.x, coin.y, r)) {
          nextCoins.push(coin);
          continue;
        }
        const claimed = onCoinClaimRef.current
          ? onCoinClaimRef.current(coin.id, coin.kind)
          : true;
        if (!claimed) {
          nextCoins.push(coin);
          continue;
        }

        coinsChanged = true;
        const points = coin.kind === 'gem' ? CR_GEM_VALUE : CR_COIN_VALUE;
        scoreRef.current += points;
        setScore(scoreRef.current);

        if (coin.kind === 'gem') {
          gemCountRef.current += 1;
          setGemCount(gemCountRef.current);
          // Gem just vanishes; next gem cycle determined by time
        } else {
          // Replace with next seeded coin
          nextCoins.push(nextCoin(seed, cfg, replacementCounterRef.current++, elapsedMs));
        }

        const popId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        setPops(prev => [...prev, { id: popId, x: coin.x, y: coin.y, kind: coin.kind }]);
        setTimeout(() => setPops(prev => prev.filter(p => p.id !== popId)), 600);
      }

      if (coinsChanged) {
        coinsRef.current = nextCoins;
        setCoins([...nextCoins]);
      }

      // ── Saw collision ────────────────────────────────────────────────
      const isInvuln = nowMs < invulnUntilRef.current;
      if (!isInvuln && !isStunned) {
        for (const saw of sawsRef.current) {
          const { x: sx, y: sy } = sawPositionAt(saw, Math.max(0, elapsedMs), cfg);
          if (circlesOverlap(px, py, cfg.avatarRadius, sx, sy, cfg.sawRadius)) {
            stunUntilRef.current = nowMs + CR_STUN_MS;
            invulnUntilRef.current = nowMs + CR_STUN_MS + CR_INVULN_MS;
            stunnedRef.current = true;
            setStunned(true);
            break;
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, difficulty, durationMs, startAt]);

  return {
    phase,
    coins,
    saws,
    cfg,
    score,
    gemCount,
    stunned,
    timeRemaining,
    pops,
    ownPosRef,
    setInputVector,
    registerAvatarEl,
  };
}
