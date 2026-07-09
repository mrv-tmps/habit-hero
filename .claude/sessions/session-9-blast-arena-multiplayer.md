# Session 9 — Blast Arena: Multiplayer

**Goal:** Layer 2–4 player online turn-based combat on top of the Session 8 engine using the existing room infrastructure. Because the sim is deterministic, netcode is tiny: broadcast one `shot_fired` event per turn, every client replays the identical simulation, host reconciles outcomes.

**Prerequisites:** Session 1 (multiplayer infrastructure) and Session 8 (solo engine) complete.

**Read first:** `design-system/habit-quest/pages/blast-arena.md` §7–§9 + `src/hooks/useMultiplayerMath.ts` (the pattern to mirror) + `CLAUDE.md`.

---

## Netcode model (decided in design spec §7)

- Turn order = participant `created_at` order (same list every client already has).
- Active player's client is the only one accepting input; on fire it broadcasts `shot_fired { turnIndex, weapon, x, y, vx, vy }` — trig already resolved into `vx/vy` by the shooter, so all clients' sims are bit-identical.
- Every client feeds the event into `applyRemoteShot` and watches the same explosion.
- **Host-authoritative safety net:** after resolving, host broadcasts `turn_resolved { turnIndex, hp, nextTurnNickname }`; clients overwrite local HP with host values (expected zero drift).
- Host enforces the turn timer: no shot in `BA_TURN_TIME_MS` → `turn_skipped { turnIndex }`.
- Disconnects: existing host-promotion trigger handles host loss; a departed player's unit is skipped and killed on its next turn (host decides, announces via `turn_resolved`).

---

## What to build

### 1. `src/types/multiplayer.ts` — new events
```ts
| { type: 'shot_fired'; turn_index: number; weapon: WeaponId; x: number; y: number; vx: number; vy: number }
| { type: 'turn_resolved'; turn_index: number; hp: Record<string, number>; next_turn_nickname: string }
| { type: 'turn_skipped'; turn_index: number }
```
(`game_start`/`player_ready`/`game_begin`/`game_end` reused as-is.)

### 2. `src/hooks/useMultiplayerBlast.ts`
Mirror `useMultiplayerMath.ts`: combine `useMultiplayerRoom` + `useRealtimeRoom` + `useBlastEngine`.
- Ready-gate → 3-2-1 synced countdown (`start_at` from `game_start`) → turn loop → done.
- Wire engine callbacks: `onShotCommitted` → broadcast `shot_fired`; incoming `shot_fired` → `applyRemoteShot`; host's `onTurnResolved` → broadcast `turn_resolved`; non-host reconciles.
- Host dedups (`processedClaimRef` pattern, keyed by `turn_index`) and runs the skip timer.
- End: last unit standing (or all-but-one disconnected) → host builds rankings ordered by elimination order (winner 1st, last eliminated 2nd, …), `finalizeResults`, `game_end`.
- XP: verbatim math model — `floor(damageDealt / 10)` × position multiplier (1.5/1.25/1), session + daily caps, auth-only, save to `game_sessions`.
- **Remember the Session 2 lesson:** every function returned by `useMultiplayerRoom` is `useCallback([])`-stable; never omit from effect deps.

### 3. `src/pages/MultiplayerBlast.tsx`
- Reuse shared `ReadyScreen` + `MultiplayerResults` (`title`/`subtitle`/`scoreUnit: 'dmg'` props).
- Game screen = Session 8's `BlastCanvas` + `BlastHud` plus: sticky player strip (nickname, `--player-N` color chip, HP bar, skull on elimination, crown/arrow on active turn), "waiting for <nickname>…" state while it's not your turn (input disabled, spectate the shot).
- `data-mode="arcade"` (+ `data-mode="multiplayer"` conventions where the shared components expect it).

### 4. Room creation & routing
- `CreateRoom.tsx`: `blast-arena` option → difficulty select, `max_players` capped at 4 for this game type. No new DB columns (seed drives terrain + wind + spawns).
- `MultiplayerGame.tsx` router: branch `game_type === 'blast-arena'` → `MultiplayerBlast`.
- `GAMES` registry entry gains `multiplayerRoute` + `multiplayerGameType: 'blast-arena'`; DB `game_type` CHECK constraint migration if one exists (verify in `supabase/migrations/` — typing added columns via migration, check whether game_type is constrained).

---

## Definition of done
- [ ] 2 browsers: create room, ready-gate, synced countdown, identical terrain renders on both
- [ ] Shooter's shot replays identically on the other client (same explosion, same carve, same damage numbers)
- [ ] Turn passes automatically; non-active client cannot aim/fire/walk
- [ ] Turn timer expiry skips the turn on all clients
- [ ] Closing one tab mid-game: game continues, departed unit dies on its next turn, host promotion works if host left
- [ ] Winner/rankings correct; XP saved with position multipliers + caps for auth players only
- [ ] 3–4 player room works (turn rotation, player strip, colors)
- [ ] Works on mobile (touch slingshot) vs desktop (mouse) in the same room
- [ ] Lint + `tsc` clean; tested at 375px · 768px · 1024px · 1440px
- [ ] `supabase db push` run against hosted project if a migration was added
