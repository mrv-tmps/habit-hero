# Session 5 — Coin Rush: Solo Core

**Goal:** Build the entire Coin Rush *feel* with zero netcode — a fixed single-screen 2D arena where one player steers a blob to collect coins/gems and dodge saws against a 90s clock, then beats their best. This proves movement, joystick, deterministic coins/hazards, collision, and the arena rendering. Multiplayer (Session 6) layers networking on top of this exact code.

**Prerequisite:** None for the engine itself, but it lives in the existing games infrastructure:
- `src/config/games.ts` (registry), `src/config/constants.ts`
- `src/hooks/useGameSessions.ts` (solo save), `src/contexts/AuthContext.tsx`
- Player color tokens `--player-1`…`--player-8` already in `src/index.css` (from multiplayer work)

**Read first:** `design-system/habit-quest/pages/coin-rush.md` (the spec) + `CLAUDE.md` + MASTER.md §7/§9/§13.

---

## Game rules (decided in design session)

- Fixed **square** single-screen arena, scaled to fit any viewport; portrait phone is first-class.
- **Your own avatar is pure-local rAF** — always perfectly responsive. Positions written to refs via `transform: translate3d`, **never `setState` per frame**.
- Coins/gems/saws are **deterministic from a single local seed + elapsed time** (so Session 6 can swap the local seed for a shared one with no logic change).
- Self-replenishing coin population (Easy ~15 / Med ~12 / Hard ~9). Common coin = 1 pt; gem = 5 pts, ≤1 on field, expires after `CR_GEM_LIFETIME_MS`.
- Saws patrol seeded lanes (Easy 2 slow / Med 3 / Hard 4 fast). Touch = **2s freeze + 1s invuln, no point loss**.
- Round length 60/90/120s (default 90). 3-2-1 countdown before play.
- Auth → save to `game_sessions` + XP (caps). Guest → `localStorage` best, no XP.

---

## What to build

### 1. `src/config/constants.ts` — add the `CR_*` block
Per spec §4: `CR_ROUND_OPTIONS`, `CR_DEFAULT_ROUND`, `CR_DIFFICULTY`, `CR_COIN_VALUE`, `CR_GEM_VALUE`, `CR_STUN_MS`, `CR_INVULN_MS`, `CR_GEM_LIFETIME_MS`, `CR_POSITION_BROADCAST_MS` (unused until S6, define now), and `CR_DIFFICULTY_CONFIG` (per-difficulty: arena unit size, coin population, saw count + speed, gem interval, avatar speed).

### 2. `src/lib/coinRushArena.ts` — pure deterministic simulation
Mirror `mathQuestions.ts`: a pure, seedable module. **No React, no side effects.** Reuse the `mulberry32` PRNG from `mathQuestions.ts`.

```ts
export interface ArenaConfig { size: number; coinPopulation: number; sawCount: number; sawSpeed: number; gemIntervalMs: number; avatarSpeed: number; }
export interface Coin   { id: number; x: number; y: number; kind: 'coin' | 'gem'; spawnAt: number; expireAt: number | null; }
export interface Saw    { id: number; /* lane params */ }

export function getArenaConfig(difficulty: Difficulty): ArenaConfig;
export function getInitialCoins(seed: number, cfg: ArenaConfig): Coin[];
export function nextCoin(seed: number, cfg: ArenaConfig, replacedIndex: number, elapsedMs: number): Coin;  // deterministic replacement
export function sawPositionAt(saw: Saw, elapsedMs: number, cfg: ArenaConfig): { x: number; y: number };    // pure fn of time
export function getSaws(seed: number, cfg: ArenaConfig): Saw[];
```
Key invariant: **every function is a pure function of `(seed, config, time)`** — given the same inputs, identical output on any machine. This is what makes Session 6's "no spawn traffic" possible.

### 3. `src/hooks/useCoinRushEngine.ts` — the shared game engine
The reusable core consumed by BOTH solo (this session) and multiplayer (Session 6). Owns the rAF loop, input, collision, and the coin/saw state.

```ts
interface UseCoinRushEngineArgs {
  seed: number;
  difficulty: Difficulty;
  durationMs: number;
  startAt: number;                 // epoch ms; countdown runs until this
  onCoinClaim?: (coinId: number, kind: 'coin'|'gem') => boolean; // return true if the claim is awarded (solo: always true; MP: host-arbitrated)
  arenaRef: RefObject<HTMLElement>;
}
interface UseCoinRushEngineReturn {
  phase: 'countdown' | 'active' | 'done';
  coins: Coin[];                    // current field (changes only on collect/spawn)
  saws: Saw[];
  score: number;
  gemCount: number;
  stunned: boolean;
  timeRemaining: number;
  ownPosRef: MutableRefObject<{x:number;y:number}>;  // read by the renderer's rAF
  setInputVector: (dx: number, dy: number) => void;  // joystick/keys feed this
  registerAvatarEl: (el: HTMLElement | null) => void;// engine writes transform here
}
```
- rAF loop per spec §2: integrate own position (clamp to walls, locked while stunned) → write transform to the avatar el → advance saws from `sawPositionAt` → local collision (coins → `onCoinClaim`; saws → self-stun + invuln window).
- `setState` ONLY when the coin set changes, score changes, stun toggles, or phase changes.
- Solo passes `onCoinClaim = () => true`.

### 4. `src/components/coinrush/Arena.tsx` — the renderer
- `position: relative` square wrapper sized to `min(100vw - gap, 70vh)`; entities are absolutely-positioned divs (spec §2 table).
- Avatar, coins (disc), gems (rotated square, `animate-gem-pulse`), saws (spinning red disc), stun tint + `animate-stun-shake`.
- Coin collected → `animate-coin-pop` ghost + `animate-point-added` floating `+1`/`+5`.
- Own avatar: `ring-2` + facing `▲`.

### 5. `src/components/coinrush/Joystick.tsx` — virtual stick
Per spec §6. Shown on coarse pointers only. `touch-action: none`, thumb ≥ 44px, `role="application"` + `aria-label`. Outputs a normalized vector → `setInputVector`. Also wire a `useEffect` keyboard handler (WASD/arrows, `preventDefault` on arrows) in the page.

### 6. `src/pages/CoinRush.tsx` — solo page
- Start card (RPG chrome): difficulty + round-length `Select`s, current best, "Start" + "Play with friends →" (`/games/room/new?game=coin-rush`).
- On Start: set `data-mode="arcade"`, pick a local `seed = Math.floor(Math.random()*2**31)`, `startAt = Date.now() + 3000`; render `<Arena>` + `<Joystick>` + HUD (Timer + score).
- 3-2-1 `animate-countdown-pop` overlay (z-30).
- On `phase==='done'`: results card (spec §3) — final score, "New best!" pill if beaten, XP line (auth), CTAs.

### 7. Persistence
- Auth → `useGameSessions` save (`game_type:'coin-rush'`, `score_wpm`=score, `accuracy:100`), XP via registry formula + caps. Best = max session score.
- Guest/anon → `localStorage` `coin-rush-best`.

### 8. Registry + routing
- Add the `coin-rush` entry to `src/config/games.ts` (spec §8).
- Add route `/games/coin-rush` → `CoinRush.tsx` in `App.tsx` (public, no guard — like typing/math).
- Add `data-mode="arcade"` CSS block + arena tokens + new keyframes to `src/index.css` and `tailwind.config.ts` (spec §1).
- Add `'coin-rush'` to the `GameType` union in `src/types/multiplayer.ts`.

---

## Design reference
`design-system/habit-quest/pages/coin-rush.md` — all sections (esp. §1 tokens/keyframes, §2 arena, §3 solo, §4 coin model, §6 joystick).
`MASTER.md` — §7 animation, §9 app/focused mode, §13 checklist.

---

## Definition of done
- [ ] Arena renders a square that fits 375px portrait with no horizontal scroll, and scales up on desktop
- [ ] Avatar moves smoothly via joystick (touch) and WASD/arrows (keyboard); own movement has zero perceptible lag
- [ ] Coins collect on contact with a pop + floating `+1`; gems give `+5` and pulse/expire
- [ ] Touching a saw freezes for 2s (shake), then 1s invuln; no points lost
- [ ] 3-2-1 countdown, 90s round, then results with final score
- [ ] Same seed + difficulty produces an identical coin/saw layout on reload (determinism proven)
- [ ] Auth users' best score saved to `game_sessions` with XP; guests' best in `localStorage`
- [ ] No `setState` in the rAF loop (verify via React DevTools — re-renders only on discrete events)
- [ ] `prefers-reduced-motion` disables cosmetic pops but gameplay still works
- [ ] No raw hex/HSL or raw numbers in JSX; no emoji icons; no TypeScript errors
- [ ] Tested at 375px · 768px · 1024px · 1440px
