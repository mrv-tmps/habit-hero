# Session 15 — Blast Arena: Bonus Weapon Crates + Post-Fire Movement

**Goal:** Wild Ones-style supply drops — crates parachute in at seeded times/locations and grant a one-use game-changer weapon to whoever walks into them — plus the freedom to keep moving after firing while turn time and stamina remain. Kept deliberately simple for v1: no shop, no currency, crates only.

**Prerequisites:** Session 13 (jump, ballistic knockback, fall damage, hazard, structures) — pickup movement uses jump/walk; crates must interact with carves and hazard. Session 14 (themes) is independent; 15 can run before or after it.

**Read first:** `src/hooks/useBlastEngine.ts` (`applyShotResult` → `advanceTurn` ~line 510 — the turn currently ends the instant playback finishes; `turn_resolved` reconciliation), `src/lib/blastSim.ts` (`BA_WEAPONS` config schema — boot proves any single-projectile weapon is just a config entry), Session 9 fix notes in `docs/SESSIONS.md` (why turn boundaries are host-authoritative).

**Why these two features share a session:** mid-turn movement is local-only — remote clients learn your position from the shot payload. Post-fire movement happens *after* that payload is sent, and crate pickups happen mid-walk; both need the same new machinery: the active player reports position/pickup, and the host folds it into the authoritative `turn_resolved`. Build it once.

---

## What to build

### 1. Post-fire movement (reposition window)
- New constants: `BA_POST_FIRE_MOVE_MS` (~5000 cap) — the window is `min(BA_POST_FIRE_MOVE_MS, remaining turn time)` and only opens if the shooter has stamina left.
- Engine: after local shot playback resolves, do **not** advance the turn yet for the local shooter — enter a `reposition` sub-phase: walking and jumping stay enabled (existing stamina rules), aiming/firing disabled, small "MOVE!" HUD hint + countdown. The window ends early when stamina hits 0 or the player presses the fire key / a "Done" button.
- Netcode: when the window closes, the shooter broadcasts a new `move_done { turn_index, x, y }` event. The **host** waits for `move_done` (or the window timeout + existing `BA_SKIP_GRACE_MS`) before building/broadcasting `turn_resolved`, and uses the reported position for the shooter. Non-host clients animate the shooter walking to `x,y` (simple lerp — or snap, matching today's convention for others' movement).
- Fall/hazard rules apply during repositioning (Session 13 physics): walking off a ledge takes fall damage; into water = KO. These resolve in the host's `turn_resolved` as usual.
- Timer pacing: the reposition window eats into the same turn clock (it is `min(...remaining turn time)`), so Session 12's per-count turn budgets are unaffected — a turn never exceeds its normal deadline + grace.
- Solo: same window vs the AI; AI itself does not reposition (fires and ends turn) for v1.

### 2. Crate drops
- **Schedule + placement (no events needed):** crates spawn deterministically from the room seed — every client computes the same schedule. New constants: `BA_CRATE_INTERVAL_ROUNDS` (~2: at the start of every 2nd round), `BA_CRATE_MAX_ACTIVE` (2). Spawn column = seeded pick of a valid land column (`surfaceYAt` above `hazardY`, not inside rock, ≥12px from any unit's current... **no** — unit positions drift; use terrain-only validity so placement is a pure function of `(seed, roundIndex, terrain)`; terrain state at round start is identical on all clients).
- **Falling:** crate parachutes down from y=0 to the surface over ~1.5s (render-only animation; the crate's *logical* resting position is computed instantly and deterministically).
- **Contents:** seeded weapon pick from the bonus pool. v1 bonus weapons are **plain `BA_WEAPONS` entries** with a `bonus: true` flag — they reuse the entire existing sim path (the boot precedent):
  - `nuke` — bazooka-type, radius ~28, damage ~60, wind-affected, carves. The screen-clearer.
  - `barrel` — grenade-type, radius ~18, damage ~50, high restitution (rolls/bounces downhill before the fuse pops).
  - (Tornado/teleport-style weapons need new sim mechanics — explicitly v2.)
- **Pickup:** during the local player's own movement (pre-shot walk, jump, or the §1 reposition window), if the unit overlaps a live crate (~6px), the client claims it: broadcast `crate_picked { crate_id, turn_index, by_id }`. All clients remove the crate and grant the weapon. First claim wins; the host ignores/overrides double-claims via resolution (below).
- **Reconciliation:** add `crates: { id, x, y, weapon }[]` (live crates) and per-unit `bonus_weapon: string | null` to the host's `TurnResolution` so any missed `crate_picked` self-heals at the next turn boundary, same pattern as hp/positions.
- **Destruction:** an explosion whose carve circle overlaps a crate destroys it (small pop FX, no damage). Checked deterministically during shot resolution.
- **Inventory + HUD:** one bonus slot per unit. When held, a 4th weapon pill (weapon label + distinct `--ba-crate` accent) appears in `BlastHud`; hotkey `4`. Firing it consumes the slot. Units keep the bonus across turns until used; KO'd units lose it (no drop-on-death for v1).
- **Rendering:** crate sprite (~8×8 pixel-art, parachute while falling) + subtle glint so it reads against terrain; falls in the existing rAF paint using tokens, no raw hex.
- **AI (solo):** v1 — the AI ignores crates entirely; it never gains bonus weapons. (Fair since the human earns them by repositioning skill. AI crate-seeking is v2.)

## Event/type changes
- `MultiplayerEvent`: `move_done`, `crate_picked` (both carry `turn_index`; engine rejects stale ones, matching `shot_fired` sequencing).
- `TurnResolution`: `crates`, `bonus_weapon` per unit (see reconciliation above).
- No DB changes — crates/bonuses are ephemeral match state, never persisted.

## Out of scope
- Weapon shop / currency / pre-match loadouts.
- Multi-projectile or unit-moving weapons (cluster, tornado, teleport) — new sim mechanics, v2.
- AI crate-seeking and AI repositioning.
- Crate drop-on-death.

## Verify
1. lint + `tsc` + build.
2. 2-tab: crate spawns at the same spot/time on both clients across several rounds; parachute animation; pickup by one player removes it on both and shows the 4th pill only for the holder.
3. Nuke and barrel fire correctly through the normal sim (carve size, damage, barrel rolls); both clients replay identically; XP/rankings unaffected structurally.
4. Post-fire: shooter with stamina walks after firing, other client sees the final position after `turn_resolved`; window respects the turn clock (never extends a turn past deadline + grace); stamina-empty shooter gets no window.
5. Reposition into hazard/off a cliff → Session 13 rules apply and reconcile on both clients.
6. Explosion destroys a crate on both clients; `BA_CRATE_MAX_ACTIVE` respected.
7. Host-drop mid-window: host promotion + skip-grace still advances the turn (no deadlock waiting for `move_done`).
8. Solo: crates spawn, human can claim and fire bonuses, AI plays normally without crates.
9. Breakpoints 375 / 768 / 1024 / 1440px (4th weapon pill fits the HUD row on mobile).
