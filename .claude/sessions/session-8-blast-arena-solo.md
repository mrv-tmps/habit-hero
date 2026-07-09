# Session 8 — Blast Arena: Solo Core

**Goal:** Build the entire artillery game *feel* with zero netcode — a canvas-rendered, pixel-art 2D map with destructible terrain where the player fights one AI bot turn-by-turn: walk, slingshot-aim, fire, explosion carves terrain, HP drops, last unit standing wins. Multiplayer (Session 9) swaps the AI for remote players on top of this exact deterministic engine.

**Prerequisite:** None for the engine. Lives in existing games infrastructure:
- `src/config/games.ts`, `src/config/constants.ts`
- `src/hooks/useGameSessions.ts` (solo save), `src/contexts/AuthContext.tsx`
- Player color tokens `--player-1`…`--player-8` in `src/index.css`

**Read first:** `design-system/habit-quest/pages/blast-arena.md` (the spec) + `CLAUDE.md` + MASTER.md §7/§9/§13.

---

## Game rules (decided in design spec)

- Internal canvas resolution **320×180**, integer-scaled with `image-rendering: pixelated` — this IS the pixel-art look; no sprite assets in v1.
- One unit per player, 100 HP. Turn = `BA_TURN_TIME_MS` (30s): limited walk (stamina bar), aim via slingshot drag, fire one shot.
- 3 weapons: Bazooka (ballistic, wind), Grenade (bounces, 3s fuse, no wind), Boot (melee knockback). See spec §5 for damage/radius.
- Terrain = seeded 1-bit `Uint8Array` map; explosions carve circles from both the bitmap and the offscreen render canvas.
- Wind seeded per turn via `windAt(seed, turnIndex)`.
- Sudden death after `BA_MAX_ROUNDS` (default 10): −10 HP per player per round.
- Auth win → `game_sessions` save (`score_wpm` = damage dealt) + XP with caps; guest → `localStorage` best.

---

## What to build

### 1. `src/config/constants.ts` — `BA_*` block
`BA_TURN_TIME_MS`, `BA_MAX_ROUNDS`, `BA_UNIT_HP`, `BA_WALK_STAMINA_PX`, `BA_GRAVITY`, `BA_WIND_MAX`, `BA_SIM_STEP_HZ` (60), `BA_CANVAS_W` (320), `BA_CANVAS_H` (180), `BA_WEAPONS` (per-weapon damage / radius / restitution / fuse / windAffected — spec §5), `BA_DIFFICULTY_CONFIG` (AI aim error stddev + weapon-choice quality per easy/medium/hard).

### 2. `src/lib/blastTerrain.ts` — seeded terrain
Pure module, reuse `mulberry32` from `mathQuestions.ts`.
```ts
export function generateTerrain(seed: number): Uint8Array;          // 320*180 solidity map, midpoint-displacement heightline
export function carveCircle(terrain: Uint8Array, x: number, y: number, r: number): void;
export function isSolid(terrain: Uint8Array, x: number, y: number): boolean;
export function surfaceYAt(terrain: Uint8Array, x: number): number; // for spawn placement
export function spawnPositions(seed: number, terrain: Uint8Array, count: number): {x: number; y: number}[]; // spread apart, on surface
```

### 3. `src/lib/blastSim.ts` — deterministic shot simulation
Pure module. **Critical invariant (spec §4): no `Math.sin/cos/pow` inside the step loop** — trig happens once at input encoding; the shooter's `{vx, vy}` is the payload. Sim = fixed 60Hz integration of gravity + wind + bounce, terrain pixel collision, explosion on impact/fuse.
```ts
export interface ShotInput { weapon: WeaponId; x: number; y: number; vx: number; vy: number; }
export interface SimFrame { x: number; y: number; t: number; }            // for animation playback
export interface ShotResult { frames: SimFrame[]; explosionAt: {x,y} | null; carves: Carve[]; damage: Record<UnitId, number>; knockback: Record<UnitId, {dx,dy}>; }
export function simulateShot(input: ShotInput, terrain: Uint8Array, units: UnitState[], wind: number): ShotResult;
export function windAt(seed: number, turnIndex: number): number;
export function settleUnits(terrain: Uint8Array, units: UnitState[]): UnitState[]; // fall to surface after carve/knockback
```
Same function drives the trajectory preview (truncate to ~20 frames) so preview always matches reality.

### 4. `src/hooks/useBlastEngine.ts` — shared game engine
Consumed by solo (this session) and multiplayer (Session 9). Owns phase machine, turn state, HP, terrain ref, and shot playback.
```ts
interface UseBlastEngineArgs {
  seed: number;
  units: { id: string; nickname: string; colorIndex: number; isLocal: boolean }[];
  onShotCommitted?: (input: ShotInput, turnIndex: number) => void;  // solo: no-op; MP: broadcast
  onTurnResolved?: (hp: Record<string, number>, turnIndex: number) => void; // MP host reconciliation hook
}
interface UseBlastEngineReturn {
  phase: 'countdown' | 'aiming' | 'projectile' | 'done';
  turnIndex: number; activeUnitId: string;
  units: UnitState[];                    // hp, x, y — discrete updates only
  wind: number; turnTimeLeft: number; winner: UnitState | null;
  commitShot: (input: ShotInput) => void;  // local player fires
  applyRemoteShot: (input: ShotInput) => void; // Session 9 uses this; solo AI uses it too
  walk: (dir: -1 | 1) => void; staminaLeft: number;
  selectedWeapon: WeaponId; setWeapon: (w: WeaponId) => void;
  registerCanvas: (el: HTMLCanvasElement | null) => void;
}
```
- rAF only animates shot playback (replaying `ShotResult.frames`) and idle rendering; React state changes only on discrete events (turn change, HP change, phase). No `setState` per frame.
- Renderer draws: sky, terrain offscreen canvas, units (procedural 8×10 pixel bodies in `--player-N` colors, HP bar above), wind arrow, trajectory preview while dragging.
- Canvas colors sampled from CSS tokens once at mount via `getComputedStyle` (spec §2 escape hatch).

### 5. `src/lib/blastAi.ts` — the solo opponent
Simple and honest: candidate-search AI. Sample ~30 random `(angle, power)` candidates, run `simulateShot` on each, pick the one landing closest to the player, then add Gaussian aim error scaled by difficulty (`BA_DIFFICULTY_CONFIG`). Grenade if player is behind cover (direct line blocked), else bazooka; boot if adjacent. Runs synchronously in a ~1s "thinking" delay so turns feel natural. Feeds `applyRemoteShot`.

### 6. `src/components/blast/` — UI around the canvas
- `BlastCanvas.tsx` — the scaled canvas wrapper (integer scale to fit `min(100vw - gap, 60vh)` while keeping 16:9; `image-rendering: pixelated`; `touch-action: none`), pointer handlers for slingshot drag (pointer events unify mouse + touch).
- `BlastHud.tsx` — DOM overlay: turn banner ("Your turn" / "<nickname>'s turn"), turn timer, wind indicator, weapon pills (Bazooka/Grenade/Boot, `1/2/3` hotkeys), mobile ◀ ▶ walk buttons (≥44px) + stamina bar.

### 7. `src/pages/BlastArena.tsx` — solo page
- Start card (RPG chrome): difficulty select, current best (wins), "Start" + "Play with friends →" (`/games/room/new?game=blast-arena`).
- On start: `data-mode="arcade"`, local `seed`, 3-2-1 `animate-countdown-pop`, then engine with `[localPlayer, aiBot]`.
- On `phase==='done'`: results card — Victory/Defeat, damage dealt, XP line (auth), CTAs (rematch / hub).

### 8. Persistence, registry, routing
- Auth → `useGameSessions` save (`game_type: 'blast-arena'`, `score_wpm` = damage dealt, `accuracy: 100`), XP `floor(damage/10)` capped; only wins award XP.
- Guest → `localStorage` `blast-arena-best`.
- `GAMES` entry (icon `Bomb`, `defaultStatType: 'strength'`), route `/games/blast-arena` in `App.tsx` (public, no guard), `'blast-arena'` added to `GameType` union, `--ba-*` tokens added to `src/index.css` (spec §2).

---

## Design reference
`design-system/habit-quest/pages/blast-arena.md` — all sections (esp. §2 rendering, §4 determinism, §6 controls).
`MASTER.md` — §7 animation, §9 modes, §13 checklist.

---

## Definition of done
- [ ] Canvas renders pixel-crisp at an integer scale on 375px portrait (no horizontal scroll) and desktop
- [ ] Slingshot drag shows a dotted trajectory preview; the fired shot follows the preview exactly
- [ ] Bazooka arcs with wind; grenade bounces then explodes on fuse; boot knocks the adjacent enemy back
- [ ] Explosions visibly carve terrain; units standing over a carve fall to the new surface
- [ ] Walk consumes stamina, climbs shallow slopes, blocked by walls
- [ ] AI takes plausible shots; easy misses often, hard rarely
- [ ] Turn timer auto-skips at 0; sudden death drains HP after max rounds
- [ ] Same seed reproduces the identical terrain and wind sequence on reload
- [ ] `simulateShot` has no trig/`Math.pow` in its step loop (grep it)
- [ ] No `setState` inside rAF; re-renders only on discrete events
- [ ] Auth win saves session + XP with caps; guest best in `localStorage`; results screen prompts sign-in for anons
- [ ] No raw hex in JSX/TS (canvas samples tokens); no emoji icons; lint + `tsc` clean
- [ ] Tested at 375px · 768px · 1024px · 1440px
