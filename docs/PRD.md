# Habit Quest — Product Requirements Document

**Last updated:** 2026-07-07 (solo code typing mode)
**Status:** Active development — pre-public launch

---

## Problem Statement

Most habit-tracking apps fail one of two ways: they are either plain productivity tools that feel like chores (streaks and checkboxes with no emotional payoff), or they are over-engineered RPGs that front-load complexity and lose users in menus. Neither approach makes the *act of building a habit* feel rewarding.

Habit Quest targets the gap: a minimalist daily tracker with genuine RPG progression, where each real-world habit completion visibly advances a character — and where optional skill-based minigames give players a reason to open the app even on days when habits are already done.

---

## Target Audience

**Primary:** Goal-driven individuals aged 18–35 who respond to game mechanics (RPGs, idle games, typing speed tools) and want a structured but low-friction way to build daily habits.

**Secondary:** Any user who has tried and abandoned other habit apps — the lightweight onboarding and guest mode lower the bar for getting started.

**Current state:** Single user (developer) building toward a public launch. Feature decisions should favor the public-launch audience, not just solo use.

---

## Differentiator

> Minimalist gamified habit tracker + interactive skill-based minigames — real games, not button clicks.

Key differentiating choices:

- **RPG chrome, focused content.** Decorative pixel fonts, glows, and title progression appear in navigation and results screens. During active gameplay (typing test), all chrome is stripped — inspired by MonkeyType's focused mode.
- **16-tier title system.** Titles from *New Traveler* to *Shadow Monarch* are meaningful milestones that players earn over months, not days.
- **Skill-based XP.** Minigame XP is earned by performance (WPM × accuracy), not by showing up. This differentiates Habit Quest from Habitica-style "click to earn."
- **Guest mode.** Try the full experience with no account. Progress is stored locally and lost on clear, which creates natural upgrade pressure without a paywall.

---

## Features

### Current (shipped)

| Feature | Description |
|---|---|
| **Quest dashboard** | Stat cards for each user-defined habit. Each can be completed once per day (cooldown enforced by UNIQUE constraint on `stat_id + completed_date`). Confirmation dialog before logging to prevent misclicks. |
| **XP & leveling** | Each completion awards 1 XP. Level = `floor(total_xp / 10) + 1`. Visual level-up animation and toast on level change. |
| **Title progression** | 16 titles computed from total XP. Title updates automatically on each completion if the XP threshold is crossed. Unlock animation plays on new title. |
| **Character card** | Avatar (emoji), character name, level badge, title pill with star rating, XP progress bar with gold glow. |
| **Guided onboarding** | Multi-step flow: choose avatar → name character → pick starter quests. Progress stored in Supabase; redirects back if incomplete. |
| **Guest mode** | Full experience without an account. All data stored in `localStorage`. No migration to a real account on sign-up (limitation). |
| **History page** | Calendar-based view of past habit completions by stat. |
| **Settings page** | Profile editing, GitHub integration config, feedback form (inserts into `feedback_requests`; accepts unauthenticated submissions). |
| **Leaderboard** | Top 20 players ranked by total XP. Accessible via modal from the dashboard header. |
| **GitHub integration** | Optional: connect a GitHub repo; last commit date is tracked on the profile for use as an implicit "coding" habit signal. |
| **Responsive UI** | Mobile-first on habit-tracking pages (375px design target). Tailwind + shadcn/ui components. |
| **Typing Test minigame** | 30s / 60s time mode. ~200-word pool. XP formula: `floor((WPM / 10) * accuracy)` capped at 10 XP. 3 XP-earning sessions per day; unlimited free play after. Focused mode UI (desktop-first, mobile fallback warning). User picks which stat earns XP once per game type. |
| **Math Challenge minigame** | 30s / 60s time mode. Arithmetic problems (addition, subtraction, multiplication, division). XP formula: `floor((correct / 2) * accuracy)` capped at 10 XP. Same session/stat-mapping rules as Typing Test. |
| **Games Hub (`/games`)** | Top-level public route. Grid of game cards driven by the `GameConfig` registry. Shows LIVE / COMING SOON badge per game. |
| **Game stat mapping** | User selects which stat earns XP for each game type on first play. Stored permanently in `game_stat_mappings`; never prompted again. |
| **Session persistence** | All minigame sessions stored in `game_sessions` (score, accuracy, XP, timestamp). Typing Test has a personal history page at `/games/typing/history`. |
| **Public game access** | `/games`, `/games/typing`, and `/games/math` require no authentication. Anonymous visitors play freely; XP is not saved. Results screen prompts sign-in. |
| **Landing page games section** | THE ARENA section on `/landing` shows live game cards linking directly to the games. "Games" nav link added. "No account needed" note visible. |
| **Multiplayer rooms** | 4-char room codes, up to 8 players, no auth required (guests pick a nickname; identity via `participant_token` in `sessionStorage`). Create/join lobby with live presence, host controls, Supabase Realtime broadcast channel per room. |
| **Multiplayer Math Buzzer** | All players see the same seeded question; first correct answer claims the point (host-arbitrated). Buzzer overlay + 3-2-1 countdown between questions. In-app numeric keypad on mobile. Rankings with position XP multipliers (×1.5 / ×1.25). |
| **Multiplayer Typing Race** | TypeRacer-style: all players type the same seeded word set (or code snippet — JS/Python/C) with live per-player progress bars and WPM. Strict advance (a word must be correct to progress). XP = `floor(WPM / 10)` × position multiplier, capped at 10. |
| **Code typing mode (solo)** | Solo Typing Test has a words / code toggle with JS/Python/C language pills. 6 curated snippets per language (`codeSnippets.ts`, shared with multiplayer). Enter types the newline, Backspace corrects mistakes, test finishes early once the snippet is fully typed. |

### In progress / next

| Feature | Description |
|---|---|
| **Math Challenge history page** | Personal session history at `/games/math/history`, mirroring the typing history page. |
| **Personal bests** | Per-game best score/WPM/accuracy displayed on the game page or hub card. |
| **Coin Rush minigame** | 2D arena coin-collection game, solo + multiplayer (Sessions 5–7). Design spec in `design-system/habit-quest/pages/coin-rush.md`. |

### Planned (post-minigames)

- Streak badges and optional reminder notifications
- Social leaderboards for friends or team groups
- Advanced analytics on habit history (heatmaps, consistency scores)
- Personal best tracking and records screen per minigame

---

## XP System Rules

These values are the source of truth. Match them everywhere — DB, game logic, and display.

| Parameter | Value |
|---|---|
| XP per habit completion | 1 |
| XP per minigame session cap | 10 |
| Minigame daily session cap (XP-earning) | 3 |
| Typing Test XP formula | `floor((WPM / 10) * accuracy)` — accuracy 0–1 |
| Math Challenge XP formula | `floor((correct / 2) * accuracy)` — accuracy 0–1; ~20 correct at 100% = 10 XP cap |
| Multiplayer position multipliers | 1st ×1.5, 2nd ×1.25, others ×1.0 — applied to base XP, still capped at 10 |
| Level formula | `floor(total_xp / 10) + 1` |
| Title tiers | 16 (New Traveler → Shadow Monarch) |

---

## Title Tiers

| XP threshold | Title |
|---|---|
| 0 | New Traveler |
| 50 | Rising Flame |
| 150 | Iron Will |
| 300 | Dawn Breaker |
| 600 | Storm Chaser |
| 1,000 | Unbroken |
| 2,000 | Titan Awakened |
| 3,500 | Void Walker |
| 5,000 | Eternal Flame |
| 8,000 | Mythic |
| 12,000 | Ascended |
| 20,000 | Legend Forged |
| 35,000 | Immortal |
| 50,000 | Origin |
| 75,000 | Apex |
| 100,000 | Shadow Monarch |

---

## Success Metrics

### Engagement

- Daily habit completions per active user
- XP earned per user per week (indicates consistent habit logging)
- Minigame sessions per day per user (post-launch)
- Percentage of users who return after first session (Day 1 retention)
- Day 7 and Day 30 retention rates

### Progression

- Average title tier reached after 30 days
- Percentage of users who reach *Iron Will* (150 XP — roughly 5 weeks of one daily habit)

### Acquisition

- Percentage of guest sessions that convert to registered accounts
- Time-to-first-habit-completion from landing

---

## Out of Scope (v1)

- **Light mode.** The app is permanently dark. No theming toggle.
- **Native mobile app.** Web-only. The habit tracker is responsive; minigames show a mobile warning but remain accessible.
- **Push / email notifications.** Reminders are on the roadmap but not in v1.
- **Social / friend features.** The leaderboard is global top-20 only. Friend groups and team leaderboards are post-launch.
- **Guest-to-account data migration.** Guest progress is local only. Sign-up starts a fresh account.
- **Offline support / PWA.** Not planned.
- **Monetization.** No paywall, subscriptions, or premium tiers in scope. Habit Quest is free.
- **Admin / moderation tooling.** No in-app admin UI. Manage data via Supabase Studio.
