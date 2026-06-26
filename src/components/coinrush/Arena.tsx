import { useState, useRef, useEffect, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { sawPositionAt, type Coin, type Saw, type ArenaConfig } from '@/lib/coinRushArena';
import type { CollectionPop, GamePhase } from '@/hooks/useCoinRushEngine';

interface ArenaProps {
  arenaRef: RefObject<HTMLElement>;
  coins: Coin[];
  saws: Saw[];
  cfg: ArenaConfig;
  phase: GamePhase;
  stunned: boolean;
  startAt: number;          // epoch ms when game goes active
  pops: CollectionPop[];
  registerAvatarEl: (el: HTMLElement | null) => void;
  nickname?: string;
  playerSlot?: number;      // 1–8; defaults to 1 (solo)
}

export function Arena({
  arenaRef,
  coins,
  saws,
  cfg,
  phase,
  stunned,
  startAt,
  pops,
  registerAvatarEl,
  nickname = 'You',
  playerSlot = 1,
}: ArenaProps) {
  const sawElsRef = useRef<Map<number, HTMLElement>>(new Map());

  // Track arena pixel size so entity positions are always correct, even on
  // first render and after window resize.  Scale = px / virtual unit.
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = arenaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / cfg.size);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [arenaRef, cfg.size]);

  // ── Saw animation rAF ──────────────────────────────────────────────────
  // Saw positions are a pure function of (saw, elapsed, cfg) — no state needed.
  useEffect(() => {
    if (phase === 'done') return;

    let rafId: number;
    function updateSaws() {
      const arenaEl = arenaRef.current;
      if (!arenaEl) {
        rafId = requestAnimationFrame(updateSaws);
        return;
      }
      const s = arenaEl.offsetWidth / cfg.size;
      const elapsedMs = Math.max(0, Date.now() - startAt);

      for (const [id, el] of sawElsRef.current) {
        const saw = saws.find(sv => sv.id === id);
        if (!saw) continue;
        const { x, y } = sawPositionAt(saw, elapsedMs, cfg);
        el.style.transform = `translate3d(${(x - cfg.sawRadius) * s}px, ${(y - cfg.sawRadius) * s}px, 0)`;
      }
      rafId = requestAnimationFrame(updateSaws);
    }
    rafId = requestAnimationFrame(updateSaws);
    return () => cancelAnimationFrame(rafId);
  }, [arenaRef, saws, cfg, startAt, phase]);

  return (
    <div
      ref={arenaRef as RefObject<HTMLDivElement>}
      className="relative overflow-hidden flex-shrink-0 border-2 border-[hsl(var(--arena-wall))] bg-[hsl(var(--arena-floor))]"
      style={{
        width: 'min(calc(100vw - 2rem), 70vh)',
        height: 'min(calc(100vw - 2rem), 70vh)',
        backgroundImage:
          'linear-gradient(hsl(var(--arena-grid)) 1px, transparent 1px),' +
          'linear-gradient(90deg, hsl(var(--arena-grid)) 1px, transparent 1px)',
        backgroundSize: '5% 5%',
      }}
      aria-label="Game arena"
    >
      {/* Don't render entities until scale is known (after first ResizeObserver tick) */}
      {scale > 0 && (
        <>
          {coins.map(coin => (
            <CoinEntity key={coin.id} coin={coin} cfg={cfg} scale={scale} />
          ))}

          {saws.map(saw => (
            <SawEntity
              key={saw.id}
              cfg={cfg}
              scale={scale}
              onMount={el => {
                if (el) sawElsRef.current.set(saw.id, el);
                else sawElsRef.current.delete(saw.id);
              }}
            />
          ))}

          <AvatarEntity
            cfg={cfg}
            scale={scale}
            playerSlot={playerSlot}
            nickname={nickname}
            stunned={stunned}
            registerEl={registerAvatarEl}
          />

          {pops.map(pop => (
            <PopEntity key={pop.id} pop={pop} cfg={cfg} scale={scale} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Entity sub-components ─────────────────────────────────────────────────

function CoinEntity({ coin, cfg, scale }: { coin: Coin; cfg: ArenaConfig; scale: number }) {
  const r = coin.kind === 'gem' ? cfg.gemRadius : cfg.coinRadius;
  const size = r * 2 * scale;
  const posStyle = {
    width: size,
    height: size,
    transform: `translate3d(${(coin.x - r) * scale}px, ${(coin.y - r) * scale}px, 0)`,
  };

  if (coin.kind === 'gem') {
    // Outer div owns the translate3d; inner div owns the animation.
    // Keeping them separate prevents the CSS animation from overriding the position transform.
    return (
      <div className="absolute top-0 left-0 pointer-events-none" style={posStyle}>
        <div
          className="animate-gem-pulse bg-[hsl(var(--gem))] rounded-sm shadow-[0_0_8px_hsl(var(--gem)/0.6)]"
          style={{ width: size, height: size }}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none rounded-full bg-[hsl(var(--coin))] ring-1 ring-[hsl(var(--coin-edge))]"
      style={posStyle}
    />
  );
}

// 8-tooth gear path in a 100×100 viewBox.
// Outer r=46, inner (root) r=30, hub hole r=12.
// fill-rule="evenodd" punches the center hole.
const SAW_PATH =
  'M50,20 L57.99,4.70 L76.39,12.32 L71.21,28.79 ' +
  'L87.68,23.62 L95.28,42.01 L80,50 ' +
  'L95.28,57.99 L87.68,76.38 L71.21,71.21 ' +
  'L76.39,87.68 L57.99,95.30 L50,80 ' +
  'L42.01,95.28 L23.61,87.68 L28.79,71.21 ' +
  'L12.32,76.38 L4.70,57.98 L20,50 ' +
  'L4.70,42.01 L12.32,23.62 L28.79,28.79 ' +
  'L23.61,12.32 L42.01,4.70 Z ' +
  'M62,50 A12,12 0 0,1 50,62 A12,12 0 0,1 38,50 A12,12 0 0,1 50,38 A12,12 0 0,1 62,50 Z';

function SawEntity({
  cfg,
  scale,
  onMount,
}: { cfg: ArenaConfig; scale: number; onMount: (el: HTMLElement | null) => void }) {
  const size = cfg.sawRadius * 2 * scale;
  return (
    <div
      ref={onMount}
      className="absolute top-0 left-0 pointer-events-none animate-[spin_1.2s_linear_infinite]"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="hsl(var(--hazard))"
        fillRule="evenodd"
        style={{ filter: 'drop-shadow(0 0 4px hsl(var(--hazard)/0.5))' }}
        aria-hidden
      >
        <path d={SAW_PATH} />
      </svg>
    </div>
  );
}

function AvatarEntity({
  cfg,
  scale,
  playerSlot,
  nickname,
  stunned,
  registerEl,
}: {
  cfg: ArenaConfig;
  scale: number;
  playerSlot: number;
  nickname: string;
  stunned: boolean;
  registerEl: (el: HTMLElement | null) => void;
}) {
  const colorVar = `var(--player-${playerSlot})`;
  const size = cfg.avatarRadius * 2 * scale;

  return (
    <div
      ref={registerEl}
      className={cn(
        'absolute top-0 left-0 pointer-events-none select-none',
        stunned && 'animate-stun-shake opacity-70',
      )}
      style={{ width: 0, height: 0 }}
    >
      {/* Nickname label */}
      <div
        className="absolute font-sans text-white/80 truncate text-center whitespace-nowrap"
        style={{
          fontSize: Math.max(8, size * 0.4),
          width: size * 3,
          marginLeft: -(size * 1.5),
          bottom: size * 1.1,
        }}
      >
        {nickname}
      </div>

      {/* Avatar blob */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: stunned ? 'hsl(var(--stun-flash))' : `hsl(${colorVar})`,
          boxShadow: `0 0 0 2px hsl(${colorVar}/0.6)`,
        }}
      >
        <span
          className="text-white/80 leading-none select-none"
          style={{ fontSize: size * 0.45 }}
        >
          ▲
        </span>
      </div>
    </div>
  );
}

function PopEntity({ pop, cfg, scale }: { pop: CollectionPop; cfg: ArenaConfig; scale: number }) {
  const r = pop.kind === 'gem' ? cfg.gemRadius : cfg.coinRadius;
  const size = r * 2 * scale;

  return (
    <>
      {/* Outer div owns translate3d; inner div owns the animation. */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: size,
          height: size,
          transform: `translate3d(${(pop.x - r) * scale}px, ${(pop.y - r) * scale}px, 0)`,
        }}
      >
        <div
          className={cn(
            'animate-coin-pop',
            pop.kind === 'gem'
              ? 'bg-[hsl(var(--gem))] rotate-45 rounded-sm'
              : 'rounded-full bg-[hsl(var(--coin))]',
          )}
          style={{ width: size, height: size }}
        />
      </div>
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          transform: `translate3d(${(pop.x - 8) * scale}px, ${(pop.y - r * 2) * scale}px, 0)`,
        }}
      >
        <div
          className="font-pixel text-[hsl(var(--primary))] animate-point-added whitespace-nowrap"
          style={{ fontSize: Math.max(8, 10 * scale) }}
        >
          {pop.kind === 'gem' ? '+5' : '+1'}
        </div>
      </div>
    </>
  );
}
