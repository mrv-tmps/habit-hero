# Multiplayer — Design Spec

> Applies to: `/games/room/new`, `/games/room/:code` (lobby), `/games/room/:code/play` (math buzzer + typing race)
> Overrides: MASTER.md §9 App Mode — multiplayer active-play screens use `data-mode="multiplayer"` (defined below in §9 extension).

**Last updated:** 2026-06-26
**Reviewed against MASTER.md:** 2026-06-26

---

## 1. Shared Multiplayer Principles

| Principle | Rule |
|---|---|
| **Lobby is RPG-chrome** | CreateRoom and RoomLobby use full decorative treatment — same as GamesHub cards |
| **Active game is semi-focused** | Strip page chrome (nav, sidebar), but keep the player progress panel visible |
| **Player colors are CSS variables** | Never raw hex. Map player slots 1–8 to `--player-1` through `--player-8` tokens (defined in `src/index.css`) |
| **Room code is always prominent** | Large `font-mono` display, copy-to-clipboard button, visible throughout lobby |
| **Nickname-first identity** | Every player shows as `nickname` in race UI. Authenticated users auto-populate from `character_name`. Guests enter manually. |
| **No emoji as icons** | Rank indicators in results use Lucide icons (`Trophy`, `Medal`, `Award`) — not 🥇 🥈 emoji. MASTER.md §1 enforced. |

### Player Color Tokens

Add to `src/index.css` `:root`:

```css
--player-1: 45 90% 55%;   /* gold — matches --primary */
--player-2: 210 80% 55%;  /* blue — matches --intelligence */
--player-3: 140 65% 45%;  /* green — matches --endurance */
--player-4: 270 60% 60%;  /* purple — matches --accent */
--player-5: 0 75% 55%;    /* red — matches --strength */
--player-6: 30 85% 55%;   /* orange */
--player-7: 180 60% 45%;  /* teal */
--player-8: 300 55% 55%;  /* pink */
```

Use as `bg-[hsl(var(--player-1))]`, `text-[hsl(var(--player-2))]`, etc. The slot number (1–8) is assigned at join time in order. Never write raw HSL or hex in JSX.

### `data-mode="multiplayer"` CSS Extension

Add to `src/index.css` alongside the existing `[data-mode="focused"]` block:

```css
[data-mode="multiplayer"] {
  background: hsl(var(--focused-bg));    /* same deep bg as typing test */
}
[data-mode="multiplayer"] header,
[data-mode="multiplayer"] nav {
  display: none;                          /* suppress app nav */
}
[data-mode="multiplayer"] .card-glow,
[data-mode="multiplayer"] .stat-glow-strength,
[data-mode="multiplayer"] .stat-glow-intelligence,
[data-mode="multiplayer"] .stat-glow-endurance {
  box-shadow: none;
  text-shadow: none;                      /* suppress decorative glows in active game */
}
```

Lobby pages (`/games/room/new`, `/games/room/:code`) do **not** use `data-mode="multiplayer"` — they get full RPG chrome like GamesHub.

### Keyframe Addition

Add `animate-fade-in` to `tailwind.config.ts` and `src/index.css` (it is not in MASTER.md §7 but follows the same pattern):

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

```ts
// tailwind.config.ts — animation section
'fade-in': 'fade-in 150ms ease-out',
```

Add to the `prefers-reduced-motion` block in `src/index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in { animation: none; }
}
```

---

## 2. CreateRoom Page (`/games/room/new`)

**Layout:** Single centered card, max-width `max-w-md`, vertically centered on screen. Full RPG chrome (no `data-mode`).

### Sections (top to bottom)
1. **Header** — game icon (Lucide, `w-6 h-6`) + game name (`text-2xl font-pixel`) + "Multiplayer" label (`text-muted-foreground text-sm font-sans`)
2. **Config form** — shadcn `Select` components for each option:
   - Difficulty: Easy / Medium / Hard (Math only)
   - Mode: English Words / Code Snippet (Typing only); Language select appears conditionally when Code Snippet is chosen
   - Session length: question-count options (10 / 20 / 30 questions) and time-limit options (30s / 60s / 90s) separated by an `<hr>` with a label "— or by time —"
   - Max players: 2 / 4 / 6 / 8
3. **Create Room button** — `Button` full width, `variant="default"` (gold). Shows `Loader2` icon spinning during async create; button disabled while loading.

### Rules
- No raw numbers in JSX — import from `constants.ts` (`MP_QUESTION_COUNT_OPTIONS`, `MP_TIME_LIMIT_OPTIONS`, etc.)
- Form uses React Hook Form + Zod validation matching constants
- All clickable elements have `cursor-pointer`

---

## 3. RoomLobby Page (`/games/room/:code`)

**Layout:** Two-column on desktop (`lg:grid-cols-[1fr_320px]`), single column stack on mobile. Full RPG chrome.

### Left column: Player list
- Section title: "Players" (`text-lg font-semibold font-sans`)
- Each player row: colored dot + nickname (`font-sans text-sm`) + `Badge variant="secondary"` "(Host)" (if host) + `text-muted-foreground text-xs` "(you)"
- Colored dot: `w-3 h-3 rounded-full` with inline style `backgroundColor: hsl(var(--player-N))` — or use a mapped Tailwind arbitrary class per slot
- Empty slots: `border border-dashed border-border rounded-md` placeholder rows, height `h-10`, up to `max_players`
- Player joins animate with `animate-fade-in` (defined in §1 above)
- Z-index: player list is content-flow (`z-10` if elevated)

### Right column: Room info + controls
- **Room code block:**
  ```
  ROOM CODE
  [  X7K2  ] [Copy icon]
  ```
  "ROOM CODE" label: `text-xs font-sans text-muted-foreground uppercase tracking-widest`
  Code: `font-mono text-3xl font-bold text-primary tracking-widest`
  Copy button: `Button variant="ghost" size="icon"` with `Copy` Lucide icon (`w-4 h-4`); swaps to `Check` for 2s on click. `aria-label="Copy room code"`
- **Game summary card:** `bg-secondary rounded-lg p-3` — shows game type, difficulty, session length in `text-sm font-sans text-muted-foreground`
- **Start Game button** (host only): `Button` full-width, disabled until ≥ 2 players. When disabled: `Tooltip` content "Need at least 2 players"
- **Waiting message** (non-host): `text-muted-foreground text-sm font-sans` with a `Loader2` spinning icon inline — "Waiting for host to start…"
- **Leave Room button**: `Button variant="ghost" size="sm" className="text-destructive"`, positioned below main CTA with `mt-4`

### Mobile (< lg)
- Stack order: room code block → player list → controls
- Player list collapses to a horizontal scroll of `w-8 h-8 rounded-full` avatar dots with nickname `text-xs` below each

---

## 4. Multiplayer Math — Active Game

**Route:** `/games/room/:code/play` (game_type = math-buzzer)
**Wrapper:** `data-mode="multiplayer"` on root `<div>`, `min-h-screen flex flex-col`

### Top bar (`z-10`, `sticky top-0`)
- `bg-background/80 backdrop-blur-sm border-b border-border`
- Left: room code `font-mono text-xs text-muted-foreground`
- Center: question counter `Q 3 / 20` in `font-mono text-sm text-foreground`
- Right: timer countdown (time-limit mode only) in `font-mono text-sm text-primary`; pulses `animate-pulse-glow` when ≤ 10s remain

### Main area (flex-1, flex items-center justify-center)
- **Question display:** `font-mono text-3xl font-bold text-foreground text-center` — e.g. `7 × 13 = ?`
- **Answer input:** `font-mono text-2xl text-center max-w-[200px]` centered input with `bg-input border-border`, auto-focused on each question advance
- **Submit on Enter** — no visible submit button (keeps the UI clean)
- **Feedback:**
  - Correct answer: question text flashes `text-[hsl(var(--focused-text-correct))]` via a 150ms `transition-colors` then navigates to next question. Use `animate-pulse-glow` once on the score card of the claiming player.
  - Wrong answer: input shakes via `animate-char-error` (already defined in MASTER.md §7), clears, and re-focuses. No lockout.

### Scoreboard panel (bottom, `z-10`)
- `bg-card border-t border-border px-4 py-2`
- Horizontal scrollable `flex gap-3 overflow-x-auto`
- Each card: `bg-secondary rounded-md px-3 py-2 flex items-center gap-2 shrink-0`
  - Colored dot `w-2 h-2 rounded-full`
  - Nickname: `font-sans text-sm` (not `font-pixel` — illegible at small size per MASTER.md §3)
  - Score: `font-pixel text-xs` — this is a stat/number readout, acceptable use of pixel font at this size if kept to 1–2 digits
  - Current leader: `ring-1 ring-primary ring-offset-1 ring-offset-background`

### Mobile
- Scoreboard moves above question area as a compact strip: just dot + score number, nickname hidden or truncated to 6 chars

---

## 5. Multiplayer Typing Race — Active Game

**Route:** `/games/room/:code/play` (game_type = typing-race)
**Wrapper:** `data-mode="multiplayer"` on root `<div>`, `min-h-screen flex flex-col`

### Progress panel (top, `~120px`, `z-10`, `sticky top-0`)
- `bg-background/90 backdrop-blur-sm border-b border-border px-6 py-3`
- One row per player: colored dot (`w-2 h-2 rounded-full shrink-0`) + nickname (`font-sans text-xs w-24 truncate`) + shadcn `Progress` component (flex-1) + WPM label (`font-mono text-xs text-muted-foreground w-16 text-right`)
- Progress bar fill: override shadcn indicator with player color via CSS custom property on the element: `style={{ '--progress-color': 'hsl(var(--player-N))' }}` and in CSS `[data-slot="progress-indicator"] { background: var(--progress-color); }`
- Animate fill with `transition-[width] duration-200 ease-out` — **not** `transition-all` (respects MASTER.md §7 "only animate transform and opacity" in spirit; `transition-[width]` scopes to one property and avoids layout-jumping side effects)
- Your own row: `bg-secondary/50 rounded-md -mx-1 px-1`
- `prefers-reduced-motion`: wrap the `transition-[width]` in a media-query check; set `transition-none` when reduced motion is preferred

### Typing area (bottom, `flex-1 flex flex-col`)
- Identical token usage to solo TypingTest focused mode: `--focused-bg`, `--focused-text-dim`, `--focused-text-correct`, `--focused-text-incorrect`, `--focused-text-current`, `--focused-caret`
- Words mode: standard word display with character-level coloring, `font-mono text-2xl leading-loose`
- Code mode: `font-mono text-base leading-relaxed whitespace-pre`; language badge `Badge variant="outline" className="absolute top-3 right-3 text-xs"` over the typing area wrapper
- Timer overlay (time-limit mode only): `absolute top-3 left-3 font-mono text-sm text-primary` — does not displace content

---

## 6. Results Screen (shared by both game types)

**Layout:** Centered card `max-w-lg`, full RPG chrome, `bg-card border border-border rounded-xl p-6`. No `data-mode`.

### Sections (top to bottom)

1. **Title:** `font-pixel text-xl text-xpGlow` — "Race Complete!" with `animate-titlePulse` on mount (existing keyframe from MASTER.md §7)

2. **Rankings table** — `w-full border-collapse`:

| Rank icon | Player | Score | XP Earned |
|---|---|---|---|
| `Trophy` (gold) | nickname | 18 pts / 87 WPM | +15 XP `(×1.5)` |
| `Medal` (silver) | nickname | 14 pts / 71 WPM | +10 XP `(×1.25)` |
| `Award` (muted) | nickname | 9 pts / 58 WPM | +7 XP |

   - Rank icons: Lucide `Trophy` (`text-primary` for 1st), `Medal` (`text-muted-foreground` with slight gold tint via `opacity-75 text-primary` for 2nd), `Award` (`text-muted-foreground` for 3rd+). **No emoji.**
   - All icons `w-4 h-4`
   - XP column: only shown when at least one authenticated player in the room. Guests display `—`
   - Multiplier annotation: `text-muted-foreground text-xs` inline — `(×1.5)`
   - Your own row: `bg-secondary/60 rounded-md` row highlight

3. **XP bar animation** (authenticated users only): reuse existing XP bar component from Dashboard. Animate `animate-pulse-glow` once on the fill increment.

4. **CTA row:**
   - `Button variant="default"` — "Play Again" (navigates to `/games/room/new?game=<type>` pre-filled)
   - `Button variant="outline"` — "Back to Games"
   - Stacked on mobile, side-by-side on `sm:flex-row`

5. **Auto-redirect countdown:** `text-muted-foreground text-xs text-center mt-4` — "Returning to games in 8s…" Decrement every second. Controlled by `MP_RESULT_DISPLAY_MS` constant.

---

## 7. Nickname Entry (unauthenticated users)

Shown as a full-screen overlay (`z-30 fixed inset-0 bg-background/80 backdrop-blur-sm`) on `/games/room/:code` if user has no auth session and no `sessionStorage` nickname for this room.

- Centered card `max-w-sm bg-card border border-border rounded-xl p-6`
- Title: `text-lg font-semibold font-sans` — "Enter a nickname to join"
- Input: `font-mono text-base bg-input border-border`, `maxLength={16}`, `placeholder="YourName"`
- Validation message: `text-destructive text-xs mt-1` — shown inline below input
- "Join Room" button: `Button variant="default" w-full` — disabled while input is empty or invalid

---

## 8. Mobile Warning

Multiplayer games inherit the existing desktop-first mobile warning pattern:

- Render a dismissible `Alert` banner (`variant="default"`, Lucide `MonitorSmartphone` icon) at the top of the active game screen (above the progress panel / top bar) on viewports `< md` (768px)
- Text: "Multiplayer games work best on a larger screen."
- `Button variant="ghost" size="sm"` dismiss button; once dismissed, hidden for the session via `useState`. Does not block play.
- Z-index: `z-20` (above content, below modals)

---

## 9. Checklist — Alignment with MASTER.md

Before implementing any multiplayer screen, verify:

- [ ] No emoji used as icons — Lucide only (`Trophy`, `Medal`, `Award`, `Copy`, `Check`, `Users`, `Loader2`, `MonitorSmartphone`)
- [ ] All color values reference CSS variables — no raw hex or HSL in JSX
- [ ] `font-pixel` only used for: game title headers, score numbers in scoreboard, results "Race Complete!" title — never for nicknames or body copy
- [ ] `font-sans` (Inter) for all nicknames, labels, descriptions, button text
- [ ] `font-mono` (JetBrains Mono) for: room code, question display, answer input, WPM readout, timer
- [ ] All animations use `transform` / `opacity` only — or scoped single-property transitions (`transition-[width]`)
- [ ] `animate-fade-in` registered in `tailwind.config.ts` and covered by `prefers-reduced-motion` block
- [ ] `data-mode="multiplayer"` CSS block added to `src/index.css` alongside existing `data-mode="focused"` block
- [ ] `--player-1` through `--player-8` tokens added to `:root` in `src/index.css`
- [ ] Z-index values from defined scale only: `z-10` (top bar, scoreboard), `z-20` (mobile warning), `z-30` (nickname overlay), `z-50` (toasts — unchanged)
- [ ] All interactive elements have `cursor-pointer`
- [ ] Focus states visible (shadcn components handle this via `--ring` token)
- [ ] Responsive tested at 375px · 768px · 1024px · 1440px
