# Session 4 — Code Typing Mode

**Goal:** Add a "code snippet" typing mode to the solo typing test and supply the snippet data that multiplayer (Session 3) also uses. This session is fully independent — it can be done before, after, or in parallel with Sessions 2 and 3.

**Prerequisite:** Session 1 is not required. This is a standalone feature on the existing solo `TypingTest`.

---

## What to build

### 1. `src/data/codeSnippets.ts`

```ts
export type CodeLanguage = 'javascript' | 'python' | 'c';

export interface CodeSnippet {
  id: string;
  language: CodeLanguage;
  label: string;        // human-readable, e.g. "FizzBuzz"
  code: string;         // 150–300 chars, tabs normalized to 2 spaces
}

export const CODE_SNIPPETS: CodeSnippet[] = [ /* ... */ ];
```

Include **5–8 snippets per language** (15–24 total). Use classic, universally-recognized algorithms so players of any background can read them:

**JavaScript snippets (examples):**
- FizzBuzz
- Fibonacci (iterative)
- Array reverse
- Palindrome check
- Binary search
- Factorial (recursive)

**Python snippets (examples):**
- FizzBuzz
- Fibonacci (iterative)
- List comprehension filter
- Palindrome check
- Bubble sort pass
- Simple class definition

**C snippets (examples):**
- FizzBuzz
- Fibonacci (iterative)
- String length
- Array sum
- Factorial
- Swap two variables

**Snippet authoring rules:**
- Max 300 characters per snippet — keeps a race under ~3 minutes at 60 WPM
- Min 150 characters — enough to be interesting
- Normalize all `\t` to 2 spaces (no literal tab characters)
- Include newlines as `\n` — they are typeable characters in code mode
- No trailing whitespace on any line
- Snippets should compile/run correctly — they represent real code

**Example:**
```ts
{
  id: 'js-fizzbuzz',
  language: 'javascript',
  label: 'FizzBuzz',
  code: `function fizzBuzz(n) {\n  for (let i = 1; i <= n; i++) {\n    if (i % 15 === 0) console.log("FizzBuzz");\n    else if (i % 3 === 0) console.log("Fizz");\n    else if (i % 5 === 0) console.log("Buzz");\n    else console.log(i);\n  }\n}`,
}
```

### 2. Extend `src/pages/TypingTest.tsx`

Add a `mode` prop with `'words' | 'code'` (default `'words'`) so the solo page is backward compatible.

Add a mode selector UI to the pre-game / settings bar (same row as the time selector):
- Segmented control or two `Button variant="ghost"` tabs: "Words" | "Code"
- When "Code" selected: show a language select (`Select` with C / Python / JavaScript options)
- On mode/language change: reset the current test (same behavior as changing time mode)

**In code mode:**
- Instead of `WORD_LIST`, the typing content is the `code` string from a randomly selected snippet (deterministic: use `Math.floor(Math.random() * snippets.length)` on test start, re-randomized on restart)
- The typing area switches to `font-mono text-base leading-relaxed whitespace-pre` (from `font-mono text-2xl leading-loose` in words mode)
- Language badge: `Badge variant="outline" className="absolute top-3 right-3 text-xs"` over the typing area wrapper. Text: `"JavaScript"` / `"Python"` / `"C"`
- Characters are typed one-by-one through the entire snippet string (including spaces, newlines, and punctuation)
- Newlines: when the cursor reaches a `\n` character, pressing Enter counts as typing it correctly; the display wraps to the next line visually
- Incorrect characters still show `--focused-text-incorrect` coloring
- WPM calculation stays the same: characters typed ÷ 5 ÷ elapsed minutes (standard CPM/5 formula)

**Preserve existing behavior:**
- Words mode: no changes to existing rendering or timing logic
- Time modes (30s / 60s): work in both words and code mode
- Results screen: unchanged — still shows WPM, accuracy, XP earned
- `data-mode="focused"` wrapper: unchanged

### 3. Keyboard handling for newlines in code mode

Current TypingTest likely ignores Enter key. In code mode:
- If the expected character at cursor is `\n`: treat Enter key as typing the correct character
- All other keys behave normally
- The visible display should show the newline as a line break in the rendered text

---

## Design reference

`design-system/habit-quest/MASTER.md` — §3 typography (font-mono for typing area; `whitespace-pre` for code display), §9 focused mode (still active in code mode — same tokens)
`design-system/habit-quest/pages/multiplayer.md` — §5 typing area (code mode rendering rules are identical for solo and multiplayer)

---

## Definition of done

- [ ] `src/data/codeSnippets.ts` exists with ≥5 snippets per language (C, Python, JavaScript)
- [ ] All snippet strings are 150–300 chars, no literal tabs, no trailing whitespace
- [ ] Solo TypingTest shows "Words" / "Code" mode selector in the settings bar
- [ ] In code mode: snippet displays with preserved whitespace and indentation
- [ ] Language badge visible in code mode
- [ ] Enter key types the newline character correctly
- [ ] Switching between modes resets the test
- [ ] Words mode behavior is completely unchanged
- [ ] No TypeScript errors
