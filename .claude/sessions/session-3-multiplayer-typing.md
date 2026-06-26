# Session 3 — Multiplayer Typing Race

**Goal:** Build the TypeRacer-style multiplayer typing game. All players type the same word set simultaneously; progress is shown as live labeled progress bars per player.

**Prerequisite:** Sessions 1 AND 2 must be complete. The following must already exist:
- `src/types/multiplayer.ts`
- `src/hooks/useMultiplayerRoom.ts`
- `src/hooks/useRealtimeRoom.ts`
- `src/pages/MultiplayerGame.tsx` (renders the appropriate game by `game_type`)
- Session 4 (code snippets) is independent — if `src/data/codeSnippets.ts` doesn't exist yet, english-words mode still works; code mode just needs the file

---

## Game rules (decided in design session)

- All players type the same set of words (or code snippet) generated from a shared seed
- Progress broadcast to all players every 250ms (throttled)
- Progress displayed as one labeled progress bar per player (% of words/characters completed + live WPM)
- Player finishes when they complete all words/characters
- Host tracks all finishes; when all players finish (or time limit hits), host broadcasts `game_end`
- XP formula: WPM-based (same as solo typing), with position bonus multiplier

---

## What to build

### 1. `src/lib/typingWordSets.ts`

Pure function, no side effects:

```ts
import { WORD_LIST } from '../data/wordList';
import { CODE_SNIPPETS } from '../data/codeSnippets';  // may not exist yet — guard with try/catch or optional import

export function generateWordSet(
  seed: number,
  mode: 'english' | 'code',
  language?: 'javascript' | 'python' | 'c'
): string[] {
  if (mode === 'code' && language) {
    // Pick snippet by seed index
    // Split into individual characters (typing is char-by-char in code mode)
    // Return as array of characters? Or return as single string?
    // Return as array of "words" where each word is a line — caller decides render
  }
  // english: shuffle WORD_LIST with seed, return first 60 words
}
```

Use the same `mulberry32` seeded PRNG from `src/lib/mathQuestions.ts` (import or duplicate — keep the file self-contained).

For code mode: return the snippet as a flat character array. The typing component handles display. Select snippet: `snippets.filter(s => s.language === language)[seed % count]`.

### 2. Refactor `src/pages/TypingTest.tsx` → extract `src/lib/typingRender.ts`

Before building the multiplayer typing component, extract the character-level rendering logic from the solo `TypingTest.tsx` into a shared utility so it isn't duplicated.

Extract:
- The function that maps a word + typed characters → `{ char, status: 'correct' | 'incorrect' | 'upcoming' | 'current' }[]`
- The WPM calculation function: `calculateWpm(wordsCompleted: number, elapsedSeconds: number): number`
- The accuracy calculation function

These become pure functions in `src/lib/typingRender.ts`. Import them in `TypingTest.tsx` (no behavior change) and in `MultiplayerTyping.tsx`.

### 3. `src/hooks/useMultiplayerTyping.ts`

Combines `useMultiplayerRoom` + `useRealtimeRoom`. Manages typing game state.

```ts
interface UseMultiplayerTypingReturn {
  phase: 'lobby' | 'active' | 'done';
  words: string[];                          // from generateWordSet
  wordIdx: number;                          // current word being typed
  typedChars: string;                       // characters typed for current word
  myWpm: number;
  myProgressPct: number;
  playerProgress: Record<string, {          // nickname → progress
    progress_pct: number;
    wpm: number;
    finished: boolean;
  }>;
  timeRemaining: number | null;
  handleKeyDown: (e: KeyboardEvent) => void;
  rankings: RankedResult[];
}
```

**Progress broadcast:**
- Use `useRef` to store `lastBroadcastTime`
- On every `wordIdx` change or character typed: check if `Date.now() - lastBroadcastTime >= MP_PROGRESS_BROADCAST_MS`
- If yes: broadcast `{ type: 'progress_update', nickname, progress_pct: wordIdx / words.length, current_score: wordIdx, wpm: myWpm }`

**Finish detection:**
- When `wordIdx >= words.length`: broadcast `{ type: 'player_finished', nickname, final_score: wordIdx, wpm: myWpm }`
- Host tracks received `player_finished` events. When count equals participant count OR time limit hit: compute rankings, broadcast `game_end`, call `finalizeResults`.

**XP:**
```ts
const baseXp = Math.min(Math.floor((wpm / 10) * accuracy), XP_PER_SESSION_CAP);
const multiplier = position === 1 ? MP_XP_MULTIPLIER_1ST : position === 2 ? MP_XP_MULTIPLIER_2ND : MP_XP_MULTIPLIER_DEFAULT;
const finalXp = Math.min(Math.floor(baseXp * multiplier), XP_PER_SESSION_CAP);
```

### 4. `src/pages/MultiplayerTyping.tsx`

Per design spec `design-system/habit-quest/pages/multiplayer.md §5`.

Root: `<div data-mode="multiplayer" className="min-h-screen flex flex-col">`

**Layout:**

Top section — Progress panel (`sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border px-6 py-3`):
- One row per player (sorted: local player first, then by progress descending)
- Row: colored dot (`w-2 h-2 rounded-full shrink-0`) + nickname (`font-sans text-xs w-24 truncate`) + `Progress` component (flex-1) + WPM (`font-mono text-xs text-muted-foreground w-16 text-right`)
- Progress bar fill: set player color via CSS custom property `--progress-color: hsl(var(--player-N))` on row element; override shadcn indicator with `[data-slot="progress-indicator"] { background: var(--progress-color); }`
- Animate with `transition-[width] duration-200 ease-out` (not `transition-all`)
- Own row: `bg-secondary/50 rounded-md -mx-1 px-1`
- `prefers-reduced-motion`: no transition on reduced motion

Bottom section — Typing area (flex-1):
- **English mode:** identical character-level rendering to solo TypingTest. Use shared `typingRender.ts` utilities. `font-mono text-2xl leading-loose`
- **Code mode:** `font-mono text-base leading-relaxed whitespace-pre`. Language badge `Badge variant="outline"` in top-right corner of typing area. Characters are typed one by one through the snippet.
- Hidden `<input>` captures keystrokes (same pattern as solo TypingTest), auto-focused on game start

**Mobile warning** (< 768px): dismissible `Alert` banner with `MonitorSmartphone` icon above progress panel, `z-20`

### 5. Update `src/pages/MultiplayerGame.tsx`

Replace the Session 2 placeholder for `typing-race`:
```tsx
if (room.game_type === 'typing-race') return <MultiplayerTyping room={room} />;
```

### 6. Update `src/pages/CreateRoom.tsx`

Typing-specific config options (already stubbed in Session 1 but need wiring):
- Mode select: "English Words" / "Code Snippet" — only shown when `game_type === 'typing-race'`
- Language select (C / Python / JavaScript): conditionally shown when mode = "Code Snippet"
- Persist `typing_mode` and `code_language` in room config. Add these columns to the DB if not already present:

```sql
-- Add to multiplayer_rooms if missing (new migration)
ALTER TABLE multiplayer_rooms ADD COLUMN IF NOT EXISTS typing_mode TEXT CHECK (typing_mode IN ('english', 'code'));
ALTER TABLE multiplayer_rooms ADD COLUMN IF NOT EXISTS code_language TEXT CHECK (code_language IN ('javascript', 'python', 'c'));
```

Create new migration file: `supabase/migrations/20260626000001_add_typing_mode_columns.sql`

---

## Design reference

`design-system/habit-quest/pages/multiplayer.md` — sections 5, 6
`design-system/habit-quest/MASTER.md` — §7 animation (only transform/opacity; scoped `transition-[width]` acceptable for progress bars), §3 typography (font-mono for typing area, font-sans for nicknames)

---

## Definition of done

- [ ] Two players in the same room both see the same words (or code snippet) to type
- [ ] Progress bars update in real time as players type (~250ms)
- [ ] Own progress bar is highlighted; others are labeled with nickname + WPM
- [ ] Player finishes → their bar fills 100%, marked done
- [ ] All players finish or time limit hits → results screen with WPM + rankings + XP
- [ ] Code mode: snippet renders with whitespace preserved, language badge visible
- [ ] `typingRender.ts` extracted — solo TypingTest still works identically
- [ ] No TypeScript errors
