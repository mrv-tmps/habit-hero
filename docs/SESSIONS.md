# Habit Quest — Development Sessions

Chronological log of dev sessions. Latest on top.

---

## Session 12 — 2026-07-10
**Goal:** Raise Blast Arena's player cap from 4 to 8 (brief: `.claude/sessions/session-12-blast-arena-8-players.md`)

### Work done
- `src/config/constants.ts`: `baTurnTimeMs(count)` (30s ≤4, 20s 5–6, 15s 7–8) and `baMaxRounds(count)` (10/7/5) — turn clock and sudden-death budget both scale down with the roster so large matches don't drag
- `src/hooks/useBlastEngine.ts`: new `turnTimeMs`/`maxRounds` options (default to `BA_TURN_TIME_MS`/`BA_MAX_ROUNDS`); wired into the turn deadline, the displayed timer, and the sudden-death round check
- `src/hooks/useMultiplayerBlast.ts`: derives both from `participants.length` — every client computes identical values from the shared count, so no new events or seed impact
- `src/lib/blastTerrain.ts`: `spawnPositions` jitter clamped to `min(slot*0.5, max(0, slot - 24))` so adjacent spawns stay ≥24px apart (2× the bazooka radius); binds only at 6/8 players, unchanged at ≤4
- `src/pages/CreateRoom.tsx` + `src/components/multiplayer/RoomConfigPanel.tsx`: blast max-players options `2/3/4/6/8`; per-game hard cap removed (all games cap at `MP_MAX_PLAYERS` = 8), which also stops disabling the Blast option with 5+ players in the lobby

### Key decisions
- Pacing is a pure function of player count (no wire payload) — determinism preserved without touching the seed or adding events
- Spawn-gap floor anchored on the bazooka's 12px radius (direct-fire); grenades are lobbed so the tighter grenade radius isn't the constraint
- No DB/migration changes — `max_players` is already INT; blast ignores `question_count`/`time_limit_seconds`

### Verified
- `tsc` + `npm run build` clean (remaining lint errors are pre-existing, in untouched files)
- Ran the real `spawnPositions` math across 5000 seeds per count: min adjacent gap 24px at 6/8 players, ≥32px at ≤4

### Follow-ups
- Manual QA still pending: 8-unit dev-drive (turn rotation, sudden death at round 5, 15s timer, chip-strip layout at 375/768/1024/1440px) and a 2–3 tab multiplayer pacing sanity pass

---

## Session 9 fix — 2026-07-09
**Goal:** Fix Blast Arena multiplayer desync (players drifting to different turns/moves mid-game)

### Root causes
- Turn advancement was time-and-playback driven per client: each window advanced turns on its own clock, so any hiccup compounded permanently
- `applyRemoteShot` didn't validate the turn index — a late shot applied to the wrong turn with the wrong shooter/wind, teleporting the wrong unit to the shot origin
- Skip/shot race: a shot fired near the 30s deadline crossed the host's `turn_skipped` in flight — one client played the shot, the other a skip
- Shot results were applied when the rAF *animation* finished; browsers suspend rAF in hidden windows, so an unfocused window stopped resolving turns
- `autoSkipTurns: isHostRef.current` read a mutable ref at render time — the host could permanently end up without skip authority

### Fix (`useBlastEngine` rewrite + `useMultiplayerBlast`)
- `turn_resolved` is now a full authoritative turn boundary (`TurnResolution`: hp, positions, carve, next turn, next shooter). Non-hosts snap to it every turn — any drift self-heals at the next boundary
- Shots are sequenced: `shot_fired` carries `turn_index`; the engine rejects shots that don't match its current turn
- Host waits `BA_SKIP_GRACE_MS` (2s) past the deadline before skipping, absorbing in-flight shots; `turn_skipped` event removed (skips are just resolutions with no carve)
- State application decoupled from animation: a `setTimeout` fallback applies the shot result even when rAF is suspended; a `BA_RESOLUTION_FORCE_MS` (5s) timer force-applies a pending host resolution in throttled tabs
- Host flag is React state, not a ref read during render

### Known limitation
- A client hidden across *multiple* consecutive turns may miss intermediate terrain carves (hp/positions still reconcile). Full carve-history replay is a Session 10 candidate.

---

## Session 9 — 2026-07-09
**Goal:** Blast Arena multiplayer (brief: `.claude/sessions/session-9-blast-arena-multiplayer.md`)

### Work done
- Migration `20260709000000_add_blast_arena_game_type.sql`: extends the `multiplayer_rooms.game_type` CHECK constraint with `'blast-arena'`
- `src/types/multiplayer.ts`: `shot_fired` (payload carries `vx/vy` — trig resolved on the shooter's client), `turn_resolved` (host HP reconciliation), `turn_skipped` events
- `src/hooks/useBlastEngine.ts`: multiplayer extension points — `onTurnResolved`/`onTurnSkipped` callbacks, `autoSkipTurns` (host-only timer authority), `skipCurrentTurn`/`forceSkipTurn`/`reconcileHp`, shooter snapped to shot origin (remote clients don't see mid-turn walking)
- `src/hooks/useMultiplayerBlast.ts`: mirrors `useMultiplayerMath` — ready-gate, room-seed terrain, per-turn shot broadcast + deterministic replay via `applyRemoteShot`, host-authoritative outcomes and skips, rankings (winner first, then by damage dealt), position-multiplier XP with daily cap
- `src/pages/MultiplayerBlast.tsx`: shared ReadyScreen/MultiplayerResults, player strip (color chip, HP bar, skull, crosshair on active turn), spectate state on others' turns
- `MultiplayerResults`: optional `title` prop + `'dmg'` score unit (was hardcoded "Race Complete!")
- `CreateRoom`: blast option — difficulty select, 2–4 player cap, no session-length (last-one-standing); schema built per game so the length requirement is waived
- `MultiplayerGame` router branch, lobby label, solo page "play with friends" link, registry `multiplayerRoute`

### Verified
- `tsc` + lint clean; CreateRoom form renders correct blast fields; room creation reaches the hosted DB and fails with exactly `23514` on the game_type CHECK — confirming client wiring is complete and only the migration is pending

### Follow-ups
- **`supabase db push` required** before blast rooms can be created on the hosted project
- Two-browser realtime smoke test after the push (shot replay determinism, skips, results)
- Mid-turn walking is invisible to remote players until the shot fires (position snaps at fire) — Session 10 candidate: low-rate position broadcast during own turn

---

## Session 8 — 2026-07-09
**Goal:** Blast Arena solo core (brief: `.claude/sessions/session-8-blast-arena-solo.md`)

### Work done
- `src/config/constants.ts`: `BA_*` block — canvas size (320×180), physics (gravity/wind/60Hz), turn time, HP, stamina, `BA_WEAPONS` (bazooka/grenade/boot), `BA_DIFFICULTY_CONFIG` (AI aim error)
- `src/lib/blastTerrain.ts`: seeded 1-bit `Uint8Array` terrain (smoothstep-interpolated control points — deliberately trig-free), `carveCircle`, `surfaceYAt`, `spawnPositions`
- `src/lib/blastSim.ts`: pure deterministic shot simulation — axis-separated movement, grenade bounce, fuses, per-unit damage falloff + knockback, `windAt(seed, turnIndex)`, `settleUnits`; no `Math.sin/cos/pow` anywhere in the step loop (payload carries `vx/vy`)
- `src/lib/blastAi.ts`: candidate-search AI — samples ~45 launch velocities through the real sim, picks the closest landing, blurs with difficulty-scaled error; boot when adjacent
- `src/hooks/useBlastEngine.ts`: phase machine (countdown/aiming/projectile/done), rAF renderer (refs only, setState on discrete events), offscreen terrain canvas, aim preview via truncated real sim, shot playback, sudden death, walk with slope climbing
- `src/components/blast/BlastCanvas.tsx`: integer-scaled pixelated canvas, slingshot pointer drag (mouse + touch unified)
- `src/components/blast/BlastHud.tsx`: turn banner, wind indicator, turn timer, weapon pills (1/2/3 hotkeys), stamina bar, coarse-pointer walk buttons
- `src/pages/BlastArena.tsx`: start card (difficulty, best wins, stat picker), match wrapper (AI turn driver, keyboard controls), results card with XP save
- Registry entry (`Bomb` icon, `strength` stat), `/games/blast-arena` public route, `'blast-arena'` in `GameType`, `--ba-*` tokens + `data-mode="arcade"` + `pixelated`/`countdown-pop` CSS
- Fixed `.claude/launch.json` port mismatch (8082 → 8080, Session 4 follow-up)

### Key decisions
- Canvas colors sampled from CSS tokens via `getComputedStyle` at mount — the sanctioned escape hatch for the no-raw-hex rule
- XP: `accuracy` column overloaded as win flag (100 = won, 0 = lost); formula `floor(damage/10)` capped, wins only
- Boot implemented as a short-fuse non-carving projectile so all weapons share one sim path
- Turn timer expiry skips the turn (no auto-fire)

### Verified in browser
- Terrain renders + carves, AI fights back, full match to results screen, mobile 375px scale-1 with no overflow, keyboard walking, no console errors; `tsc` + lint clean (remaining lint errors are pre-existing)

### Follow-ups
- Walk buttons only appear on `pointer: coarse` devices — untestable in desktop emulation, needs a real-device check
- Session 9: multiplayer (brief ready)

---

## Session 4 — 2026-07-07
**Goal:** Solo code typing mode (brief: `.claude/sessions/session-4-code-typing-mode.md`)

### Work done
- `src/data/codeSnippets.ts`: expanded from the Session 3 starter pool to 6 snippets per language (JS/Python/C) — FizzBuzz, Fibonacci, binary search, palindrome check, bubble sort, array max/sum, factorial, plus the original debounce/unique/word_count/swap/strlen
- `src/pages/TypingTest.tsx`: added a words | code segmented control in the controls bar, with js/py/c language pills shown in code mode; code display reuses the multiplayer conventions (`whitespace-pre font-mono`, language badge, per-char coloring, blinking caret); Enter types the expected newline, Backspace corrects mistakes; WPM uses `calculateCharWpm`; switching mode/language/timer resets with a freshly randomized snippet; test finishes early once the snippet is fully typed

### Key decisions
- Kept the live `CodeSnippet` shape (`{language, title, code}`) rather than the session brief's `{id, label}` — `typingWordSets.ts` and multiplayer already consume it, so the expanded pool now feeds both solo and multiplayer code races
- Reused multiplayer's code-display classes/behavior so solo and multiplayer code mode feel identical
- Language pills instead of a shadcn `Select`, consistent with the existing timer pills

### Follow-ups
- `.claude/launch.json` declares port 8082 but Vite serves on 8080 — config mismatch to fix

---

## Multiplayer Session 3 — 2026-07-06
**Goal:** Multiplayer typing race (brief: `.claude/sessions/session-3-multiplayer-typing.md`)

### Work done
- `src/lib/typingRender.ts`: extracted pure WPM/accuracy/char-status helpers from solo TypingTest (no behavior change)
- `src/components/multiplayer/`: extracted shared `ReadyScreen` + `MultiplayerResults` + `playerColors` from MultiplayerMath; math now passes `title`/`subtitle`/`scoreUnit` props
- `src/lib/typingWordSets.ts`: seeded (mulberry32) word set + code snippet selection — same seed, same text on every client
- `src/data/codeSnippets.ts`: starter pool (2 snippets × JS/Python/C); Session 4 expands
- `src/hooks/useMultiplayerTyping.ts`: ready-gate → active → done, 250ms throttled progress broadcasts, host-authoritative end, position XP multipliers, daily-cap-aware save
- `src/pages/MultiplayerTyping.tsx`: sticky per-player progress panel (player color tokens, own row pinned), solo-style word rendering, `whitespace-pre` code mode with language badge
- `src/pages/CreateRoom.tsx`: Mode (English/Code) + conditional Language selects for typing rooms
- Migration `20260626000001_add_typing_mode_columns.sql`: `typing_mode` + `code_language` on `multiplayer_rooms`
- Earlier same day: fixed solo typing test input on mobile IME keyboards (onChange instead of keydown)

### Key decisions
- Strict advance: a word (or char in code mode) must be typed correctly to progress — prevents space-spamming the progress bar
- Multiplayer typing XP = `floor(WPM / 10)` × position multiplier (remote players' accuracy is not broadcast)
- Results/ready screens are shared components per design spec §6, not per-game copies

### Follow-ups
- `supabase db push` to the hosted project required before typing rooms can be created (columns missing remotely)
- Two-browser realtime race smoke test pending

---

## Multiplayer Session 2 — 2026-06-26
**Goal:** Multiplayer math buzzer (brief: `.claude/sessions/session-2-multiplayer-math.md`)

### Work done
- `src/lib/mathQuestions.ts`: seeded question generation (easy/medium/hard) via mulberry32 PRNG
- `src/hooks/useMultiplayerMath.ts`: ready-gate, host-arbitrated answer claims, live scoreboard, rankings + XP, `game_sessions` save with daily cap
- `src/pages/MultiplayerMath.tsx`: buzzer overlay ("X buzzed in first"), 3-2-1 countdown between questions, sticky top bar, scoreboard strip, in-app numeric keypad on mobile (iOS Safari can't programmatically open the native keyboard)
- Follow-up fixes: equalized buzzer input timing and hid the next problem during the transition overlay

### Key decisions
- Host-authoritative: only the host advances questions and ends the game; clients broadcast `answer_claimed`
- In-app keypad renders identically on Android/iOS so the buzzer race stays fair

---

## Multiplayer Session 1 — 2026-06-26
**Goal:** Multiplayer infrastructure (brief: `.claude/sessions/session-1-multiplayer-infrastructure.md`)

### Work done
- Migration `20260626000000_add_multiplayer_tables.sql`: `multiplayer_rooms` + `multiplayer_participants` with RLS
- `src/types/multiplayer.ts`: room/participant/event/ranking types
- `src/hooks/useMultiplayerRoom.ts`: create/join/leave, host promotion, `finalizeResults`
- `src/hooks/useRealtimeRoom.ts`: Supabase Realtime channel wrapper (broadcast + presence)
- `src/pages/CreateRoom.tsx`, `RoomLobby.tsx`, `MultiplayerGame.tsx` (game router), player color tokens + `data-mode="multiplayer"` CSS
- `vercel.json` SPA rewrite fix for 404s on refresh

### Key decisions
- No auth required for multiplayer — guests get a `participant_token` UUID in `sessionStorage`, used for RLS
- One Realtime channel per room (`room:<code>`); all game events go through a single `mp_event` broadcast

---

## Session 4 — 2026-06-19
**Goal:** Phase 3 — Typing test session history / personal bests screen

### Work done
- `src/hooks/useTypingHistory.ts`: fetches up to 100 `game_sessions` rows (game_type=typing), computes bestWpm, bestAccuracy, totalXp
- `src/pages/TypingHistory.tsx`: route `/games/typing/history` — 4 personal best cards (Best WPM, Best Acc, Sessions, Total XP) + session log table with date/WPM/acc/XP columns; personal best WPM row gets gold `pb` tag; empty state + guest sign-in prompt
- `src/App.tsx`: added `/games/typing/history` route under `ProtectedRoute`
- `src/pages/TypingTest.tsx`: added "history" link in results action row (hidden for guests)

### Key decisions
- History page uses RPG chrome (page-bg, card borders) not focused mode — it's a stats screen, not active gameplay
- "pb" tag marks the personal best WPM row inline rather than a separate highlight card
- "history" link only shown for authenticated users on the results screen

---

## Session 5 — 2026-06-19
**Goal:** Typing test UI polish — layout restructure, mobile keyboard fix, page background

### Work done
- Removed separate `<header>` from TypingTest; mode selector (30s/60s), countdown timer, and reset button moved into a unified controls bar at the top of a card
- Word display now sits inside a card (`rounded-2xl border border-white/[0.07] bg-white/[0.02]`) for visual depth
- Content anchored to top (`pt-10 sm:pt-14`) instead of `justify-center` — fixes mobile keyboard covering the word area
- Mobile warning moved below the card (no longer blocks the word area)
- Outer wrapper changed from `data-mode="focused"` to `page-bg` — dot grid and ambient glows now show behind the card, consistent with all other pages
- `data-mode="focused"` scoped to the card only so focused color palette still applies to the word area
- "xp cap reached" message changed from `text-focused-incorrect` (red) to muted `opacity-50` — communicates free play continues, not an error
- Unlimited free play confirmed already working: sessions beyond daily cap save with `xp_earned: 0`, game is never blocked

### Key decisions
- `page-bg` on outer wrapper + `data-mode="focused"` on card = background decorations show around the card without cluttering the typing surface
- Anchoring to top (not centering) is the correct fix for mobile keyboard coverage

### Next up (Phase 3 candidates)
- Math/Arithmetic Challenge (route stub exists as coming-soon in GAMES registry)
- Streak badges
- Advanced analytics on History page

---

## Session 4 — 2026-06-19
**Goal:** UI consistency pass — gamified backgrounds + design polish before Phase 3 (game loop expansion)

### Work done
- Added `.page-bg` CSS utility: subtle dot-grid background texture + atmospheric ambient glows (gold top-center, purple bottom-right) applied globally via `background-attachment: fixed`
- Applied `page-bg` to every page root div; removed redundant inline fixed-gradient overlay divs (Dashboard, Auth, Onboarding had these)
- Fixed broken `relative inset-0` gradient div in History (it had no visual effect — `inset-0` requires absolute/fixed positioning)
- GamesHub card polish: icon wrapped in styled container, live cards get gold ring glow on hover, coming-soon cards have muted gradient tint
- Focused mode (`data-mode="focused"`) suppresses dot grid so TypingTest stays clean

### Key decisions
- Dot grid lives in CSS (`.page-bg`), not React — no new components, just a class swap on root divs
- Atmospheric gradients are baked into the same `background-image` stack as the dot grid — no extra DOM nodes
- `background-attachment: fixed` on the grid makes it feel like a persistent game world backdrop, not a per-card texture

### Next up (Phase 3 candidates)
- Typing test session history / personal bests screen
- Math/Arithmetic Challenge (route exists as coming-soon stub in GAMES registry)
- Streak badges
- Advanced analytics on History page

---

## Session 2 — 2026-06-18
**Goal:** Phase 2 — Minigames Hub + Typing Test

### Work done
- DB migration `20260618120000_add_game_tables.sql`: `game_sessions` + `game_stat_mappings` tables, RLS policies
- `src/config/constants.ts`: XP_PER_SESSION_CAP=10, DAILY_SESSION_CAP=3, TYPING_TIMER_OPTIONS=[30,60], etc.
- `src/config/games.ts`: `GameConfig` interface + GAMES registry (typing=live, math=coming-soon); hub reads registry
- `src/data/wordList.ts`: ~270 curated English words for typing pool
- `src/hooks/useGameSessions.ts`: today's session count, stat mapping, `saveSession` (awards XP + syncs title), `saveStatMapping`
- `src/pages/GamesHub.tsx`: grid of game cards from registry, XP rules panel
- `src/pages/TypingTest.tsx`: focused mode, 30s/60s, character-level highlighting, stat picker dialog, results screen
- `src/components/DashboardHeader.tsx`: extracted header with minigame nav icon
- Routes `/games` and `/games/typing` added to App.tsx

### Key decisions
- Game hub reads `GAMES` registry — adding a new game never requires editing the hub
- Focused mode via `data-mode="focused"` on root div; CSS handles all decoration suppression
- Stat picker auto-opens on first visit if no `game_stat_mappings` row for that user+game
- Hidden input at `fixed -left-96 -top-96` captures keystrokes; header buttons use `onMouseDown={e => e.preventDefault()}`

---

## Session 1 — 2026-06-18
**Goal:** Phase 1 — Documentation + Infrastructure foundation

### Work done
- `CLAUDE.md`: full dev context (stack, architecture, route map, hooks, auth, XP system, DB schema, migrations, conventions)
- `docs/PRD.md`: product requirements, feature list, success metrics, out-of-scope
- `docs/DESIGN_SYSTEM.md`: quick-reference for token usage, component patterns, pre-delivery checklist
- `design-system/habit-quest/MASTER.md`: authoritative full design system (colors, typography, spacing, component patterns, focused mode)
- Decisions locked via grill-me session — see `memory/project_roadmap.md` for full decision log

### Key decisions
- Design direction: "RPG chrome on nav/cards/results, focused content during active play"
- Minigame XP formula locked: `min(floor((wpm/10) * (accuracy/100)), 10)`, 3-session daily cap
- All magic numbers go in `src/config/constants.ts`, all game configs in `src/config/games.ts`
