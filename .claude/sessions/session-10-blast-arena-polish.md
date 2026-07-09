# Session 10 — Blast Arena: Final Polish, Pixel-Art & Game Feel Pass

**Goal:** Transform Blast Arena from a functional prototype into a polished arcade game. Focus entirely on presentation, responsiveness, readability, and satisfying game feel. No gameplay mechanics should change; all improvements must remain cosmetic or balancing.

**Prerequisites:** Sessions 8 & 9 completed and smoke-tested.

**Read first:** `design-system/habit-quest/pages/blast-arena.md` + `MASTER.md` §7 (Animation) + §11 (Accessibility) + §13 (Production Checklist).

---

## What to build

### 1. Pixel-Art Upgrade

Replace all placeholder visuals with cohesive pixel-art assets while preserving the existing gameplay.

- Replace procedural unit shapes with hand-authored sprite sheets (idle, walk, aim, fire, hit, KO). Keep sprites small (~16×20px), palette-limited, and readable at all scales.
- Tint player sprites using the existing player color system (offscreen canvas + `source-atop`) so one sprite sheet supports all players.
- Replace projectile primitives with sprites:
  - Bazooka: animated rocket + exhaust flame + smoke trail.
  - Grenade: spinning sprite + blinking fuse that accelerates near detonation.
  - Boot: exaggerated kick animation + impact dust.
- Improve terrain readability:
  - 1px darker terrain edge (`--ba-terrain-edge`)
  - subtle dirt texture
  - grass edge on exposed surfaces
  - clean crater outline regenerated after every carve
- Preserve pixel-perfect nearest-neighbor rendering throughout.

---

### 2. Battlefield Layout & Screen Composition

Improve the overall presentation so Blast Arena feels like a complete game instead of a small canvas embedded inside a webpage.

Desktop:

- Battlefield should occupy approximately **65–75% of the available viewport height**.
- Reduce unnecessary whitespace above and below the game.
- Keep the HUD compact while maximizing gameplay visibility.
- Maintain consistent spacing between HUD elements.

Mobile:

- Canvas spans nearly the full screen width.
- Increase battlefield height while ensuring the entire interface fits without vertical scrolling.
- Weapon selector, timer, and controls remain comfortably reachable.
- Portrait mode is treated as a first-class experience.

General:

- Responsively scale the rendered canvas without changing the internal simulation resolution.
- Preserve crisp pixel rendering.
- Maintain aspect ratio across all supported breakpoints.
- Move gameplay instructions into a subtle in-canvas overlay that fades after inactivity.

---

### 3. Game Feel ("Juice")

All effects must respect `prefers-reduced-motion` and remain purely cosmetic.

Explosion feedback:

- expanding pixel flash
- shockwave ring
- 8–16 seeded debris particles
- smoke particles
- terrain fragments
- brief screen flash
- camera shake (≈150ms, amplitude proportional to blast radius)

Combat feedback:

- floating damage numbers
- hit flash
- sprite recoil
- animated HP changes
- low-HP pulse (<25%)
- KO poof / tombstone effect

Weapon feedback:

- Bazooka: heavy explosion + smoke trail
- Grenade: spinning animation + blinking fuse
- Boot: anticipation, dust cloud, comedic impact

Environment:

- animated wind streaks
- drifting clouds or ambient particles
- subtle background motion to keep arenas feeling alive

Turn transitions:

- replace instant turn swap with a short banner slide (`"<nickname>'s turn"`)

---

### 4. HUD & Camera Polish

Improve readability without increasing clutter.

HUD:

- stronger visual hierarchy
- larger turn indicator
- weapon icons alongside labels
- clearer timer emphasis
- improved spacing and alignment
- support future ammo indicators

Camera:

- explosion shake
- slight firing recoil
- optional projectile follow
- smooth return to active player
- never modify gameplay precision or simulation

---

### 5. Balance & AI Tuning

Perform structured playtesting.

Weapons:

- every weapon should have situations where it is the best choice
- tune `BA_WEAPONS` damage, radius, knockback, and `BA_WIND_MAX`
- bazooka should no longer be the universally optimal choice

AI:

- Easy: beginner-friendly with noticeable aim errors
- Medium: competent with occasional mistakes
- Hard: accurate and strategically uses movement and weapons

Tune only:

- aim variance
- weapon preference
- movement heuristics

Maintain deterministic simulation.

Match pacing:

- verify typical 1v1 matches finish within ~6 rounds
- adjust stamina or turn timer only if matches consistently stall

---

### 6. QA Pass

Layout:

- Verify 375 / 768 / 1024 / 1440 breakpoints.
- Battlefield fills available space appropriately on every device.
- No vertical scrolling during gameplay.
- Responsive canvas scaling remains crisp.

Touch:

- slingshot drag never scrolls the page
- walk controls comfortably reachable
- no double-fire on `pointercancel`

Accessibility:

- `prefers-reduced-motion` disables shake, flashes, particles, and ambient animations
- HUD remains readable with scalable text
- player colors remain distinguishable

Multiplayer:

- two-browser determinism replay
- identical terrain carving
- identical explosions
- identical damage
- cosmetic systems never modify `blastSim.ts`

Performance:

- maintain 60 FPS desktop
- smooth gameplay on mid-range mobile
- particle pooling avoids excessive allocations

Production:

- ESLint clean
- `tsc` clean
- production build succeeds
- MASTER.md §13 checklist completed

---

## Definition of Done

- [ ] Animated pixel-art character sprites replace procedural units and are tinted per player
- [ ] Every projectile has unique pixel-art visuals and animation
- [ ] Terrain includes crisp outlines, texture, and regenerated crater edges
- [ ] Battlefield layout maximizes screen usage on desktop and mobile without scrolling
- [ ] Responsive canvas scaling preserves crisp pixel rendering at every breakpoint
- [ ] Explosions include flash, debris, smoke, camera shake, and hit feedback (disabled under reduced motion)
- [ ] Damage numbers, KO effects, low-HP pulse, and turn transitions are fully animated
- [ ] HUD uses stronger visual hierarchy with icons and improved spacing
- [ ] Camera effects improve game feel without affecting gameplay
- [ ] Each weapon has a meaningful gameplay niche; AI difficulties feel distinct
- [ ] No change to any `blastSim.ts` outputs (verified with deterministic replay)
- [ ] Full breakpoint, touch, accessibility, and multiplayer QA completed
- [ ] 60 FPS maintained across supported devices
- [ ] ESLint, TypeScript, and production build all pass