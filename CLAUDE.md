# Habit Quest — Claude Dev Context

> Reference this file at the start of every session. For design questions, defer to `design-system/habit-quest/MASTER.md` and per-page specs in `design-system/habit-quest/pages/`.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite (SWC plugin) |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix UI primitives) |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 |
| Backend | Supabase (Postgres + Auth + Row Level Security) |
| Forms | React Hook Form + Zod |
| Toasts | Sonner |
| Icons | Lucide React |
| Dates | date-fns |
| GitHub integration | Octokit |

No SSR. Pure SPA served from `dist/` via Vite.

---

## Architecture

```
src/
  App.tsx               # Router setup, QueryClient, AuthProvider, route guards
  main.tsx              # React DOM mount
  pages/               # One file per route
  components/          # Feature components + src/components/ui/ (shadcn primitives)
  hooks/               # Data + behavior hooks
  contexts/
    AuthContext.tsx     # Supabase session + guest mode flag
  integrations/
    supabase/
      client.ts        # Supabase JS client (reads VITE_SUPABASE_* env vars)
      types.ts         # Generated DB types
  lib/
    utils.ts           # cn() Tailwind merge helper
    titles.ts          # TITLE_TIERS array + getTitleForXp() + getStarCountForTitle()
  config/
    constants.ts       # All magic numbers (XP caps, timer options, etc.)
    games.ts           # GameConfig registry — hub reads this; adding a game never touches hub code
  data/
    wordList.ts        # ~200-word pool for the typing test
supabase/
  migrations/          # SQL migrations, applied in order
design-system/
  habit-quest/
    MASTER.md          # Authoritative design system
    pages/             # Per-page design overrides
```

### Route map

| Path | Component | Guard |
|---|---|---|
| `/landing` | `Landing.tsx` | `AuthRoute` (redirects authed users to `/`) |
| `/auth` | `Auth.tsx` | `AuthRoute` (redirects authed users to `/`) |
| `/` | `Dashboard.tsx` | `ProtectedRoute` |
| `/onboarding` | `Onboarding.tsx` | `ProtectedRoute` |
| `/history` | `History.tsx` | `ProtectedRoute` |
| `/settings` | `Settings.tsx` | `ProtectedRoute` |
| `/games` | `GamesHub.tsx` | None — public |
| `/games/typing` | `TypingTest.tsx` | None — public |
| `/games/typing/history` | `TypingHistory.tsx` | `ProtectedRoute` |
| `/games/math` | `MathChallenge.tsx` | None — public |
| `/games/room/new` | `CreateRoom.tsx` | None — public |
| `/games/room/:code` | `RoomLobby.tsx` | None — public |
| `/games/room/:code/play` | `MultiplayerGame.tsx` | None — public |
| `/error` | `Error.tsx` | None |

`ProtectedRoute` redirects to `/landing` when there is no authenticated user and no active guest session. `AuthRoute` redirects authenticated users away from `/auth` and `/landing`.

**Public game routes** — `/games`, `/games/typing`, `/games/math`, and all `/games/room/*` routes require no auth. Unauthenticated visitors can play freely; XP is not saved unless they sign in. Multiplayer guests enter a nickname (stored in `sessionStorage`); their `participant_token` UUID is used for RLS on participant row updates.

---

## Key Hooks

| Hook | Responsibility |
|---|---|
| `useUserData` | Loads profile + stats + habit logs; exposes `completeStat`, `canComplete`, level, XP progress. Branches on `isGuest` — guest data lives in `localStorage` under `habit-quest-guest-data`. |
| `useGameSessions` | Per-game session logic: loads today's session count + stat mapping, exposes `saveSession` and `saveStatMapping`. Accepts optional `customXpFormula` to override the default WPM-based formula. Returns early (no-op saves) when `user` is null. |
| `useLeaderboard` | Fetches top 20 profiles ordered by `total_xp`. |
| `useHabitTracker` | Legacy localStorage-backed tracker (pre-Supabase). Not used in current pages. |
| `use-mobile` | Returns boolean from `window.matchMedia('(max-width: 768px)')`. |
| `useMultiplayerRoom` | Creates/joins/leaves rooms; host promotion; finalizes results and writes XP to `multiplayer_participants` + `game_sessions`. |
| `useRealtimeRoom` | Thin Supabase Realtime wrapper: subscribes to `room:<code>` channel, exposes `broadcast(event)` and `onEvent(handler)`. Handles presence (join/leave). |
| `useMultiplayerMath` | Combines `useMultiplayerRoom` + `useRealtimeRoom` for buzzer-mode math. Host-authoritative question advancement. |
| `useMultiplayerTyping` | Combines `useMultiplayerRoom` + `useRealtimeRoom` for typing race. Throttled progress broadcast (250ms). |

---

## Auth & Guest Mode

- **Authenticated users** — Supabase email/password. `AuthContext` sets `user` and `session` via `onAuthStateChange`. Signing up triggers the `handle_new_user` DB trigger which auto-inserts a `profiles` row.
- **Guest mode** — `continueAsGuest()` writes `habit-quest-guest: 'true'` to `localStorage`. All data is read/written from `habit-quest-guest-data` in localStorage. Signing in clears the guest flag.
- **Anonymous (public) access** — game routes (`/games`, `/games/typing`, `/games/math`) require no auth at all. Visitors can play without clicking "Continue as Guest". XP is not saved; results screen prompts sign-in.
- Guest data is **not migrated** to a real account on sign-up (current limitation).

---

## XP & Titles

- Each stat completion awards **1 XP**.
- Level = `floor(total_xp / 10) + 1`.
- Title is computed by `getTitleForXp(total_xp)` from `src/lib/titles.ts`. 16 tiers from *New Traveler* (0 XP) to *Shadow Monarch* (100,000 XP).
- On every `useUserData` load, if the stored `current_title` in the DB is stale it is synced automatically.
- On `completeStat`, if the new XP crosses a title boundary, `current_title` and `current_title_unlocked_at` are updated in the same profile `UPDATE`.

---

## Database Schema

### Current tables

| Table | Key columns |
|---|---|
| `profiles` | `id` (FK → auth.users), `character_name`, `avatar`, `total_xp`, `current_title`, `current_title_unlocked_at`, `onboarding_completed`, `github_token`, `github_owner`, `github_repo`, `last_github_commit_date` |
| `user_stats` | `id`, `user_id`, `stat_name`, `emoji`, `color`, `habit_description`, `order_index`, `total_points` |
| `habit_log` | `id`, `user_id`, `stat_id`, `completed_date` (UNIQUE per stat+date), `stat_name_snapshot`, `habit_description_snapshot` |
| `feedback_requests` | `id`, `user_id` (nullable), `email`, `category`, `message` |

All tables have Row Level Security enabled. Policies restrict each user to their own rows.

The `game_sessions`, `game_stat_mappings`, `multiplayer_rooms`, and `multiplayer_participants` tables are also live (multiplayer tables pending migration):

| Table | Key columns |
|---|---|
| `game_sessions` | `id, user_id, game_type, score_wpm, accuracy, xp_earned, completed_at` — one row per minigame session. `score_wpm` stores WPM for typing, correct-answer count for math. |
| `game_stat_mappings` | `user_id, game_type, stat_id` — which stat a user has linked to each game. One row per user per game, set once, never changed. UNIQUE on `(user_id, game_type)`. |
| `multiplayer_rooms` | `id, code (4-char unique), game_type, difficulty, host_user_id (nullable), status (waiting/active/finished), question_count, time_limit_seconds, max_players, seed (BIGINT), created_at` |
| `multiplayer_participants` | `id, room_id, user_id (nullable), nickname, is_host, progress_pct, current_score, finished_at, xp_earned, position, participant_token (UUID)` — anonymous identity via `participant_token` in `sessionStorage` |

---

## Migrations

```bash
# After editing the local DB via Supabase Studio or SQL editor:
supabase db diff --file migrations/<timestamp>_<description>.sql

# Push all pending migrations to the target environment:
supabase db push
```

Migration files live in `supabase/migrations/` and are applied in timestamp order. Naming: `YYYYMMDDHHMMSS_short_description.sql`.

---

## Running the App

```bash
# Install dependencies
npm install

# Start local Supabase stack (Postgres + Auth + Studio)
supabase start
# Studio available at http://localhost:54323

# Copy env and fill in values printed by `supabase start`
cp .env.example .env.local
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start output>

# Run Vite dev server
npm run dev
# App at http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production bundle to `dist/` |
| `npm run build:dev` | Dev-mode bundle (useful for debugging) |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | ESLint across the repo |

---

## Conventions

### Commit style

```
[Category][Author] Short imperative description
```

- Category: `Feature`, `Fix`, `Refactor`, `Chore`, `Docs`
- Author: `Merv`
- Examples from history: `[Feature][Merv] Add leaderboard`, `[Feature][Merv] Fix rank progress display and add ranks reference modal`

### Branch naming

`feature/short-kebab-description` — e.g. `feature/add-typing-test`

### Design rules (enforced)

- **No raw hex or HSL values in component code** — reference CSS variables (`var(--token)`) or Tailwind semantic classes.
- **No emoji as icons** — use Lucide React. Emoji appear only in user-chosen avatar data.
- **All magic numbers in `src/config/constants.ts`** — never hardcode XP caps, timer values, etc. in components.
- **Focused mode** — set `data-mode="focused"` on the top-level wrapper of any minigame active-play screen. CSS handles all decoration suppression automatically.
- **Game registry** — every new minigame exports a `GameConfig` entry in `src/config/games.ts`. The hub reads the registry; adding a game must not require editing the hub component.
- See `design-system/habit-quest/MASTER.md` §13 Pre-Delivery Checklist before committing any UI work.

### TypeScript

- Strict mode enabled. No `any` except at Supabase boundary types (use generated types from `src/integrations/supabase/types.ts`).
- Prefer `interface` for component props, `type` for unions and utility types.

### Styling

- Tailwind utility classes in JSX. No CSS Modules, no inline `style=` for tokens.
- `cn()` from `src/lib/utils.ts` for conditional class merging.
- shadcn/ui components live in `src/components/ui/` — treat them as read-only primitives; wrap or compose them rather than editing the source files.

---

## Hooks (Claude Code)

No project-level Claude Code hooks are configured. The `.claude/settings.json` file does not exist in this repo. Hook setup lives at the user-level config (`~/.claude/settings.json`).

---

## Testing

There are no automated tests currently. Correctness is verified by:

1. `npm run lint` — ESLint + TypeScript-ESLint
2. `tsc --noEmit` (via Vite's type-check on build)
3. Manual browser testing at the breakpoints defined in the design system: 375px · 768px · 1024px · 1440px

When writing new features, validate at all four breakpoints before committing.
