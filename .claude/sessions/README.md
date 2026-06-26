# Implementation Sessions

Each file is a self-contained brief for a separate Claude Code session. Start a new session, paste the file contents as your first message (or reference the file), and Claude will implement that phase from scratch.

## Sessions

| File | What it builds | Depends on |
|---|---|---|
| `session-1-multiplayer-infrastructure.md` | DB tables, room hooks, Realtime hook, lobby UI, room creation | Nothing — start here |
| `session-2-multiplayer-math.md` | Math buzzer game (question gen, buzzer logic, live scoreboard) | Session 1 |
| `session-3-multiplayer-typing.md` | TypeRacer-style typing race (progress bars, shared word sets) | Session 1 |
| `session-4-code-typing-mode.md` | Code snippet typing (solo TypingTest extension + snippet data file) | Nothing — fully independent |

## Recommended order

```
Session 1  →  Session 2  →  Session 3
                                ↑
               Session 4 ───────┘  (can run any time)
```

Session 4 can be done at any point — it has no dependency on Sessions 1–3. Its output (`src/data/codeSnippets.ts`) is consumed by Session 3, so ideally finish Session 4 before completing Session 3.

## How to start a session

1. Open a new Claude Code session in this repo
2. Say: "Implement the work described in `.claude/sessions/session-N-<name>.md`"
3. Claude will read the brief and CLAUDE.md and proceed

## Design reference

All sessions defer to:
- `design-system/habit-quest/MASTER.md` — global design rules
- `design-system/habit-quest/pages/multiplayer.md` — multiplayer-specific design spec
