# Session 13 — Blast Arena: Jump, Knockback Physics + Map Structure Variety

**Goal:** Add a jump to unit movement, upgrade knockback from instant displacement to a visible ballistic launch with fall damage (the Wild Ones feel), and make terrain generation produce varied battlefield layouts (floating islands, caverns, pillars, indestructible rock) instead of only rolling hills. Layouts are still seeded/random; explicit map *picking* and visual *themes* are Session 14.

**Prerequisites:** Session 12 (8-player scaling) — spawn-gap clamp in `spawnPositions` lands there and this session builds on it.

**Read first:** `src/lib/blastTerrain.ts`, `src/lib/blastSim.ts` (`settleUnits`, `simulateShot` knockback at ~line 169), `src/hooks/useBlastEngine.ts` (walk tick ~line 721, shot playback/result application, keyboard in `src/pages/BlastArena.tsx` ~line 96).

**Decisions locked with user (2026-07-10):** hazard floor on island-style maps is **instant KO** (Wild Ones water behavior), not drain/respawn. Knockback becomes a **ballistic launch** (unit flies in an arc), and falls beyond a safe height deal **fall damage** — from knockback, walking off, or jumping short alike.

**Why jump / knockback / fall damage / hazard are one session:** they all live in `settleUnits` + sim-result application, and their tuning is coupled — the jump apex must stay below the safe-fall threshold, and hazard KO is only threatening because ballistic knockback can throw a unit past an edge. If the session runs long, the structure generators (§5) are the part to spill into Session 14, never the physics.

---

## Architecture constraints (do not violate)

- Terrain stays one seeded `Uint8Array` (row-major, 320×180). All generators are pure, seeded (mulberry32), and **trig-free** (`smoothLerp` only) so grids are bit-identical cross-browser.
- Movement (walk AND jump) is **local-only during your own turn**: remote clients learn position from the shot payload (`x, y`) and the host's `turn_resolved` reconciliation snaps positions at every turn boundary. Jump therefore needs **zero netcode changes**.
- No raw hex in components — new colors are `--ba-*` tokens sampled via `getComputedStyle` (the sanctioned escape hatch).

## What to build

### 1. Jump
- Constants: `BA_JUMP_IMPULSE` (initial vy, tune ~−2.2 with `BA_GRAVITY = 0.06`, target ≈ 18–22px apex), `BA_JUMP_STAMINA_COST` (~12 of the 40px budget — 3 jumps max per turn, a real tradeoff vs walking).
- Engine (`useBlastEngine`): a `jump()` action, allowed only while `phase === 'aiming'` on the local unit's turn, unit grounded (`isSolid` directly below), stamina ≥ cost, no jump queued. Integrate vy with `BA_GRAVITY` in the existing walk interval (or a parallel tick): rise, ceiling check (`isSolid` above → vy = 0), fall, land on first solid pixel. Horizontal walk stays usable mid-air (drains walk stamina as normal) so jumps can cross gaps.
- Input: `ArrowUp` / `w` / `Space` in the keyboard handlers (solo page + `MultiplayerBlast`); left/right/a/d and weapon hotkeys 1/2/3 are taken. Mobile: third coarse-pointer button (Lucide `ArrowUp` icon) beside the walk buttons in `BlastHud`.
- Sprites: reuse the walk frames while airborne (or `aim` frame); no new sheet required.
- Fire while airborne is allowed — shot origin is wherever the unit is (payload already carries x/y).

### 2. Ballistic knockback + fall damage
Today an explosion applies an instant displacement (`knockback[unit.id] = {dx, dy}`, damage-scaled with upward bias, `blastSim.ts` ~line 169) and `settleUnits` teleport-drops the unit to the surface — no visible launch, no fall consequence.

- **Launch physics**: convert the knockback vector into an initial velocity and integrate it in the sim with the existing `BA_GRAVITY` and terrain collision (same axis-separated stepping as projectiles — deterministic, trig-free; the vector is already ratio-based). The unit arcs through the air and comes to rest where physics says, including sailing over ledges and off islands. Emit the arc as frames in `ShotResult` (extend `SimFrame` or add a parallel `unitFrames` track) so playback animates the flight on every client; the *final position* is what feeds `turn_resolved`, exactly like today.
- **Multi-unit**: integrate each knocked unit independently; units don't collide with each other mid-flight (matches projectile behavior).
- **Fall damage**: during any airborne descent — knockback flight, walking off an edge, or a jump that overshoots — track peak height vs landing height. Constants: `BA_FALL_SAFE_PX` (~28, comfortably above the ~20px jump apex so a normal jump NEVER hurts), `BA_FALL_DMG_PER_PX` (~0.5), `BA_FALL_DMG_CAP` (~35). Damage = `min(cap, (drop − safe) × perPx)`, floored to int for determinism.
- **Where each fall is computed**: knockback falls resolve inside `simulateShot`/settle (pure, replayed identically by every client; host `turn_resolved` hp reconciliation covers edge cases as today). Walk-off and jump falls happen during local movement — apply the damage locally and include it implicitly via the host resolution at the turn boundary (hp flows through `turn_resolved` already). Show the existing damage-number FX + a dust/impact effect on hard landings.
- **Feel**: brief screen-shake scale with fall damage; reuse hit sprite frame while flying, KO FX if the landing (or hazard) kills.
- **Boot rework note**: the boot's identity is knockback — verify its damage-scaled shove now launches convincingly (`BA_KNOCKBACK_SCALE` may need retuning once ballistic; expect a lower scale since velocities compound with gravity).

### 3. Hazard floor (instant KO)
Part of the same physics pass — ballistic knockback is what makes it matter.
- Structures declare `hazardY: number | null` (islands: ~`H − 10`; others: `null`).
- When `hazardY` is set: the "bottom of screen is solid" rule in `isSolid` (`yi >= H → true`) is disabled for unit settling; any unit whose feet reach `hazardY` during settle/knockback flight/walk/jump/fall is set to 0 HP with the existing KO FX (+ a small splash FX at the waterline).
- Determinism: hazard KOs happen inside shot resolution/settle, which every client replays identically; the host's `turn_resolved` (hp + positions) reconciles any edge case, same as today.
- Walking off an edge and jumping short both kill — that's the point (boot knockback becomes genuinely scary on island maps).
- Rendering: animated 2–3 frame water/lava strip below `hazardY` using `--ba-hazard` token(s).
- Spawns: `spawnPositions` must only choose columns whose `surfaceYAt` is above `hazardY` (i.e., on an island), preserving the Session 12 min-gap clamp; if a column misses land, scan to the nearest valid column.
- AI (`blastAi.ts`): candidate search already simulates real physics, so shots that would knock the AI itself into hazard are penalized via `selfHarmWeight` **only if** hazard death is represented in the candidate scoring — extend the scoring so a candidate that ends with own unit below `hazardY` counts as max self-harm. Same for candidates whose knockback flight ends in heavy self fall damage. AI never jumps (fine for v1).

### 4. Indestructible rock (obstacles)
- Third terrain cell value: `0` air, `1` dirt (carvable), `2` rock (indestructible).
- `carveCircle` skips value-2 cells. `isSolid` checks `!== 0`. `surfaceYAt` unchanged (finds first non-zero).
- Renderer (`useBlastEngine` terrain offscreen paint): value-2 cells use a new `--ba-rock` token (+ darker edge), visually distinct from dirt so players learn "that won't blow up".
- Weapons: rock blocks projectiles exactly like dirt (bazooka explodes on contact, grenade bounces via existing restitution) — no sim changes beyond the carve skip.

### 5. Map structure generators
- Refactor `generateTerrain(seed)` → `generateTerrain(seed, structure: MapStructure)` where `MapStructure = 'hills' | 'islands' | 'caverns' | 'pillars'`.
  - `hills` — current control-point surface (unchanged output for identical seed: keep the exact current code path).
  - `islands` — 3–5 floating platforms (seeded count/width/height bands) over a hazard floor; guarantee combined platform width fits max player count × spawn gap.
  - `caverns` — hills base, then 4–8 seeded carved pockets/tunnels (reuse `carveCircle`), some surface-breaking.
  - `pillars` — hills base plus 2–4 tall indestructible rock columns (value 2) that partition the arena; leave ≥1 gap or arc route between any two spawn regions.
- `pickMapStructure(seed)`: deterministic choice from the seed so this session is playable end-to-end with random maps in both solo and multiplayer — every client derives the same structure from the shared room seed, no new events or columns. Session 14 replaces this with an explicit picker (keep the function as the "Random" path).

## Out of scope
- Map picker UI, `map_id` column, visual themes/palettes/backgrounds → Session 14.
- AI jumping/pathfinding.

## Verify
1. lint + `tsc` + build.
2. Solo, several seeds per structure (temporarily force each structure in dev): islands spawn everyone on land; caverns/pillars have no spawn inside solid; pillars always leave a route.
3. Jump: apex ~20px, gap-crossing works, ceiling stops rise, stamina drains, no jump during projectile/others' turns; a normal flat-ground jump deals **zero** fall damage; mobile button on a coarse-pointer device.
4. Knockback: bazooka/boot hits visibly launch the unit in an arc on **both** clients in a 2-tab test, landing positions identical (the deterministic invariant); knocked unit can fly over a ledge.
5. Fall damage: knock a unit off high ground → landing shows damage number + impact FX, hp identical on both clients; a small hop or short knockback (< `BA_FALL_SAFE_PX`) deals none; cap respected from max height.
6. Hazard: boot a unit into water → instant KO on **both** clients; walk off edge → KO; rankings/XP still finalize.
7. Rock: bazooka crater stops at rock boundary; grenade bounces off rock.
8. AI (medium/hard) does not routinely knock itself into hazard or off cliffs on island/pillar maps.
9. 2-tab multiplayer: same seed → identical terrain/structure on both clients (screenshot compare), full match to results.
10. Breakpoints 375 / 768 / 1024 / 1440px.
