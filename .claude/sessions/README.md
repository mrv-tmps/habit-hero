# Implementation Sessions

Each file is a self-contained brief for a separate Claude Code session. Start a new session, paste the file contents as your first message (or reference the file), and Claude will implement that phase from scratch.

## Sessions

| File | What it builds | Depends on |
|---|---|---|
| `session-1-multiplayer-infrastructure.md` | DB tables, room hooks, Realtime hook, lobby UI, room creation | Nothing — start here |
| `session-2-multiplayer-math.md` | Math buzzer game (question gen, buzzer logic, live scoreboard) | Session 1 |
| `session-3-multiplayer-typing.md` | TypeRacer-style typing race (progress bars, shared word sets) | Session 1 |
| `session-4-code-typing-mode.md` | Code snippet typing (solo TypingTest extension + snippet data file) | Nothing — fully independent |
| `session-5-coin-rush-solo.md` | Coin Rush solo core: 2D arena, rAF movement loop, joystick + WASD, deterministic coins/gems/saws, 90s round, high-score save | Nothing — engine is self-contained |
| `session-6-coin-rush-multiplayer.md` | Coin Rush multiplayer: `useMultiplayerCoinRush`, 10 Hz position sync + interpolation, host-arbitrated coin claims, synced countdown, results + XP | Sessions 1 & 5 |
| `session-7-coin-rush-polish.md` | Coin Rush polish: difficulty tuning, juice, mobile/portrait QA across all breakpoints | Sessions 5 & 6 |
| `session-8-blast-arena-solo.md` | Blast Arena solo core: pixel-art canvas, destructible terrain, deterministic shot sim, slingshot aim, turn loop vs AI bot | Nothing — engine is self-contained |
| `session-9-blast-arena-multiplayer.md` | Blast Arena multiplayer: turn-based shot broadcast, deterministic replay on all clients, host-arbitrated outcomes, results + XP | Sessions 1 & 8 |
| `session-10-blast-arena-polish.md` | Blast Arena polish: pixel sprites, explosion juice, weapon/AI balance, breakpoint QA | Sessions 8 & 9 |

## Recommended order

```
Session 1  →  Session 2  →  Session 3
                                ↑
               Session 4 ───────┘  (can run any time)

Session 5  →  Session 6  →  Session 7        (Coin Rush track)
   ↑             ↑
 self-      needs Session 1
contained   (multiplayer infra)

Session 8  →  Session 9  →  Session 10       (Blast Arena track)
   ↑             ↑
 self-      needs Session 1
contained   (multiplayer infra)
```

Session 4 can be done at any point — it has no dependency on Sessions 1–3. Its output (`src/data/codeSnippets.ts`) is consumed by Session 3, so ideally finish Session 4 before completing Session 3.

**Coin Rush track (5 → 6 → 7):** Session 5 (solo) is fully self-contained and proves the game feel with zero netcode — start there. Session 6 layers multiplayer on top and also needs Session 1's multiplayer infrastructure. Session 7 polishes both. Design reference for all three: `design-system/habit-quest/pages/coin-rush.md`.

**Blast Arena track (8 → 9 → 10):** Turn-based 2D artillery game (Worms / Wild Ones style) with destructible terrain and pixel-art canvas rendering. Session 8 (solo vs AI) contains the whole deterministic engine; Session 9 adds multiplayer by broadcasting one shot event per turn (needs Session 1); Session 10 is the sprite/juice/balance pass. Design reference: `design-system/habit-quest/pages/blast-arena.md`.

## How to start a session

1. Open a new Claude Code session in this repo
2. Say: "Implement the work described in `.claude/sessions/session-N-<name>.md`"
3. Claude will read the brief and CLAUDE.md and proceed

## Design reference

All sessions defer to:
- `design-system/habit-quest/MASTER.md` — global design rules
- `design-system/habit-quest/pages/multiplayer.md` — multiplayer-specific design spec
- `design-system/habit-quest/pages/coin-rush.md` — Coin Rush minigame design spec (Sessions 5–7)
