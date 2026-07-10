# Session 12 — Blast Arena: 8-Player Support

**Goal:** Raise Blast Arena's player cap from 4 to 8 while keeping matches from ballooning in length. The 4-player cap was pacing, not tech: the engine already handles 8 colors, spawn spreading, turn rotation, and rankings.

**Prerequisites:** Session 11 (rematch + lobby config, merged to main 2026-07-10) — the lobby `RoomConfigPanel` now owns the max-players options alongside `CreateRoom`.

**Read first:** `design-system/habit-quest/pages/blast-arena.md`, `src/hooks/useBlastEngine.ts` (turn loop), `src/lib/blastTerrain.ts` (`spawnPositions`).

**Decisions locked with user (2026-07-10):** scale BOTH turn time and sudden-death round budget down with player count (not just one, not neither).

---

## Why the cap existed

- Turn loop: every alive unit gets a 30s turn per round; sudden death only after `BA_MAX_ROUNDS = 10` full rounds (`useBlastEngine.ts` ~line 419). At 8 players that is up to 80 turns ≈ 30-minute worst case with ~3.5-minute waits between own turns.
- Spawns: `spawnPositions` splits usable width (320 − 2×30 = 260px) into equal slots with ±25% jitter. At 8 players a slot is ~32px; two neighbors can land ~16px apart — inside one bazooka blast radius (12px).

## What to build

### 1. Lift the UI caps
- `src/pages/CreateRoom.tsx`: blast max-players options `[2, 3, 4]` → `[2, 3, 4, 6, 8]`; default stays `'4'`.
- `src/components/multiplayer/RoomConfigPanel.tsx`: same options in `maxPlayerOptions`; `gameHardCap('blast-arena')` → `8` (this also stops disabling the Blast option when 5+ players are in the lobby).

### 2. Scale turn pacing with player count
- New constants in `src/config/constants.ts` (all magic numbers live there — house rule):
  - `BA_TURN_TIME_BY_COUNT`: ≤4 players → 30 000ms, 5–6 → 20 000ms, 7–8 → 15 000ms.
  - `BA_MAX_ROUNDS_BY_COUNT`: ≤4 → 10, 5–6 → 7, 7–8 → 5.
- `useBlastEngine` gains `turnTimeMs?: number` and `maxRounds?: number` options (defaults `BA_TURN_TIME_MS` / `BA_MAX_ROUNDS`). Replace the internal uses (`turnEndsAtRef`, `setTurnTimeLeft`, the sudden-death check) with the options.
- `useMultiplayerBlast` derives both from `participants.length`; solo `BlastArena.tsx` passes nothing (2 units, unchanged).
- Determinism note: every client derives the same values from the same participant count — no new events, no seed impact. Host skip authority (`BA_SKIP_GRACE_MS`) is unchanged.

### 3. Guarantee spawn spacing
- In `spawnPositions` (`src/lib/blastTerrain.ts`), clamp jitter so adjacent spawns keep ≥24px (2× the largest weapon radius): `jitter = (rng() − 0.5) × Math.min(slot × 0.5, Math.max(0, slot − 24))`.
- No change at ≤4 players (slots ≥65px). Same seed → same positions on all clients. Solo replays change too — fine, positions are never persisted.

## Out of scope
- Canvas stays 320×180 — `BA_CANVAS_W/H` are baked into the deterministic sim, terrain gen, and integer-scaled rendering. Do not widen.
- No DB/migration changes (`max_players` is already an INT; blast ignores `question_count`/`time_limit_seconds`).

## Verify
1. `npm run lint` + `tsc --noEmit` + `npm run build`.
2. 8-chip player strip (it already `flex-wrap`s) at 375 / 768 / 1024 / 1440px — chips must not push the canvas off-screen.
3. Dev-drive an 8-unit world (temporarily seed 8 `unitInits` in solo) — spawn gaps ≥24px across several seeds, turn rotation order, sudden death kicks in at round 5, turn timer shows 15s.
4. Normal 2–3 tab multiplayer sanity pass (pacing unchanged at ≤4).
