# Session 10 — Blast Arena: Polish & Pixel-Art Pass

**Goal:** Take Blast Arena from "works" to "feels great": real pixel-art sprites, juice (screen shake, particles, hit flashes), balance tuning, and full mobile/breakpoint QA. No new mechanics.

**Prerequisites:** Sessions 8 & 9 complete and smoke-tested.

**Read first:** `design-system/habit-quest/pages/blast-arena.md` + MASTER.md §7 (animation) + §13 (checklist).

---

## What to build

### 1. Pixel-art sprites
- Replace procedural unit shapes with small hand-authored sprite sheets: idle (2-frame bob), walk (2–3 frames), aim, hit-flash, KO. Keep them tiny (~12×14px per frame) and palette-limited to the arena tokens so they sit in the design system.
- Store as embedded data (base64 PNG in a TS module or `public/sprites/`) — decide based on size; either way tint per player by drawing to an offscreen canvas and compositing `--player-N` color (`source-atop`).
- Weapon projectiles get sprites too: rocket with 2-frame exhaust, grenade with blink accelerating near fuse end.
- Terrain gets a 1px darker edge line (`--ba-terrain-edge`) re-stamped after each carve so craters read crisply.

### 2. Juice (all gated behind `prefers-reduced-motion`)
- Explosion: expanding pixel-circle flash + 8–12 seeded debris particles + screen shake (translate the canvas wrapper, 150ms, amplitude ∝ blast radius).
- Damage numbers float up from hit units (DOM overlay, `animate-point-added` style).
- Low-HP units (<25) get a subtle red pulse; KO plays a small tombstone/poof.
- Wind indicator animates (drifting pixel streaks across the sky at wind speed).
- Turn handoff: brief banner slide ("<nickname>'s turn") instead of an instant swap.

### 3. Balance & AI tuning
- Playtest matrix: each weapon should have a situation where it's the right pick; adjust `BA_WEAPONS` damage/radius and `BA_WIND_MAX` until bazooka ≠ always-correct.
- AI difficulty spread check: easy loses to a first-time player, hard beats a casual one. Tune `BA_DIFFICULTY_CONFIG` aim-error stddevs.
- Sudden-death pacing: confirm typical 1v1 ends inside ~6 rounds; adjust stamina/turn time if matches stall.

### 4. QA pass
- All four breakpoints (375 / 768 / 1024 / 1440), portrait phone first-class: canvas + HUD + weapon pills fit without scroll while aiming.
- Touch: slingshot drag doesn't scroll the page, walk buttons reachable with thumbs, no double-fire on pointercancel.
- Multiplayer re-smoke after changes: 2-browser determinism check (identical explosion on both clients) — juice must stay cosmetic, never touch `blastSim.ts` outputs.
- `prefers-reduced-motion`: game fully playable, no shake/particles.
- Lint + `tsc` clean; MASTER.md §13 checklist.

---

## Definition of done
- [ ] Units are animated pixel sprites tinted per player; projectiles have sprites
- [ ] Explosions shake, flash, and throw debris; damage numbers float; all disabled under reduced motion
- [ ] Craters have crisp edges after carving
- [ ] No change to any `blastSim.ts` return value (determinism untouched — verify with a fixed-seed replay before/after)
- [ ] Each of the 3 weapons wins some matchup; AI difficulties feel distinct
- [ ] Full breakpoint + touch QA passed; two-browser multiplayer re-smoked
- [ ] Lint + `tsc` clean
