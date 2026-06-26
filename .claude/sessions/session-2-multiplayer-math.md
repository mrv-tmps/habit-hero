# Session 2 — Multiplayer Math (Buzzer Mode)

**Goal:** Build the math buzzer multiplayer game. All players see the same question simultaneously; first correct answer claims the point and everyone advances. Host is the authority on question progression.

**Prerequisite:** Session 1 must be complete. The following must already exist:
- `src/types/multiplayer.ts`
- `src/hooks/useMultiplayerRoom.ts`
- `src/hooks/useRealtimeRoom.ts`
- `multiplayer_rooms` and `multiplayer_participants` DB tables
- `src/pages/MultiplayerGame.tsx` (stub that will be replaced by this session's work)

---

## Game rules (decided in design session)

- All players see the same question at the same time
- First player to submit the **correct** answer claims 1 point; everyone immediately advances to the next question
- Wrong answers allow retry — no lockout, input just clears and shakes
- Host is authoritative: only host advances the question index and re-broadcasts it
- Questions generated from a shared seed — same seed = same question array on all clients (no question payloads sent over wire)
- Session ends when all questions answered OR time limit reached (whichever first)
- Difficulty tiers:
  - **Easy:** `+` `-` only, numbers 1–20
  - **Medium:** `+` `-` `×` `÷`, numbers 1–50, whole-number answers only
  - **Hard:** two-step mixed ops, numbers 1–100, may include negatives

---

## What to build

### 1. `src/lib/mathQuestions.ts`

Extract question generation from `MathChallenge.tsx` (or write fresh). Must be a pure function — no side effects.

```ts
export interface MathProblem {
  question: string;   // e.g. "7 × 13"
  answer: number;
}

export function generateQuestions(
  seed: number,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard'
): MathProblem[]
```

Use a seeded PRNG (mulberry32 — ~10 lines, no dependency):
```ts
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

Difficulty rules:
- **Easy:** ops `['+', '-']`, operands `randInt(1, 20)`, ensure result ≥ 0 for subtraction
- **Medium:** ops `['+', '-', '×', '÷']`, operands generate as `a × b` first, then question is `a × b = ?` or `(a×b) ÷ a = ?` — guarantees whole-number division answers
- **Hard:** two-step, e.g. `(a × b) - c`, operands 1–100, result can be negative

Generate `count` unique questions. If a duplicate is generated, re-roll (max 3 retries, then accept duplicate — edge case at small counts).

### 2. `src/hooks/useMultiplayerMath.ts`

Combines `useMultiplayerRoom` + `useRealtimeRoom`. Manages all game state.

```ts
interface UseMultiplayerMathReturn {
  phase: 'lobby' | 'active' | 'done';
  questions: MathProblem[];
  currentQuestionIdx: number;
  myScore: number;
  playerScores: Record<string, number>;  // nickname → score
  timeRemaining: number | null;          // null if question-count mode
  submitAnswer: (answer: number) => void;
  rankings: RankedResult[];              // populated when phase === 'done'
}
```

**Event flow:**
1. On `game_start` event: call `generateQuestions(seed, count, difficulty)`, set `phase = 'active'`, start timer if time-limit mode
2. On user submitting answer:
   - Validate locally: `answer === questions[currentQuestionIdx].answer`
   - If correct: broadcast `{ type: 'answer_claimed', question_idx: currentQuestionIdx, by_nickname: myNickname }`
   - If wrong: return `false` (caller shows shake animation)
3. **Host only** — on receiving `answer_claimed` for `currentQuestionIdx`:
   - Increment the claiming player's score
   - Broadcast `{ type: 'question_advance', question_idx: currentQuestionIdx + 1 }`
   - Also broadcast `{ type: 'progress_update', nickname, progress_pct, current_score }` for all players
4. All clients on `question_advance`: update `currentQuestionIdx`. If `idx >= questions.length`, end game.
5. On time limit: host broadcasts `game_end` with final rankings.
6. On `game_end`: host calls `useMultiplayerRoom.finalizeResults` to write DB. All clients set `phase = 'done'`.

**XP calculation** (in `finalizeResults`):
```ts
const baseXp = Math.min(Math.floor((score / 10) * 1.0), XP_PER_SESSION_CAP);
const multiplier =
  position === 1 ? MP_XP_MULTIPLIER_1ST :
  position === 2 ? MP_XP_MULTIPLIER_2ND :
  MP_XP_MULTIPLIER_DEFAULT;
const finalXp = Math.min(Math.floor(baseXp * multiplier), XP_PER_SESSION_CAP);
```

Only save to `game_sessions` for authenticated users (check `user !== null`). Also check `DAILY_SESSION_CAP` — if today's session count ≥ cap, `xp_earned = 0`.

### 3. `src/pages/MultiplayerMath.tsx`

Per design spec `design-system/habit-quest/pages/multiplayer.md §4`.

Root: `<div data-mode="multiplayer" className="min-h-screen flex flex-col">`

**Phases:**

`phase === 'lobby'`: Should not be reached (lobby is on `/games/room/:code`). Show loading spinner.

`phase === 'active'`:
- Top bar (sticky, z-10): room code | question counter `Q {idx+1} / {total}` | timer (if applicable, pulses `animate-pulse-glow` when ≤ 10s)
- Main area (flex-1, centered): question display + answer input
  - Question: `font-mono text-3xl font-bold text-foreground text-center`
  - Input: `font-mono text-2xl text-center max-w-[200px]`, auto-focused, submit on Enter
  - Wrong answer: trigger `animate-char-error` on the input wrapper, clear value, refocus
  - Correct answer (before advancing): flash `text-[hsl(var(--focused-text-correct))]` on the question text for 150ms
- Scoreboard (bottom, z-10): horizontal scrollable strip, one card per player showing colored dot + `font-sans text-sm` nickname + `font-pixel text-xs` score. Leader gets `ring-1 ring-primary`

`phase === 'done'`:
- Navigate to results view (can be inline state or a separate sub-component `<MultiplayerResults />`)
- Show full results screen per `multiplayer.md §6`
- Auto-redirect to `/games` after `MP_RESULT_DISPLAY_MS`

### 4. Wire up `src/pages/MultiplayerGame.tsx`

Replace the stub. This component:
- Loads the room from DB by `code` param
- If `room.game_type === 'math-buzzer'` → renders `<MultiplayerMath />`
- If `room.game_type === 'typing-race'` → renders placeholder `<div>Typing race coming soon</div>` (Session 3)
- Handles loading and not-found states

---

## Design reference

`design-system/habit-quest/pages/multiplayer.md` — sections 4, 6
`design-system/habit-quest/MASTER.md` — §3 typography (font-pixel only for numbers/titles), §7 animation (char-error, pulse-glow are already defined)

---

## Definition of done

- [x] Two players in the same room both see the same question simultaneously
- [x] First correct answer claims the point; both players see the scoreboard update and question advance
- [x] Wrong answer shakes the input and allows retry
- [x] All questions exhausted → results screen shows rankings with XP multipliers
- [x] Time limit mode ends the game at 0s → results screen
- [x] Authenticated users have XP saved to `game_sessions`; guests show score only
- [x] `font-pixel` not used for nicknames (only score numbers and result title)
- [x] No TypeScript errors

## Delivered beyond spec

- **Ready phase** — before questions start, all players see a "I'm Ready!" screen with a live list of who has readied up. Host broadcasts `game_begin` once everyone is ready; game is gated until that point.
- **Buzzer overlay** — 1.5 s overlay showing the claimer's name and the correct answer, then transitions to a 3–2–1 countdown before the next question appears. Timer is anchored to mount via `useRef` (not `[onDone]` deps) so re-renders can't reset it.
- **Big loading screen** — full-page `Zap` icon + spinner while `MultiplayerGame.tsx` fetches the room, replacing the previous tiny spinner.
- **Stable hook refs** — `useMultiplayerRoom` wraps all returned functions in `useCallback([])`. Without this, functions in `useEffect` deps caused an infinite re-fetch loop that eventually hit a transient error and navigated players back to `/games` mid-game.
- New realtime events: `player_ready` and `game_begin` added to `MultiplayerEvent`.
