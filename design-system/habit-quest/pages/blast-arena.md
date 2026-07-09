# Blast Arena — Design Spec

> Turn-based 2D artillery minigame (Worms W.M.D. / Wild Ones style). Pixel-art aesthetic, destructible terrain, solo vs AI + multiplayer via room codes. Working title "Blast Arena" — rename is a find/replace before Session 8 ships.

Defers to `MASTER.md` for all global rules. Sessions 8–10 in `.claude/sessions/` implement this spec.

---

## §1 Concept

- 2–4 combatants on a side-view 2D map with destructible terrain. **One unit per player** (Wild Ones model, not Worms teams) — keeps turns fast and state small.
- Turn-based: on your turn you get `BA_TURN_TIME_MS` (default 30s) to walk (limited stamina), aim, pick a weapon, and fire once. Shot resolves, next player's turn.
- Projectiles follow ballistic physics with per-turn wind. Explosions carve circular holes in the terrain and deal HP damage + knockback.
- Last unit standing wins. Sudden death after `BA_MAX_ROUNDS` full rounds: all players take 10 HP per round start.
- **Solo mode:** 1v1 vs an AI bot (difficulty = aim error + weapon choice quality). Fills the empty-room case, playable anonymously.

## §2 Rendering — canvas, pixel-art

This game **uses `<canvas>`**, a deliberate exception to the Coin Rush DOM rule: per-pixel destructible terrain cannot be DOM. Constraints that keep it inside the design system:

- Internal resolution **320×180** (16:9), scaled up with `image-rendering: pixelated` + `ctx.imageSmoothingEnabled = false` at an **integer scale factor** to fit the viewport. This is what produces the chunky pixel look — no sprite work required to read as pixel-art.
- Canvas colors are **sampled from CSS tokens at mount** via `getComputedStyle` (arena tokens below) — never hex literals in TS. This is the sanctioned canvas escape hatch for the no-raw-hex rule.
- All UI *around* the canvas (HUD, weapon picker, results) is normal DOM/Tailwind, `data-mode="arcade"` like Coin Rush.
- v1 sprites are procedural pixel shapes (unit = 8×10px body + eyes, drawn in code from token colors). Hand-authored sprite sheets are a Session 10 stretch, not a v1 requirement.

New tokens in `src/index.css` (values chosen to fit the existing arcade palette):
`--ba-sky`, `--ba-terrain`, `--ba-terrain-edge`, `--ba-explosion`, `--ba-trajectory`, plus reuse `--player-1`…`--player-4` for units.

## §3 Terrain

- 1-bit solidity map: `Uint8Array(320 × 180)`. Generated from the room `seed` via midpoint-displacement heightline + seeded blob carve-outs (caves/overhangs optional, flat-ish maps fine for v1).
- Rendered once to an offscreen canvas; explosions carve circles by clearing pixels in both the solidity map and the offscreen canvas (`globalCompositeOperation: 'destination-out'`).
- Units stand on terrain via pixel-probe collision (check pixels under feet); walking climbs slopes ≤ 3px/step, blocked otherwise; loss of support = fall (fall damage deferred).

## §4 Physics & determinism

- Fixed timestep simulation: **60 steps/sec**, projectile integrates gravity + wind per step. Simulation is a pure function of `(terrain state, shot input, wind)`.
- **Never call `Math.sin/cos/pow` inside the sim step** — trig only at input encoding (angle → velocity vector, computed once by the shooter and included in the shot payload as `vx, vy`). Everything inside the sim is +, ×, comparisons: bit-identical across browsers.
- Wind per turn is seeded: `windAt(seed, turnIndex)` — no wind payload over the wire.

## §5 Weapons (v1: exactly 3)

| Weapon | Behavior | Damage | Blast radius |
|---|---|---|---|
| Bazooka | Straight ballistic shot, wind-affected | 35 max | 12px |
| Grenade | Bounces (0.5 restitution), 3s fuse, no wind | 45 max | 14px |
| Boot | Melee knockback, short range, no terrain damage | 15 + strong knockback | — |

Damage falls off linearly from explosion center. Unlimited ammo v1; ammo economy deferred.

## §6 Controls

- **Desktop:** ←/→ walk, mouse drag from unit = slingshot aim (angle + power shown as dotted trajectory preview of first ~20 steps), release to fire. `1/2/3` weapon select.
- **Mobile:** touch drag-to-aim slingshot (same gesture as Angry Birds — proven on touch), on-screen ◀ ▶ walk buttons (44px min), weapon pills above the canvas. `touch-action: none` on canvas.
- Trajectory preview uses the same sim function truncated — guarantees preview matches reality.

## §7 Turn flow & netcode (multiplayer)

Reuses Session 1 infrastructure verbatim: rooms, lobby, `participant_token`, ready-gate, `useRealtimeRoom`.

- Turn order = participant `created_at` order. Active player's client is the only one accepting input.
- On fire, shooter broadcasts `shot_fired { turnIndex, weapon, x, y, vx, vy }`. **Every client runs the identical deterministic sim** for visuals — no result payload needed for the common case.
- **Host is authoritative for outcomes**: after the sim settles, host broadcasts `turn_resolved { turnIndex, hp: {nickname: hp}, nextTurnNickname }`. Clients reconcile HP to the host's values (drift should be zero; this is a safety net + handles late-joiner/refresh recovery).
- Turn timer enforced host-side: no shot within `BA_TURN_TIME_MS` → host broadcasts `turn_skipped`.
- Disconnect mid-game: existing host-promotion trigger; a departed player's unit becomes inert and is killed at their next turn.

## §8 Scoring / XP

- `score_wpm` (overloaded, house convention) = **damage dealt**; winner determined by last-standing, tie-break by damage dealt.
- XP: verbatim math model — `floor(damageDealt / 10)` base × position multiplier (1.5 / 1.25 / 1), `XP_PER_SESSION_CAP` + `DAILY_SESSION_CAP`, auth-only.
- Solo: win vs AI = base XP from damage dealt, same caps; guest → `localStorage` `blast-arena-best` (wins count), no XP.
- `defaultStatType: 'strength'` (combat game; typing/math are intelligence, Coin Rush is dexterity).

## §9 Registry & data

- `GameType` union += `'blast-arena'`. New `GameConfig` entry (icon: `Bomb` from Lucide), route `/games/blast-arena`, `multiplayerGameType: 'blast-arena'`.
- **No new DB columns** — terrain/wind/order all derive from existing `seed`; reuse `difficulty`, `max_players` (cap 4 for this game type in CreateRoom UI), `time_limit_seconds` unused.
- New `MultiplayerEvent` members: `shot_fired`, `turn_resolved`, `turn_skipped`.

## §10 Out of scope (v1)

Teams/multiple units per player, ammo economy, fall damage, water/drowning, moving platforms, hand-drawn sprite sheets, sound, spectators, best-of-N matches.
