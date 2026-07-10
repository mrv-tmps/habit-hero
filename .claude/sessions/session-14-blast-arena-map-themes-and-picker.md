# Session 14 — Blast Arena: Map Themes + Map Picker

**Goal:** Give the Session 13 structures visual identity (Wild Ones-style themed battlefields — volcano, snow, space, classic grass) and let players choose the map: solo start card + host's lobby config panel, with "Random" as the default.

**Prerequisites:** Session 13 (structures, rock, hazard floor, `pickMapStructure`) complete and smoke-tested.

**Read first:** `design-system/habit-quest/MASTER.md` (tokens, no-raw-hex rule), `src/hooks/useBlastEngine.ts` (palette sampling via `getComputedStyle`, terrain offscreen paint), Session 11 migration `20260710000000_add_rematch_and_config_rpcs.sql` (`update_room_config` — this session must extend it).

---

## Design

### 1. Map registry (`src/config/blastMaps.ts`)
Registry pattern, like `games.ts` — adding a map must not require touching the engine:

```ts
interface BlastMapConfig {
  id: string;            // 'grasslands' | 'volcano' | 'tundra' | 'orbit'
  label: string;
  structure: MapStructure;      // from Session 13
  themeAttr: string;            // value for data-ba-map on the arena wrapper
  hazard: 'none' | 'water' | 'lava';
}
```

v1 maps (4): `grasslands` (hills, none), `volcano` (pillars, lava), `tundra` (caverns, none), `orbit` (islands, water→"void"). `RANDOM_MAP_ID = 'random'` resolves via seed to one of the four — deterministic, so all clients agree with no extra messages.

### 2. Theme palettes (CSS tokens only)
- Per-theme token sets in `index.css` scoped by attribute: `[data-ba-map="volcano"] { --ba-terrain: …; --ba-dirt: …; --ba-rock: …; --ba-hazard: …; --ba-sky: …; }` with light/dark variants matching the existing `--ba-*` pattern.
- The engine already samples tokens with `getComputedStyle` at mount and on theme change — set `data-ba-map` on the arena wrapper *before* engine init, re-sample on change. No raw hex anywhere in TS/TSX.

### 3. Background decorations (procedural, pixel-art)
- Seeded, trig-free decorations painted once onto the terrain offscreen canvas *behind* terrain: stars (orbit), snowfall flecks + drifts (tundra), ember glow spots (volcano), clouds (grasslands). Keep it cheap — dozens of rects, no images, no per-frame cost.
- Hazard strip visuals per theme (lava vs water vs void) reuse the Session 13 hazard renderer with theme tokens.

### 4. Map selection — DB + UI
- Migration `add_blast_map_id.sql`:
  - `ALTER TABLE multiplayer_rooms ADD COLUMN map_id TEXT` (nullable; `NULL` = random) + CHECK constraint on the registry ids.
  - Recreate `update_room_config` with a `p_map_id TEXT` parameter (same host-token authorization; `CREATE OR REPLACE` with the new signature, drop the old signature).
- `useMultiplayerRoom`: `map_id` in `RoomConfigUpdate` + `CreateRoomConfig`; pass through create and update paths. Add `map_id` to the `MultiplayerRoom` type.
- UI:
  - `RoomConfigPanel` (blast only): "Map" select — Random + the 4 maps.
  - `CreateRoom` (blast only): same select, default Random.
  - Solo `BlastArena.tsx` start card: same select (local state, no DB).
  - `MultiplayerBlast` resolves `room.map_id ?? seed-random` → `BlastMapConfig`, passes structure/hazard to the engine and sets `data-ba-map`.
- Rematch note: Session 11's `reset_room_for_rematch` regenerates the seed, so "Random" rerolls the map each rematch; an explicit map choice persists. Correct as-is — just verify.

## Out of scope
- More than 4 maps (registry makes later additions one-file changes).
- Per-map music/SFX; parallax layers.

## Verify
1. lint + `tsc` + build.
2. Each map id in solo: correct structure + palette + decorations + hazard visual, in light AND dark theme.
3. 2-tab multiplayer: host picks volcano in lobby → both clients render volcano; Random → both clients render the *same* resolved map; rematch with Random rerolls, with explicit choice keeps it.
4. Non-host lobby summary shows the chosen map label.
5. Config switch away from blast and back preserves defaults (Session 11 `defaultConfigFor` gets `map_id: null`).
6. Breakpoints 375 / 768 / 1024 / 1440px; `design-system/habit-quest/pages/blast-arena.md` updated with the map system.
