# Habit Quest — Design System Reference

> **Authoritative source:** `design-system/habit-quest/MASTER.md`
> **Per-page overrides:** `design-system/habit-quest/pages/[page-name].md` — these override this doc and the MASTER when they exist.
>
> This file is the quick-reference for implementation. If something here conflicts with the MASTER, the MASTER wins.

---

## Principles

| Principle | What it means in practice |
|---|---|
| Dark by default | No light mode. Every token assumes a dark context. Never add a theme toggle. |
| Token-first | No raw hex or HSL values in component code. Use CSS variables or Tailwind semantic classes. |
| RPG chrome, focused content | Glows, pixel fonts, and animations live in nav, cards, and results screens. Strip all of it during active minigame play. |
| Mobile-aware, desktop-first for games | Habit tracker pages: mobile-first (375px). Minigame active screens: desktop-first with a mobile warning banner. |
| Lucide icons only | Never use emoji as icons. Emoji appear only in user-chosen avatar data. |

---

## Color Tokens

All tokens are HSL CSS variables in `src/index.css :root`. Reference in JSX via Tailwind semantic classes or `hsl(var(--token))`.

### Core

| Token | Tailwind class | Role |
|---|---|---|
| `--background` | `bg-background` | Page background (`#121218`) |
| `--foreground` | `text-foreground` | Primary text (`#F5F2EB`) |
| `--card` | `bg-card` | Card surface (`#1A1A24`) |
| `--card-foreground` | `text-card-foreground` | Text on cards |
| `--primary` | `bg-primary` / `text-primary` | Gold — CTAs, XP bar, highlights (`#EBAB17`) |
| `--primary-foreground` | `text-primary-foreground` | Text on primary background |
| `--secondary` | `bg-secondary` | Secondary surfaces (`#272733`) |
| `--muted` | `bg-muted` | Muted backgrounds (`#2B2B38`) |
| `--muted-foreground` | `text-muted-foreground` | Placeholder, subtle text (`#8F8FA0`) |
| `--accent` | `bg-accent` | Purple — level badge, accent (`#8C52CC`) |
| `--border` | `border-border` | All borders (`#363647`) |
| `--input` | `bg-input` | Input backgrounds |
| `--ring` | *(focus ring)* | Focus ring (gold) |
| `--destructive` | `text-destructive` | Errors, destructive actions (`#E03030`) |

### Gamification

| Token | Tailwind class | Role |
|---|---|---|
| `--strength` | `text-strength` | Red — Strength stat |
| `--intelligence` | `text-intelligence` | Blue — Intelligence stat |
| `--endurance` | `text-endurance` | Green — Endurance stat |
| `--xp-glow` | `text-xpGlow` | Gold glow on XP numbers |
| `--level-badge` | `bg-levelBadge` | Purple on level / title badge |

### Focused Mode (typing test active state)

Applied automatically via `[data-mode="focused"]` CSS selectors. Do not apply these manually in child components.

| Token | Role |
|---|---|
| `--focused-bg` | Deeper background (`#0B0B12`) |
| `--focused-text-dim` | Upcoming (not yet typed) words |
| `--focused-text-correct` | Correctly typed characters |
| `--focused-text-incorrect` | Incorrectly typed characters |
| `--focused-text-current` | Current character cursor highlight |
| `--focused-caret` | Blinking caret (gold) |

Tailwind classes: `text-focused-correct` · `text-focused-incorrect` · `text-focused-current` · `text-focused-dim`

### Game Hub

| Token | Tailwind class | Role |
|---|---|
| `--game-live` | `text-game-live` | Green badge on available games |
| `--game-coming-soon` | `text-game-comingSoon` | Gray — coming soon card text |

---

## Typography

Three font roles. Never mix them within the same semantic layer.

| Role | Font | Tailwind class | Where |
|---|---|---|---|
| Brand / Pixel | Press Start 2P | `font-pixel` | Character titles, rank names, level badges, logo |
| Body / UI | Inter | `font-sans` (default) | All body text, buttons, labels, forms |
| Focused / Mono | JetBrains Mono | `font-mono` | Typing test words, WPM counter, accuracy readout |

### Type scale

| Class | px | Weight | Usage |
|---|---|---|---|
| `text-xs` | 12px | 400 | Timestamps, icon labels |
| `text-sm` | 14px | 400–500 | Secondary labels, stat descriptions |
| `text-base` | 16px | 400 | Body text |
| `text-lg` | 18px | 500–600 | Card titles, section headers |
| `text-xl` | 20px | 600 | Page subheadings |
| `text-2xl` | 24px | 700 | Page titles, typing test word display |
| `text-3xl` | 30px | 700 | Hero numbers (WPM) |
| `font-pixel` | Keep at 10–14px | — | Pixel font renders large; size down |

Rules:
- `leading-relaxed` for body, `leading-none` for pixel headings
- `max-w-[65ch]` on prose content
- Never use `font-pixel` for body copy
- Typing test word display: `font-mono text-2xl leading-loose` minimum

---

## Spacing

4px base unit. Tailwind utilities only — no raw `px` values in components.

| Tailwind | px | Common use |
|---|---|---|
| `gap-1` / `p-1` | 4px | Icon gaps, tight inline spacing |
| `gap-2` / `p-2` | 8px | Badge padding |
| `gap-3` / `p-3` | 12px | Compact buttons, pill badges |
| `gap-4` / `p-4` | 16px | Standard card padding |
| `gap-6` / `p-6` | 24px | Section-level gaps |
| `gap-8` / `p-8` | 32px | Large section separation |
| `gap-12` / `p-12` | 48px | Section margins |
| `gap-16` / `p-16` | 64px | Hero / page-level padding |

---

## Breakpoints

| Name | Min-width | Context |
|---|---|---|
| *(base)* | 0 | Mobile phones (375px min) |
| `xs` | 480px | Large phones |
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets — layout shift |
| `lg` | 1024px | Desktop — full nav |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1400px | Max container width |

Test every UI change at: **375px · 768px · 1024px · 1440px**

| Feature area | Strategy |
|---|---|
| Dashboard, History, Settings | Mobile-first — design at 375px, scale up |
| Games Hub (`/games`) | Mobile-first — cards stack on mobile, grid on desktop |
| Typing Test (`/games/typing`) | Desktop-first — show mobile warning banner, still functional |
| Modals / Dialogs | Centered on desktop, full-screen sheet on mobile |

---

## Z-Index Scale

Never use arbitrary z-index values.

| Value | Usage |
|---|---|
| `z-10` | Elevated cards, sticky content elements |
| `z-20` | Dropdowns, tooltips, popovers |
| `z-30` | Modals and dialog panels |
| `z-40` | Modal backdrops / overlays |
| `z-50` | Toast notifications — always on top |

---

## Animation

### Timing

| Type | Duration | Easing | Example |
|---|---|---|---|
| Micro-interaction | 150ms | `ease-out` | Button hover, badge color |
| Standard transition | 200ms | `ease-out` | Card hover, modal open/close |
| Emphasis | 300ms | `ease-in-out` | Level-up scale, title unlock |
| Continuous loop | 1.5–2s | `ease-in-out` | XP glow pulse, caret blink |

Only animate `transform` and `opacity`. Never animate `width`, `height`, `top`, or `left`.

### Keyframes

| Tailwind class | Effect | Where |
|---|---|---|
| `animate-titlePulse` | Scale + gold glow | Title unlock celebration |
| `animate-level-up` | Scale bounce | Level badge on XP gain |
| `animate-point-added` | Float up + fade | Floating XP text |
| `animate-pulse-glow` | Opacity pulse | XP bar glow, stat borders |
| `animate-caret-blink` | Opacity blink 0→1→0 | Typing test caret |
| `animate-char-error` | Horizontal shake 3px | Incorrect character typed |

All looping animations are suppressed under `prefers-reduced-motion` in `src/index.css`. When adding a new looping animation, add it to that media query block.

---

## Glow & Shadow Classes

Active in app mode. Fully suppressed in focused mode via `[data-mode="focused"] * { box-shadow: none; text-shadow: none; }`.

| Class | Effect | Where |
|---|---|---|
| `.text-glow` | Gold text-shadow | XP totals, level numbers |
| `.stat-glow-strength` | Red box-shadow | Strength stat card border |
| `.stat-glow-intelligence` | Blue box-shadow | Intelligence stat card border |
| `.stat-glow-endurance` | Green box-shadow | Endurance stat card border |
| `.card-glow` | Ambient gold shadow | Character card, featured elements |

User-defined stats beyond the three named defaults use no glow class.

---

## App Mode vs. Focused Mode

Set `data-mode="focused"` on the **top-level wrapper** of the TypingTest page. Child components never need conditional logic for this — the CSS selectors handle all changes.

| Feature | App Mode | Focused Mode |
|---|---|---|
| Background | `bg-background` | `var(--focused-bg)` |
| Font | Inter + Press Start 2P | JetBrains Mono only |
| Glows | Active | None |
| Animations | Full RPG set | `animate-caret-blink` + `animate-char-error` only |
| Header | Full RPG header | Minimal: timer + mode selector + restart icon |
| RPG chrome | Visible | Hidden during test, restored on results screen |

---

## Component Patterns

### Stat Card

```
┌─────────────────────────────┐
│ [emoji]  Stat Name    [pts] │  bg-card border-border rounded-lg
│ habit description text      │  text-muted-foreground text-sm
│ [  Complete Quest  ]        │  bg-primary text-primary-foreground
└─────────────────────────────┘
```

- Completed state: button `disabled` + card `opacity-50 border-muted`
- Apply `.stat-glow-[type]` to applicable named stat types
- Always wrap completion in `AlertDialog` confirmation

### Game Card (Hub)

```
┌─────────────────────────────┐
│ [LucideIcon w-8 h-8]  [LIVE]│  badge: bg-game-live or bg-muted
│ Game Name                   │  text-lg font-semibold
│ Short one-line description  │  text-muted-foreground text-sm
│ [  Play Now →  ]            │  only if status = 'live'
└─────────────────────────────┘
```

- Live hover: `hover:border-primary/50 hover:bg-secondary transition-colors duration-200`
- Coming soon: `opacity-60 cursor-default` — no hover effect

### Typing Test Layout (Focused Mode)

```
[Minimal header: 30s | 60s · Restart icon]

         the quick brown fox jumps over
         the lazy dog and then some more
         words appear here for you to type

[Results only after: WPM · Accuracy · XP Earned · Retry]
```

- Word display: `font-mono text-2xl leading-loose max-w-[700px] mx-auto`
- Character state classes: `text-focused-correct` / `text-focused-incorrect` / `text-focused-current` / `text-focused-dim`
- Caret: `absolute w-0.5 h-7 bg-[var(--focused-caret)] animate-caret-blink`

### Character Card

```
┌─────────────────────────────┐
│ [Avatar]  Name        Lv. N │  level: bg-levelBadge font-pixel text-xs
│ [★★★ Title Pill]            │  animate-titlePulse if recently unlocked
│ ████████░░  NNN / MMM XP   │  XP bar + text-glow on numbers
└─────────────────────────────┘
```

---

## Game Registry Contract

Every minigame must export a `GameConfig` entry in `src/config/games.ts`. The hub reads this registry — adding a game must not require touching the hub component.

```ts
interface GameConfig {
  id: string                                              // 'typing' | 'math'
  label: string                                           // Display name
  description: string                                     // One-line for game card
  icon: LucideIcon
  route: string                                           // '/games/typing'
  status: 'live' | 'coming-soon'
  defaultStatType: string                                 // 'intelligence' | 'strength'
  xpFormula: (score: number, accuracy: number) => number
  sessionCapPerDay: number                                // 3
  xpCapPerSession: number                                 // 10
}
```

---

## Constants Reference

All magic numbers live in `src/config/constants.ts`. Never hardcode these in components.

| Constant | Value |
|---|---|
| `XP_PER_SESSION_CAP` | 10 |
| `DAILY_SESSION_CAP` | 3 |
| `TYPING_TIMER_OPTIONS` | `[30, 60]` (seconds) |
| `TYPING_WORD_POOL_SIZE` | 50 (words queued at a time) |
| `TITLE_TIERS` | 16 |
| `MAX_LEADERBOARD_ENTRIES` | 20 |

---

## Pre-Delivery Checklist

Before committing any UI work:

- [ ] No raw hex/HSL values in component code
- [ ] No emoji used as icons — Lucide only
- [ ] `cursor-pointer` on all interactive elements
- [ ] Hover states use `transition-colors duration-200` (not `transition-all`)
- [ ] Focus rings visible (`ring-ring` via shadcn defaults or explicit `outline`)
- [ ] Color alone never conveys state — always pair with text or icon
- [ ] `prefers-reduced-motion` handled on all new keyframe animations
- [ ] Touch targets minimum 44×44px
- [ ] Responsive tested at 375px · 768px · 1024px · 1440px
- [ ] No horizontal scroll at any breakpoint
- [ ] Icon-only buttons have `aria-label`
- [ ] Game pages: `data-mode="focused"` set on wrapper, glows suppressed during active test
