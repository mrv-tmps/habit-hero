# Session 1 — Multiplayer Infrastructure

**Goal:** Build the shared foundation all multiplayer games depend on. Nothing game-specific. By the end of this session: players can create a room, share a code, and see each other in a lobby in real time.

**Prerequisite:** Sessions 2, 3, 4 cannot start until this is complete.

---

## What to build

### 1. DB Migration

Create `supabase/migrations/20260626000000_add_multiplayer_tables.sql` with:

```sql
-- multiplayer_rooms
CREATE TABLE multiplayer_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL CHECK (game_type IN ('math-buzzer', 'typing-race')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  question_count INT,
  time_limit_seconds INT,
  max_players INT NOT NULL DEFAULT 8,
  seed BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- multiplayer_participants
CREATE TABLE multiplayer_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES multiplayer_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  progress_pct FLOAT DEFAULT 0,
  current_score INT DEFAULT 0,
  finished_at TIMESTAMPTZ,
  xp_earned INT DEFAULT 0,
  position INT,
  participant_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Postgres trigger: promote next participant to host when host row is deleted
CREATE OR REPLACE FUNCTION promote_next_host()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_host THEN
    UPDATE multiplayer_participants
    SET is_host = true
    WHERE room_id = OLD.room_id
      AND id != OLD.id
      AND finished_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_participant_delete
AFTER DELETE ON multiplayer_participants
FOR EACH ROW EXECUTE FUNCTION promote_next_host();

-- RLS
ALTER TABLE multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE multiplayer_participants ENABLE ROW LEVEL SECURITY;

-- Rooms: anyone can read (for join-by-code lookup); authenticated users can insert
CREATE POLICY "rooms_select" ON multiplayer_rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON multiplayer_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR true);
CREATE POLICY "rooms_update_host" ON multiplayer_rooms FOR UPDATE USING (host_user_id = auth.uid() OR host_user_id IS NULL);

-- Participants: anyone can insert (guests use participant_token); anyone can read; update via RPC only
CREATE POLICY "participants_select" ON multiplayer_participants FOR SELECT USING (true);
CREATE POLICY "participants_insert" ON multiplayer_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participants_delete_own" ON multiplayer_participants FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- RPC for anonymous participant progress updates (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION update_participant_progress(
  p_token UUID,
  p_progress_pct FLOAT,
  p_current_score INT
) RETURNS VOID AS $$
  UPDATE multiplayer_participants
  SET progress_pct = p_progress_pct, current_score = p_current_score
  WHERE participant_token = p_token;
$$ LANGUAGE sql SECURITY DEFINER;
```

### 2. New constants in `src/config/constants.ts`

Add:
```ts
export const MP_ROOM_CODE_LENGTH = 4;
export const MP_MAX_PLAYERS = 8;
export const MP_XP_MULTIPLIER_1ST = 1.5;
export const MP_XP_MULTIPLIER_2ND = 1.25;
export const MP_XP_MULTIPLIER_DEFAULT = 1.0;
export const MP_PROGRESS_BROADCAST_MS = 250;
export const MP_QUESTION_COUNT_OPTIONS = [10, 20, 30] as const;
export const MP_TIME_LIMIT_OPTIONS = [30, 60, 90] as const;
export const MP_MATH_DIFFICULTY = ['easy', 'medium', 'hard'] as const;
export const MP_TYPING_MODE = ['english', 'code'] as const;
export const MP_RESULT_DISPLAY_MS = 8000;
```

### 3. New types file `src/types/multiplayer.ts`

```ts
export type RoomStatus = 'waiting' | 'active' | 'finished';
export type GameType = 'math-buzzer' | 'typing-race';
export type MathDifficulty = 'easy' | 'medium' | 'hard';
export type TypingMode = 'english' | 'code';
export type CodeLanguage = 'javascript' | 'python' | 'c';

export interface MultiplayerRoom {
  id: string;
  code: string;
  game_type: GameType;
  difficulty: MathDifficulty | null;
  host_user_id: string | null;
  status: RoomStatus;
  question_count: number | null;
  time_limit_seconds: number | null;
  max_players: number;
  seed: number;
  created_at: string;
}

export interface MultiplayerParticipant {
  id: string;
  room_id: string;
  user_id: string | null;
  nickname: string;
  is_host: boolean;
  progress_pct: number;
  current_score: number;
  finished_at: string | null;
  xp_earned: number;
  position: number | null;
  participant_token: string;
  created_at: string;
}

export interface RankedResult {
  nickname: string;
  user_id: string | null;
  score: number;
  wpm?: number;
  position: number;
  xp_earned: number;
}

// Realtime broadcast event union
export type MultiplayerEvent =
  | { type: 'game_start'; seed: number; start_at: string }
  | { type: 'answer_claimed'; question_idx: number; by_nickname: string }
  | { type: 'progress_update'; nickname: string; progress_pct: number; current_score: number; wpm?: number }
  | { type: 'player_finished'; nickname: string; final_score: number; wpm?: number }
  | { type: 'game_end'; rankings: RankedResult[] }
  | { type: 'question_advance'; question_idx: number };
```

### 4. `src/hooks/useMultiplayerRoom.ts`

Hook responsibilities:
- `createRoom(config)` → inserts room row with random 4-char code + seed, inserts creator as host participant, returns `{ room, participantToken }`
- `joinRoom(code, nickname)` → looks up room by code, validates `status === 'waiting'`, inserts participant, returns `{ room, participantToken }`
- `leaveRoom(roomId, participantId)` → deletes own participant row (trigger handles host promotion)
- `startGame(roomId, seed)` → host only: updates `status = 'active'`
- `finalizeResults(roomId, rankings)` → host only: writes `position` + `xp_earned` to each participant row, updates `status = 'finished'`
- Store `participantToken` in `sessionStorage` under key `mp-token-<roomCode>`

Room code generation: random 4 uppercase letters (A-Z). Retry on unique constraint violation (extremely rare).

### 5. `src/hooks/useRealtimeRoom.ts`

Thin Supabase Realtime wrapper:
- Subscribes to `supabase.channel('room:' + code)` on mount, unsubscribes on unmount
- Exposes `broadcast(event: MultiplayerEvent)` 
- Exposes `onEvent(handler)` — stores handlers in a `Set` via `useRef`, fires on each broadcast
- Tracks presence: `{ nickname, user_id, is_host, player_slot }` — exposes `presenceList`
- Player slot (1–8) assigned by join order from presence list

### 6. Extend `src/config/games.ts`

Add optional fields to `GameConfig` interface:
```ts
multiplayerRoute?: string;
multiplayerGameType?: GameType;
```

Add to math entry: `multiplayerRoute: '/games/math/multiplayer', multiplayerGameType: 'math-buzzer'`
Add to typing entry: `multiplayerRoute: '/games/typing/multiplayer', multiplayerGameType: 'typing-race'`

### 7. Edit `src/pages/GamesHub.tsx`

In the game card, when `game.multiplayerRoute` exists and `game.status === 'live'`, render a second `Button variant="outline" size="sm"` with `Users` Lucide icon and label "Multiplayer". On click, navigate to `/games/room/new?game=<game.id>`.

### 8. New page `src/pages/CreateRoom.tsx`

Route: `/games/room/new` — reads `?game=` query param. Shows config form per design spec in `design-system/habit-quest/pages/multiplayer.md §2`. On submit: calls `useMultiplayerRoom.createRoom`, then navigates to `/games/room/<code>`.

### 9. New page `src/pages/RoomLobby.tsx`

Route: `/games/room/:code` — per design spec `multiplayer.md §3`.

- On mount: checks `sessionStorage` for existing participant token for this room. If found, re-fetches participant row. If not, shows nickname entry overlay (`multiplayer.md §7`).
- Subscribes to `useRealtimeRoom` for live presence list.
- Host sees "Start Game" button — on click: generates seed (`Math.floor(Math.random() * 2**31)`), calls `useMultiplayerRoom.startGame`, broadcasts `{ type: 'game_start', seed, start_at: new Date().toISOString() }`.
- All clients: on `game_start` event received, navigate to `/games/room/<code>/play`.

### 10. Add routes to `src/App.tsx`

```tsx
<Route path="/games/room/new" element={<CreateRoom />} />
<Route path="/games/room/:code" element={<RoomLobby />} />
<Route path="/games/room/:code/play" element={<MultiplayerGame />} />
```

`MultiplayerGame` is a thin router component: reads `room.game_type` from DB and renders `<MultiplayerMath />` or `<MultiplayerTyping />`. Stub both with a placeholder `<div>Coming in Session 2/3</div>` for now.

### 11. CSS additions to `src/index.css`

- Add `--player-1` through `--player-8` CSS variables to `:root` (see `multiplayer.md §1`)
- Add `data-mode="multiplayer"` CSS block (see `multiplayer.md §1`)
- Add `fade-in` keyframe + `prefers-reduced-motion` entry (see `multiplayer.md §1`)

---

## Design reference

`design-system/habit-quest/pages/multiplayer.md` — sections 1, 2, 3, 7, 8
`design-system/habit-quest/MASTER.md` — all sections apply

---

## Definition of done

- [ ] Migration file created and can be applied with `supabase db push`
- [ ] Player can open `/games/room/new`, pick settings, and land on `/games/room/<code>`
- [ ] A second browser tab can enter the same code and appear in the lobby player list in real time
- [ ] Host sees "Start Game" (disabled until 2+ players); non-host sees waiting message
- [ ] Clicking "Start Game" navigates all connected tabs to `/games/room/<code>/play` (stub page is fine)
- [ ] Leaving the room removes the player from the list; if host leaves, next player is promoted
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] No raw hex/HSL values in JSX
