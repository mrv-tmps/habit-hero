# Coin Rush — Design Spec

> Applies to: `/games/coin-rush` (solo), `/games/room/:code/play` (game_type = `coin-rush`)
> Overrides: MASTER.md §9 App Mode — the Coin Rush arena (solo **and** multiplayer) uses `data-mode="arcade"`, defined below in §1. Defers to `design-system/habit-quest/pages/multiplayer.md` for the lobby, CreateRoom, nickname overlay, results screen, and player-color tokens.

**Last updated:** 2026-06-26
**Reviewed against MASTER.md:** 2026-06-26

---

## 0. What this game is

A fixed single-screen 2D arena. Up to 8 players free-roam to collect coins; most points when the 90s clock hits zero wins. **Nobody is eliminated.** Moving saw-blade hazards briefly freeze you. There is a **solo** practice mode (beat-your-best, zero netcode) and a **multiplayer** mode (host-authoritative scoring over Supabase Realtime).

Both modes render the *same* arena and use the *same* movement/joystick/collision code. The only difference is the data source: solo generates everything from a local seed; multiplayer adds position broadcasts + host-arbitrated coin claims.

**Design north star:** the player's own avatar is always perfectly responsive (pure-local rAF). Everything decorative is suppressed in-arena (this is gameplay, not RPG chrome). Legible at 375px in portrait, one-handed.

---

## 1. Shared Coin Rush Principles

| Principle | Rule |
|---|---|
| **Arena is gameplay, not chrome** | Strip nav/header and all decorative glows inside the arena (`data-mode="arcade"`). The only color is functional: floor, walls, coins, gems, saws, player blobs. |
| **Player colors are CSS variables** | Reuse `--player-1`…`--player-8` from `multiplayer.md`. Solo player is always slot 1. Never raw hex/HSL in JSX. |
| **Positions live in refs, not state** | The rAF loop writes `transform: translate3d(...)` directly to element refs. **Never** `setState` per frame. React owns only discrete state: score, coins remaining, phase, stun flag. (MASTER §7 — animate transform/opacity only.) |
| **Color is never the only signal** | Coins vs gems differ by **size + shape** (small disc vs larger faceted gem), not just color. Players are labelled with a nickname, not color alone. (MASTER §13.) |
| **No emoji as icons** | HUD/menu icons are Lucide (`Coins`, `Gem`, `Timer`, `Trophy`, …). Coins/gems/saws in the arena are styled DOM shapes, not emoji. |
| **Mobile is first-class here** | Unlike Typing/Math (desktop-first w/ warning), Coin Rush is designed to be played in **portrait on a phone**. Joystick + 44px targets + tap-delay/overscroll guards are mandatory, not optional. |

### Player / arcade color tokens

`--player-1`…`--player-8` already exist (see `multiplayer.md §1`). Add these arena tokens to `src/index.css` `:root`:

```css
/* Coin Rush arena */
--arena-floor:  240 14% 7%;    /* play surface — slightly deeper than --background */
--arena-wall:   240 10% 25%;   /* boundary walls — matches --border */
--arena-grid:   240 10% 12%;   /* faint floor grid lines — matches --card */
--coin:         45 90% 55%;    /* common coin — matches --primary (gold) */
--coin-edge:    45 70% 40%;    /* coin rim for depth */
--gem:          270 70% 62%;   /* 5-pt gem — matches --accent (purple) */
--hazard:       0 75% 55%;     /* saw blade — matches --strength (red) */
--stun-flash:   0 75% 55%;     /* frozen-player tint */
```

Use as `bg-[hsl(var(--coin))]`, `bg-[hsl(var(--gem))]`, etc. Never write raw HSL in JSX.

### `data-mode="arcade"` CSS extension

Add to `src/index.css` alongside the existing `[data-mode="focused"]` and `[data-mode="multiplayer"]` blocks:

```css
[data-mode="arcade"] {
  background: hsl(var(--focused-bg));     /* deep bg, same as typing/multiplayer */
  overscroll-behavior: contain;           /* no accidental pull-to-refresh mid-game */
  touch-action: manipulation;             /* kill 300ms tap delay on mobile */
  -webkit-tap-highlight-color: transparent;
  user-select: none;                      /* dragging the joystick must not select text */
}
[data-mode="arcade"] header,
[data-mode="arcade"] nav {
  display: none;                          /* suppress app nav during play */
}
[data-mode="arcade"] .card-glow,
[data-mode="arcade"] .stat-glow-strength,
[data-mode="arcade"] .stat-glow-intelligence,
[data-mode="arcade"] .stat-glow-endurance {
  box-shadow: none;
  text-shadow: none;                      /* no decorative glow in active game */
}
```

Used by **both** the solo arena and the multiplayer arena. The lobby (`/games/room/:code`), CreateRoom, and results screen do **not** use it — they keep full RPG chrome per `multiplayer.md`.

### New keyframes

Add to `tailwind.config.ts` + `src/index.css`. All transform/opacity only (MASTER §7).

```css
@keyframes coin-pop {            /* coin collected */
  0%   { transform: scale(1);   opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
}
@keyframes gem-pulse {           /* gem on the field — draws the eye */
  0%, 100% { transform: scale(1);    }
  50%      { transform: scale(1.12); }
}
@keyframes stun-shake {          /* frozen avatar jitter */
  0%, 100% { transform: translate3d(var(--x), var(--y), 0); }
  25%      { transform: translate3d(calc(var(--x) - 2px), var(--y), 0); }
  75%      { transform: translate3d(calc(var(--x) + 2px), var(--y), 0); }
}
@keyframes countdown-pop {       /* 3-2-1 GO numbers */
  0%   { transform: scale(0.6); opacity: 0; }
  40%  { transform: scale(1);   opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}
```

```ts
// tailwind.config.ts — animation section
'coin-pop':      'coin-pop 300ms ease-out forwards',
'gem-pulse':     'gem-pulse 1.2s ease-in-out infinite',
'stun-shake':    'stun-shake 200ms ease-in-out infinite',
'countdown-pop': 'countdown-pop 900ms ease-out forwards',
```

### `prefers-reduced-motion`

Gameplay motion (your avatar, other avatars, saws, coin movement) is **functional** and is **not** disabled — turning it off would break the game. Only the *cosmetic flourishes* reduce. Add to the existing media block in `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-coin-pop,
  .animate-gem-pulse,
  .animate-stun-shake,
  .animate-countdown-pop { animation: none; }
}
```
(Collected coins still disappear, gems still spawn/expire, stun still freezes — just without the decorative pop/pulse/jitter.)

---

## 2. The Arena (shared by solo + multiplayer)

### Geometry

- **Logical coordinate space is fixed and seed-independent of screen size**: design the arena in a virtual unit box (e.g. `1000 × 1000` units for `medium`). All positions (avatars, coins, saws) are computed in virtual units, then scaled to the rendered pixel size with a single `scale` factor. This keeps the deterministic simulation identical across a phone and a laptop.
- **Aspect ratio: fixed.** Use a **square (1:1)** play field. On portrait phones it sits in the top portion of the screen; on desktop it's centered and larger. Letterbox with `--background`; never stretch.
- **Walls**: a `2`-unit border drawn in `--arena-wall`. Avatars clamp to the inner bounds (circle-vs-wall = clamp center to `[r, size-r]`). No wrap-around.
- **Floor**: `--arena-floor` with a faint grid (`--arena-grid`, 50-unit cells) for motion parallax — gives a sense of speed when you move. Grid is a static CSS background, not animated.
- **Difficulty scales the box**: Easy = smaller (less running), Hard = larger. The virtual unit box size is part of the difficulty config so the deterministic sim stays consistent.

### Layout — desktop (`lg+`)

```
┌───────────────────────────────────────────────┐
│  HUD top bar (z-10): code · Q-timer · my score │
├───────────────────────────────────────────────┤
│                                                 │
│            ┌───────────────────┐                │
│            │                   │                │
│            │   SQUARE ARENA    │   ← max 70vh   │
│            │   coins · gems    │      centered  │
│            │   saws · players  │                │
│            └───────────────────┘                │
│                                                 │
├───────────────────────────────────────────────┤
│  Scoreboard strip (z-10): all players' scores  │
└───────────────────────────────────────────────┘
```
Desktop input is **keyboard** (WASD + arrow keys). No on-screen joystick is shown on `lg+` (it appears only when a touch/coarse pointer is detected, via `@media (pointer: coarse)` or a touch-start listener).

### Layout — mobile portrait (base → `md`)

```
┌─────────────────────┐
│ HUD: timer · score  │  ← compact, z-10
├─────────────────────┤
│  ┌───────────────┐  │
│  │ SQUARE ARENA  │  │  ← fits viewport width
│  │               │  │
│  └───────────────┘  │
│  scoreboard chips   │  ← horizontal scroll
│                     │
│        ╭───╮        │  ← virtual joystick base,
│        │ ● │        │     z-20, bottom-center,
│        ╰───╯        │     thumb-reachable
└─────────────────────┘
```
- Arena width = `100vw − gap`. Scoreboard collapses to dot+number chips (`overflow-x-auto`).
- Joystick sits in the bottom ~30% so the thumb never covers the play field.

### Rendering the entities (DOM)

Every entity is an absolutely-positioned `<div>` inside a `position: relative` arena wrapper, moved with `transform: translate3d(xUnits*scale, yUnits*scale, 0)`.

| Entity | Markup | Size (virtual units) | Color |
|---|---|---|---|
| **Avatar** | `rounded-full` blob + squash-stretch on move; nickname label `font-sans text-xs` above, `truncate max-w-[64px]` | r ≈ 22 | `bg-[hsl(var(--player-N))]` |
| **Common coin** | small `rounded-full` disc, thin `--coin-edge` ring | r ≈ 12 | `--coin` |
| **Gem** | larger rotated square (`rotate-45 rounded-sm`), `animate-gem-pulse` | r ≈ 18 | `--gem` |
| **Saw** | `rounded-full` with a dashed conic/SVG edge, slow continuous `rotate` (decorative spin via `animate-[spin_1s_linear_infinite]`) | r ≈ 30 | `--hazard` |
| **Stunned avatar** | base blob tinted `--stun-flash`, `animate-stun-shake`, `opacity-70` | — | — |

- **Collection feedback**: when a coin is collected, swap it for a one-shot `animate-coin-pop` ghost element, then remove. A floating `+1` / `+5` (`animate-point-added`, already in MASTER §7) rises from the spot.
- **Own-avatar emphasis**: your blob has a 2px `ring-2 ring-[hsl(var(--player-N))]/60` and a small `▲` facing indicator so you can always find yourself.

### The rAF loop (shared)

```
on each frame (requestAnimationFrame):
  1. read input vector (joystick OR keys) → normalized dx,dy
  2. integrate own position (clamp to walls); apply stun lock (no move while frozen)
  3. write own transform to ref (no React state)
  4. interpolate every remote avatar toward its latest target (MP only)
  5. advance saw positions from deterministic clock (seed + elapsed)
  6. local collision checks:
       - own circle vs each coin/gem circle → claim (see §3 / §4)
       - own circle vs each saw circle (if not invulnerable) → self-stun
```
React re-renders only when the **set** of coins changes (one collected/spawned), when a **score** changes, when **stun** toggles, or when **phase** changes — never for movement.

---

## 3. Solo Mode (`/games/coin-rush`)

**Wrapper:** `data-mode="arcade"`, `min-h-screen flex flex-col`. Zero netcode.

### Pre-game (start card)
Full RPG chrome (no `data-mode` yet) — a centered `max-w-md` card:
- Title: game name `font-pixel text-xl` + `Coins` Lucide icon
- Difficulty `Select` (Easy / Medium / Hard) + round-length `Select` (60 / 90 / 120s) from constants
- Your current best (auth: from `game_sessions`; guest: from `localStorage`) shown as `font-mono text-sm text-muted-foreground`
- `Button` "Start" (full width) + a secondary `Button variant="outline"` "Play with friends →" → `/games/room/new?game=coin-rush`

### Active round
- Apply `data-mode="arcade"`. 3-2-1 `animate-countdown-pop` overlay (z-30) keyed off a local start timestamp, then arena goes live.
- **HUD top bar** (z-10, sticky): `Timer` icon + remaining seconds `font-mono text-sm text-primary` (pulses `animate-pulse-glow` ≤ 10s) · live score `font-mono text-sm` with a `Coins` icon.
- Coins/gems/saws all deterministic from a **locally generated seed** (`Math.random()`-seeded once at start). Self-replenishing population per §4 coin model.
- No scoreboard strip (solo). No position broadcasts.

### Results (solo)
Centered `max-w-sm` card (RPG chrome, no `data-mode`):
- `font-pixel text-lg` "Time!" + final score (`font-mono text-3xl text-primary`)
- "New best!" pill (`bg-primary text-primary-foreground`, `animate-titlePulse`) when beaten
- XP earned line (auth only) via existing `useGameSessions` save; guests see "Sign in to save your score and earn XP."
- CTAs: "Play Again" / "Play with friends" / "Back to Games"

### Persistence
- **Auth** → `useGameSessions` (`game_type: 'coin-rush'`, `score_wpm` = points, `accuracy: 100`), XP via the registry `xpFormula`, capped by `XP_PER_SESSION_CAP` / `DAILY_SESSION_CAP`. Optional `game_stat_mappings` link (`defaultStatType: 'dexterity'`).
- **Guest / anonymous** → high score in `localStorage` key `coin-rush-best`. No XP.

---

## 4. Coin & Hazard Model (shared)

### Coins (deterministic, self-replenishing)
- A seeded schedule maintains a **steady population** on the field (Easy ~15 / Med ~12 / Hard ~9). When a coin is removed (collected or, for gems, expired), the **next seeded coin** fades in at the next seeded position.
- **Common coin = 1 pt.** **Gem = 5 pts**, spawns on a seeded interval, lives `CR_GEM_LIFETIME_MS`, then expires (fades out) if uncollected. At most 1 gem on the field at a time.
- All clients (and the solo player) compute the identical schedule from `seed + start_at` → **zero spawn traffic** in multiplayer.

### Hazards (deterministic, no netcode)
- Saws patrol fixed lanes (back-and-forth or simple loops) computed from `seed + elapsed`. Count/speed by difficulty (Easy 2 slow / Med 3 / Hard 4 fast).
- **Collision is detected locally against your own avatar only** → instant **2s freeze** (`CR_STUN_MS`), then ~1s invulnerability (`CR_INVULN_MS`) so you don't re-stun on the same blade. **No point loss.**
- In multiplayer, a freeze sets a `stunned: true` flag piggybacked on the next `position_update` so others see you shake — purely cosmetic; the host does not arbitrate stuns.

### Constants to add (`src/config/constants.ts`)
```ts
export const CR_ROUND_OPTIONS = [60, 90, 120] as const;
export const CR_DEFAULT_ROUND = 90;
export const CR_DIFFICULTY = ['easy', 'medium', 'hard'] as const;
export const CR_POSITION_BROADCAST_MS = 100;   // 10 Hz remote-avatar sync
export const CR_COIN_VALUE = 1;
export const CR_GEM_VALUE = 5;
export const CR_STUN_MS = 2000;
export const CR_INVULN_MS = 1000;
export const CR_GEM_LIFETIME_MS = 6000;
// per-difficulty tables (population, saw count/speed, arena size, gem interval)
export const CR_DIFFICULTY_CONFIG = { /* easy|medium|hard → {...} */ } as const;
```
No raw numbers in JSX — all from here.

---

## 5. Multiplayer Mode (`/games/room/:code/play`, game_type = `coin-rush`)

**Wrapper:** `data-mode="arcade"`, `min-h-screen flex flex-col`. Lobby / CreateRoom / nickname overlay / results screen all reuse `multiplayer.md` (§2, §3, §6, §7) unchanged. CreateRoom gains a `coin-rush` config: difficulty + round length (no question-count option).

### Top bar (z-10, sticky)
- Left: room code `font-mono text-xs text-muted-foreground`
- Center: `Timer` + remaining seconds `font-mono text-sm text-primary`; `animate-pulse-glow` ≤ 10s
- Right: your score `font-mono text-sm` + `Coins` icon

### Arena
Identical to §2. Remote avatars interpolate from `position_update` (10 Hz). Coin claims are host-arbitrated (below). Saws/coins are deterministic — no traffic.

### Scoreboard strip (bottom, z-10)
Reuse the math scoreboard pattern (`multiplayer.md §4`): horizontal `overflow-x-auto`, one chip per player = colored dot + `font-sans text-sm` nickname + `font-pixel text-xs` score; leader gets `ring-1 ring-primary`. Update on every `coin_collected`. `aria-live="polite"` on the strip so score changes are announced.

### Netcode events (add to `MultiplayerEvent` in `src/types/multiplayer.ts`)
```ts
| { type: 'position_update'; nickname: string; x: number; y: number; stunned: boolean }
| { type: 'coin_claimed';    coin_id: number; nickname: string }   // client → host
| { type: 'coin_collected';  coin_id: number; nickname: string }   // host → all
```
Reuse existing `game_start { seed, start_at }`, `game_end { rankings }`, and the host-finalize flow.

**Flow (carbon copy of the math buzzer authority model):**
1. `game_start` carries `seed` + a `start_at` ~3s in the future → all clients run the synced 3-2-1, then the same deterministic coin/saw clock.
2. Your avatar moves locally; you broadcast `position_update` every `CR_POSITION_BROADCAST_MS`, throttled via `useRef` (same technique as typing-race 250ms progress).
3. On local coin overlap you broadcast `coin_claimed { coin_id, nickname }`.
4. **Host only**: first claim for a `coin_id` wins (dedup via a processed-set, mirroring `processedClaimRef`); host increments score, broadcasts `coin_collected`. All clients remove that coin + update the scoreboard. Lost claims = coin vanishes ("missed it").
5. Round ends when the synced clock hits the limit → **host** builds rankings, broadcasts `game_end`, calls `finalizeResults`. Clients show the shared results screen (`multiplayer.md §6`).

### Scoring / XP
- Score = (commons × `CR_COIN_VALUE`) + (gems × `CR_GEM_VALUE`), stored in `score_wpm`.
- XP = `floor(score / 10)` × position multiplier (`MP_XP_MULTIPLIER_*`), clamped by `XP_PER_SESSION_CAP` / `DAILY_SESSION_CAP`, auth-only — verbatim from `useMultiplayerMath`.
- **Tie-break: more gems collected ranks higher**, then arbitrary (track a per-player gem counter alongside score).

---

## 6. Input — Virtual Joystick + Keyboard

| Aspect | Rule |
|---|---|
| **When shown** | Joystick renders only on coarse pointers (`@media (pointer: coarse)` or first `touchstart`). Desktop uses keys, no joystick. |
| **Base / thumb** | Base `w-28 h-28 rounded-full bg-secondary/40 border border-border`; thumb `w-14 h-14 rounded-full bg-primary/80`. Thumb ≥ 44×44px touch target (MASTER §13). |
| **Placement** | `absolute bottom-6 left-1/2 -translate-x-1/2` (or bottom-right for right-handers — bottom-center is the safe default), z-20. |
| **Behavior** | On `touchstart` within the base, capture origin; thumb follows finger clamped to base radius; output = normalized vector → feeds the rAF loop. Release → vector zero, thumb springs to center. |
| **Keys** | WASD + arrow keys map to the same vector (diagonals normalized). `preventDefault` on arrows so the page doesn't scroll. |
| **Accessibility** | Joystick container `role="application"` + `aria-label="Movement joystick"`. Keyboard play is fully supported on desktop. The game is real-time/motor by nature — document this limitation rather than faking a non-realtime fallback. |
| **No tap delay** | `touch-action: manipulation` (set by `data-mode="arcade"`); the joystick element also sets `touch-action: none` so dragging never scrolls the page. |

---

## 7. Z-Index (from MASTER §6 scale)

| Layer | z | Notes |
|---|---|---|
| Arena entities | (flow) | within the relative arena wrapper |
| HUD top bar, scoreboard strip | `z-10` | sticky |
| Virtual joystick, mobile warning | `z-20` | don't overlap (joystick bottom, warning top) |
| 3-2-1 countdown, results overlay | `z-30` | modal tier |
| Toasts | `z-50` | unchanged |

---

## 8. Registry entry (`src/config/games.ts`)

```ts
{
  id: 'coin-rush',
  label: 'Coin Rush',
  description: 'Grab the most coins before the clock runs out.',
  icon: Coins,                       // Lucide
  route: '/games/coin-rush',         // solo
  status: 'live',
  defaultStatType: 'dexterity',
  xpFormula: (score) => Math.min(Math.floor(score / 10), XP_PER_SESSION_CAP),
  sessionCapPerDay: DAILY_SESSION_CAP,
  xpCapPerSession: XP_PER_SESSION_CAP,
  multiplayerRoute: '/games/room/new?game=coin-rush',
  multiplayerGameType: 'coin-rush',
}
```
`GameType` union (`src/types/multiplayer.ts`) and the `game_type` enums on `multiplayer_rooms` / `game_sessions` gain `'coin-rush'`. **No new DB columns** — coins/hazards are fully deterministic from `seed`.

---

## 9. Checklist — Alignment with MASTER.md & multiplayer.md

- [ ] No emoji as icons — Lucide only (`Coins`, `Gem`, `Timer`, `Trophy`, `Medal`, `Award`, `MonitorSmartphone`)
- [ ] No raw hex/HSL in JSX — all via tokens (`--player-N`, `--coin`, `--gem`, `--hazard`, `--arena-*`)
- [ ] Movement written to refs in rAF — **no `setState` per frame**; React owns only score/coins/stun/phase
- [ ] Only `transform`/`opacity` animated; new keyframes registered in `tailwind.config.ts` + covered by `prefers-reduced-motion`
- [ ] Gameplay motion NOT disabled by reduced-motion; only cosmetic pops/pulses are
- [ ] `data-mode="arcade"` block added to `src/index.css` (nav hidden, glows suppressed, `touch-action`/`overscroll-behavior` set)
- [ ] Arena/coin/gem/hazard tokens added to `:root`
- [ ] `font-pixel` only for titles + score numbers; `font-sans` for nicknames/labels; `font-mono` for room code/timer/score readouts
- [ ] Joystick thumb ≥ 44×44px; `touch-action: none` on the stick; ≥ 8px gap from other controls
- [ ] Color never the only signal — coin vs gem differ by size/shape; players labelled by nickname
- [ ] Icon-only buttons have `aria-label`; joystick has `role="application"` + `aria-label`; scoreboard `aria-live="polite"`
- [ ] Z-index from the defined scale only
- [ ] All interactive elements have `cursor-pointer`; focus rings visible (shadcn `--ring`)
- [ ] No raw numbers in JSX — all from `constants.ts` (`CR_*`)
- [ ] Responsive tested at 375px · 768px · 1024px · 1440px; **portrait phone is a first-class target**; no horizontal scroll
