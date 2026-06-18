# Habit Quest — Design System

> **Rule:** When building a specific page or feature, first check `design-system/habit-quest/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow all rules below.

**Last updated:** 2026-06-18
**Stack:** React + TypeScript + Tailwind CSS + shadcn/ui (Radix UI)

---

## 1. Principles

| Principle | Rule |
|---|---|
| **Dark by default** | The app is permanently dark. No light mode. All tokens assume a dark context. |
| **Token-first** | Never write a raw hex or HSL value in component code. Always reference a CSS variable or Tailwind semantic color. |
| **RPG chrome, focused content** | Decorative elements (glows, pixel fonts, animations) live in the nav, cards, and results screens. During active gameplay, strip all chrome — just text on dark. |
| **Mobile-aware, desktop-first for games** | The habit tracker is mobile-first. Minigames are desktop-first with a graceful mobile fallback warning. |
| **No emoji icons** | All icons use Lucide React. Emoji may appear only as user-chosen character avatars in data. |

---

## 2. Color System

All colors are HSL CSS variables defined in `src/index.css `:root`. Reference via Tailwind semantic classes or `hsl(var(--token))`.

### Core Tokens

| Token | HSL | Hex Approx | Role |
|---|---|---|---|
| `--background` | `240 10% 8%` | `#121218` | Page background |
| `--foreground` | `45 20% 95%` | `#F5F2EB` | Primary text |
| `--card` | `240 10% 12%` | `#1A1A24` | Card surface |
| `--card-foreground` | `45 20% 95%` | `#F5F2EB` | Text on cards |
| `--primary` | `45 90% 55%` | `#EBAB17` | Gold — CTAs, XP bar, highlights |
| `--primary-foreground` | `240 10% 8%` | `#121218` | Text on primary background |
| `--secondary` | `240 10% 18%` | `#272733` | Secondary surfaces |
| `--muted` | `240 10% 20%` | `#2B2B38` | Muted backgrounds |
| `--muted-foreground` | `240 5% 60%` | `#8F8FA0` | Placeholder, subtle text |
| `--accent` | `270 60% 60%` | `#8C52CC` | Purple — level badge, accent |
| `--border` | `240 10% 25%` | `#363647` | All borders |
| `--input` | `240 10% 20%` | `#2B2B38` | Input backgrounds |
| `--ring` | `45 90% 55%` | `#EBAB17` | Focus ring |
| `--radius` | `0.75rem` | `12px` | Border radius base |
| `--destructive` | `0 70% 50%` | `#E03030` | Errors, destructive actions |

### Gamification Tokens

| Token | HSL | Usage |
|---|---|---|
| `--strength` | `0 75% 55%` | Red — Strength stat color |
| `--intelligence` | `210 80% 55%` | Blue — Intelligence stat color |
| `--endurance` | `140 65% 45%` | Green — Endurance stat color |
| `--xp-glow` | `45 100% 60%` | Gold glow on XP elements |
| `--level-badge` | `270 70% 50%` | Purple on level / title badge |

### Focused Mode Tokens (typing test active state)

| Token | HSL | Usage |
|---|---|---|
| `--focused-bg` | `240 15% 5%` | Deeper background during active typing |
| `--focused-text-dim` | `240 5% 45%` | Upcoming (not yet typed) words |
| `--focused-text-correct` | `45 20% 90%` | Correctly typed characters |
| `--focused-text-incorrect` | `0 75% 55%` | Incorrectly typed characters |
| `--focused-text-current` | `45 90% 55%` | Current character cursor highlight |
| `--focused-caret` | `45 90% 55%` | Blinking caret color (gold) |

### Game Hub Tokens

| Token | HSL | Usage |
|---|---|---|
| `--game-live` | `140 65% 45%` | Green badge on available games |
| `--game-coming-soon` | `240 5% 35%` | Gray — coming soon card text |

### Tailwind Semantic Colors (use these in JSX)

`bg-background` · `text-foreground` · `bg-card` · `text-primary` · `bg-secondary`
`text-muted-foreground` · `bg-accent` · `border-border` · `text-strength`
`text-intelligence` · `text-endurance` · `bg-levelBadge` · `text-xpGlow`

---

## 3. Typography

Three font roles. Each has a strict context. Never mix roles within the same semantic layer.

### Font Stack

| Role | Font | Tailwind Class | Context |
|---|---|---|---|
| **Brand / Pixel** | Press Start 2P | `font-pixel` | Character titles, rank names, level badges, logo mark |
| **Body / UI** | Inter | `font-sans` (default) | All body text, buttons, labels, form inputs, descriptions |
| **Focused / Mono** | JetBrains Mono | `font-mono` | Typing test word display, WPM counter, accuracy readout, code-like stats |

### Type Scale

| Class | px | Weight | Usage |
|---|---|---|---|
| `text-xs` | 12px | 400 | Fine print, timestamps, icon labels |
| `text-sm` | 14px | 400–500 | Secondary labels, stat descriptions |
| `text-base` | 16px | 400 | Body text (minimum on mobile) |
| `text-lg` | 18px | 500–600 | Card titles, section headers |
| `text-xl` | 20px | 600 | Page subheadings |
| `text-2xl` | 24px | 700 | Page titles |
| `text-3xl` | 30px | 700 | Hero numbers (WPM display) |
| `font-pixel` sizes | Keep at 10–14px | — | Pixel font renders large; size down |

### Rules

- Line height: `leading-relaxed` (1.625) for body, `leading-none` for pixel headings
- Line length: `max-w-[65ch]` on prose content
- Never use `font-pixel` for body copy — illegible at small sizes
- Focused mode word display: `font-mono text-2xl leading-loose` minimum

---

## 4. Spacing Scale

Tailwind 4px base unit. Use Tailwind utilities — never raw `px` values in component code.

| Tailwind | px | Use |
|---|---|---|
| `p-1` / `gap-1` | 4px | Icon gaps, inline tight spacing |
| `p-2` / `gap-2` | 8px | Badge padding, tight element gaps |
| `p-3` / `gap-3` | 12px | Compact buttons, pill badges |
| `p-4` / `gap-4` | 16px | Standard card padding |
| `p-6` / `gap-6` | 24px | Section-level gaps |
| `p-8` / `gap-8` | 32px | Large section separation |
| `p-12` / `gap-12` | 48px | Section margins |
| `p-16` / `gap-16` | 64px | Hero / page-level padding |

---

## 5. Breakpoints & Responsive Strategy

### Breakpoints

| Name | Min-width | Context |
|---|---|---|
| *(base)* | 0 | Mobile phones (375px min design target) |
| `xs` | 480px | Large phones (custom — defined in tailwind.config) |
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets — layout shift (single → two-col) |
| `lg` | 1024px | Desktop — full header nav layout |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1400px | Max container width |

### Strategy by Feature

| Feature | Strategy |
|---|---|
| Habit tracker (Dashboard, History, Settings) | Mobile-first — design at 375px, scale up |
| Games Hub (`/games`) | Mobile-first — cards stack on mobile, grid on desktop |
| Typing Test (`/games/typing`) | Desktop-first — show mobile warning banner, still functional |
| Modals / Dialogs | Center on desktop, full-screen sheet on mobile |

**Testing checkpoints:** 375px · 480px · 768px · 1024px · 1440px

---

## 6. Z-Index Scale

Never use arbitrary z-index values. Always use this named scale.

| Value | Usage |
|---|---|
| `z-10` | Elevated cards, sticky elements within content flow |
| `z-20` | Dropdowns, tooltips, popovers |
| `z-30` | Modals and dialog panels |
| `z-40` | Modal backdrops / overlays |
| `z-50` | Toast notifications — always on top |

---

## 7. Animation & Motion

### Timing Guide

| Type | Duration | Easing | Example |
|---|---|---|---|
| Micro-interaction | 150ms | `ease-out` | Button hover, badge color change |
| Standard transition | 200ms | `ease-out` | Card hover, modal open/close |
| Emphasis | 300ms | `ease-in-out` | Level-up scale, title unlock |
| Continuous loop | 1.5–2s | `ease-in-out` | XP glow pulse, caret blink |

- Only animate `transform` and `opacity` — never `width`, `height`, `top`, `left`
- No decorative animation longer than 500ms
- All looping animations must respect `prefers-reduced-motion`

### Defined Keyframes

| Name | Tailwind Class | Effect | Where |
|---|---|---|---|
| `titlePulse` | `animate-titlePulse` | Scale + gold glow | Title unlock celebration |
| `level-up` | `animate-level-up` | Scale bounce | Level badge on XP gain |
| `point-added` | `animate-point-added` | Float up + fade | Floating XP text |
| `pulse-glow` | `animate-pulse-glow` | Opacity pulse | XP bar glow, stat borders |
| `caret-blink` | `animate-caret-blink` | Opacity blink 0→1→0 | Typing test caret |
| `char-error` | `animate-char-error` | Horizontal shake 3px | Incorrect character typed |

### `prefers-reduced-motion` Rule (in `src/index.css`)

```css
@media (prefers-reduced-motion: reduce) {
  .animate-titlePulse,
  .animate-pulse-glow,
  .animate-level-up,
  .animate-caret-blink,
  .animate-char-error {
    animation: none;
  }
}
```

---

## 8. Glow & Shadow Effects

Glows are RPG chrome — active in app mode, fully suppressed in focused mode.

| Class | Effect | Context |
|---|---|---|
| `.text-glow` | Gold text-shadow (xp-glow token) | XP totals, level numbers, key callouts |
| `.stat-glow-strength` | Red box-shadow | Strength stat card border |
| `.stat-glow-intelligence` | Blue box-shadow | Intelligence stat card border |
| `.stat-glow-endurance` | Green box-shadow | Endurance stat card border |
| `.card-glow` | Ambient gold shadow | Character card, featured elements |

User-defined stats beyond the three named defaults use no glow class — only the user-chosen emoji as visual indicator.

---

## 9. App Mode vs. Focused Mode

Set `data-mode="focused"` on the top-level wrapper of the TypingTest page. CSS selectors handle all styling changes — no conditional class logic in child components.

| Feature | App Mode | Focused Mode |
|---|---|---|
| Background | `bg-background` | `var(--focused-bg)` |
| Font | Inter + Press Start 2P | JetBrains Mono only |
| Glows | Active | None — `[data-mode="focused"] * { box-shadow: none; text-shadow: none; }` |
| Animations | Full RPG set | Caret blink + char-error only |
| Header | Full RPG header with nav | Minimal strip: timer + mode selector + restart icon |
| RPG elements | Visible | Hidden during test phase, restored on results screen |

---

## 10. Component Patterns

### Stat Card

```
┌─────────────────────────────┐
│ [emoji]  Stat Name    [pts] │  ← bg-card border-border rounded-lg
│ habit description text      │  ← text-muted-foreground text-sm
│ [  Complete Quest  ]        │  ← bg-primary text-primary-foreground
└─────────────────────────────┘
```
- Completed state: button `disabled` + card `opacity-50 border-muted`
- Apply `.stat-glow-[type]` to border on applicable stat types
- Always use AlertDialog confirmation before logging

### Game Card (Hub Grid)

```
┌─────────────────────────────┐
│ [LucideIcon w-8 h-8]  [LIVE]│  ← badge: green (live) or muted (coming-soon)
│ Game Name                   │  ← text-lg font-semibold
│ Short one-line description  │  ← text-muted-foreground text-sm
│ [  Play Now →  ]            │  ← only if status = 'live'
└─────────────────────────────┘
```
- Live hover: `hover:border-primary/50 hover:bg-secondary transition-colors duration-200`
- Coming soon: `opacity-60 cursor-default` — no hover lift

### Typing Test (Focused Mode Layout)

```
[Minimal header: 30s | 60s · Restart icon]

         the quick brown fox jumps over
         the lazy dog and then some more
         words appear here for you to type
         
[Results only: WPM · Accuracy · XP Earned · Retry]
```
- Word display: `font-mono text-2xl leading-loose max-w-[700px] mx-auto`
- Character states applied via inline class: `text-focused-correct` / `text-focused-incorrect` / `text-focused-current` / `text-focused-dim`
- Caret: `absolute w-0.5 h-7 bg-[var(--focused-caret)] animate-caret-blink`

### Character Card

```
┌─────────────────────────────┐
│ [Avatar]  Name        Lv. N │  ← level: bg-levelBadge font-pixel text-xs
│ [★★★ Title Pill]            │  ← animate-titlePulse if recently unlocked
│ ████████░░  NNN / MMM XP   │  ← XP bar + text-glow on numbers
└─────────────────────────────┘
```

---

## 11. Game Registry Contract

Every minigame exports a config entry in `src/config/games.ts`. The hub reads this registry — adding a game never requires touching the hub component.

```ts
interface GameConfig {
  id: string                                              // 'typing' | 'math'
  label: string                                           // Display name
  description: string                                     // One-line for game card
  icon: LucideIcon                                        // Lucide icon component
  route: string                                           // '/games/typing'
  status: 'live' | 'coming-soon'
  defaultStatType: string                                 // 'intelligence' | 'strength'
  xpFormula: (score: number, accuracy: number) => number
  sessionCapPerDay: number                                // 3
  xpCapPerSession: number                                 // 10
}
```

---

## 12. Constants Reference (`src/config/constants.ts`)

All magic numbers live here. Never hardcode in components.

```ts
XP_PER_SESSION_CAP    = 10
DAILY_SESSION_CAP     = 3
TYPING_TIMER_OPTIONS  = [30, 60]   // seconds
TYPING_WORD_POOL_SIZE = 50         // words queued at a time
TITLE_TIERS           = 16
MAX_LEADERBOARD_ENTRIES = 20
```

---

## 13. Pre-Delivery Checklist

Before committing any UI work, verify:

- [ ] No raw hex/HSL values in component code — only CSS variables or Tailwind tokens
- [ ] No emojis as icons — Lucide only
- [ ] `cursor-pointer` on all interactive elements
- [ ] Hover states use `transition-colors duration-200` (not `transition-all`)
- [ ] Focus rings visible (`ring-ring` via shadcn defaults or explicit `outline`)
- [ ] Color alone never conveys state — always pair with text or icon
- [ ] `prefers-reduced-motion` handled on all keyframe animations
- [ ] Touch targets minimum 44×44px
- [ ] Responsive tested at: 375px · 768px · 1024px · 1440px
- [ ] No horizontal scroll at any breakpoint
- [ ] Icon-only buttons have `aria-label`
- [ ] Game pages: `data-mode="focused"` set, all glows suppressed during active test
