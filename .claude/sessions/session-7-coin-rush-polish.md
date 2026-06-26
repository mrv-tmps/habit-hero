# Session 7 — Coin Rush: Polish, Tuning & Mobile QA

**Goal:** Take a functionally-complete Coin Rush (solo + multiplayer) from "works" to "feels great." Tune difficulty, add juice, and harden the mobile/portrait experience across all breakpoints. No new mechanics — only refinement.

**Prerequisite:** Sessions 5 and 6 complete. Solo and multiplayer Coin Rush are playable end-to-end.

**Read first:** `design-system/habit-quest/pages/coin-rush.md` + MASTER.md §7/§13.

---

## 1. Difficulty tuning (`CR_DIFFICULTY_CONFIG`)

Playtest each tier and tune the table until the *feel* matches the intent. Targets:

| Tier | Intended feel | Knobs |
|---|---|---|
| Easy | Relaxed, generous, everyone scores | small arena, ~15 coins, 2 slow saws, frequent gems |
| Medium | The default — steady scramble, real choices | medium arena, ~12 coins, 3 saws, occasional gems |
| Hard | Tense, hazard-dense, gems are clutch | large arena, ~9 coins, 4 fast saws, rare gems |

- Calibrate `avatarSpeed` vs arena size so crossing the arena takes a satisfying ~1.5–2.5s (not instant, not a slog).
- Verify a 90s round nets roughly 20–50 points so XP lands in the same band as Typing/Math (`floor(score/10)` → ~2–7 base XP).
- Confirm saw timing never creates an unavoidable/un-fun "wall" of blades from the seed.

## 2. Juice (cosmetic only — all transform/opacity, all reduced-motion-guarded)

- **Coin collect:** confirm `animate-coin-pop` + floating `+1`/`+5`; add a subtle score-counter tick on the HUD.
- **Gem spawn:** brief attention flash where it appears; gem `animate-gem-pulse` while alive; fade-out on expire.
- **Stun:** `animate-stun-shake` + tint + a small "Stunned!" label above the avatar that fades.
- **Countdown:** `animate-countdown-pop` 3-2-1-GO polish; "GO" in `--primary`.
- **Leader change (MP):** when the leader flips, briefly pulse the new leader's scoreboard chip (`animate-pulse-glow`, once).
- **Final seconds:** HUD timer `animate-pulse-glow` ≤ 10s (already specced) — confirm it reads as urgent.
- **Own-avatar findability:** confirm the `ring-2` + facing `▲` makes "where am I" instant even in an 8-blob scrum.

Keep every flourish ≤ 300ms (MASTER §7). Re-verify the `prefers-reduced-motion` block disables all of the above while gameplay continues.

## 3. Mobile / portrait hardening

- **Joystick ergonomics:** thumb reachable one-handed in portrait; ≥ 44px; `touch-action: none`; springs back on release; never covers the play field. Test on a real phone, not just devtools.
- **No scroll/zoom traps:** `overscroll-behavior: contain` + `touch-action: manipulation` on the arena; double-tap doesn't zoom; pull-down doesn't refresh mid-round.
- **Arena sizing:** square fits `100vw − gap` at 375px with the HUD above and joystick below, no horizontal scroll, no clipped entities.
- **Scoreboard (MP):** collapses to dot+number chips with `overflow-x-auto` at small widths; own chip marked.
- **Landscape sanity:** if the phone is rotated, the square still fits (height-bound) and the joystick stays reachable.

## 4. Accessibility pass (MASTER §13)

- Joystick `role="application"` + `aria-label="Movement joystick"`; keyboard fully works on desktop.
- Scoreboard `aria-live="polite"` announces score changes without spamming.
- Coin vs gem distinguishable by size/shape, not color alone; players labelled by nickname.
- All icon-only buttons have `aria-label`; focus rings visible; `cursor-pointer` on all interactives.
- Document the inherent real-time/motor limitation in a short note rather than faking a non-realtime mode.

## 5. Cross-breakpoint QA matrix

Run both solo and (with 2 clients) multiplayer at **375 · 768 · 1024 · 1440px** and portrait phone:

- [ ] No horizontal scroll, no clipped arena, no overlapping HUD/joystick at any size
- [ ] Movement smooth (≥ ~60fps) with 8 avatars + full coin field + 4 saws on a mid phone
- [ ] Determinism holds (same seed → same layout) after this session's changes
- [ ] XP values land in the intended band; daily/session caps respected
- [ ] `npm run lint` clean; `tsc --noEmit` clean
- [ ] MASTER.md §13 + `coin-rush.md §9` checklists fully green

## 6. Optional stretch (only if time remains — do NOT expand scope otherwise)
- Spectator view for the empty-room case (watch the deterministic arena run).
- Sound effects (collect/gem/stun) behind a mute toggle, respecting an autoplay-safe gesture.
- A "rematch in same room" flow instead of bouncing to `/games`.

---

## Design reference
`design-system/habit-quest/pages/coin-rush.md` — §1 (animation/reduced-motion), §2/§6 (arena/joystick), §9 (checklist).
`MASTER.md` — §7 timing, §13 pre-delivery checklist.

## Definition of done
- [ ] Each difficulty's feel matches the intent table; round scores land in the XP band
- [ ] All juice present, ≤300ms, transform/opacity only, fully reduced-motion-guarded
- [ ] Portrait phone is comfortable one-handed; no scroll/zoom/refresh traps
- [ ] Accessibility checklist green; determinism intact
- [ ] Lint + typecheck clean; both checklists green at all four breakpoints
