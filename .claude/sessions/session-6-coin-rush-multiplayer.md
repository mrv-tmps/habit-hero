# Session 6 — Coin Rush: Multiplayer

**Goal:** Turn the proven solo Coin Rush engine into an 8-player host-authoritative multiplayer game over Supabase Realtime. Players share one deterministic arena; your own movement stays pure-local while rivals' avatars are synced at 10 Hz and interpolated; coin claims are arbitrated by the host (carbon copy of the math buzzer authority model).

**Prerequisite:** Sessions 1 (multiplayer infrastructure) **and** 5 (Coin Rush solo) must be complete. The following must already exist:
- `src/lib/coinRushArena.ts`, `src/hooks/useCoinRushEngine.ts`, `src/components/coinrush/{Arena,Joystick}.tsx`
- `src/hooks/useMultiplayerRoom.ts`, `src/hooks/useRealtimeRoom.ts`, `src/types/multiplayer.ts`
- `multiplayer_rooms` / `multiplayer_participants` tables; CreateRoom + RoomLobby + nickname overlay + results screen
- `useMultiplayerMath.ts` (read it — this session mirrors it closely)

**Read first:** `design-system/habit-quest/pages/coin-rush.md` §5 + `pages/multiplayer.md` + `CLAUDE.md`.

---

## Game rules (decided in design session)

- All players share one seed → identical coins/saws on every client, **zero spawn/hazard traffic**.
- `game_start { seed, start_at }` sets `start_at` ~3s ahead → synced 3-2-1, then a shared deterministic clock.
- Own avatar local; broadcast `position_update { nickname, x, y, stunned }` every `CR_POSITION_BROADCAST_MS` (100ms), throttled via `useRef`. Remote avatars interpolate.
- Coin claim: client broadcasts `coin_claimed`; **host** awards first claim per `coin_id` (dedup), broadcasts `coin_collected`. Lost claims = coin vanishes.
- Hazards never hit the wire — local self-stun only; `stunned` rides on `position_update` (cosmetic).
- Round ends on the synced clock → **host** finalizes rankings, broadcasts `game_end`.
- Score = coins×1 + gems×5 (`score_wpm`). XP = `floor(score/10)` × position multiplier, caps, auth-only. **Tie-break: more gems → higher rank**, then arbitrary.

---

## What to build

### 1. `src/types/multiplayer.ts` — extend events + GameType
Add `'coin-rush'` to `GameType` (if Session 5 didn't). Add to `MultiplayerEvent`:
```ts
| { type: 'position_update'; nickname: string; x: number; y: number; stunned: boolean }
| { type: 'coin_claimed';    coin_id: number; nickname: string }
| { type: 'coin_collected';  coin_id: number; nickname: string }
```

### 2. `src/hooks/useMultiplayerCoinRush.ts` — room + realtime combiner
Model directly on `useMultiplayerMath.ts` (same ref discipline: `isHostRef`, `ownParticipantRef`, `playerScoresRef`, `processedClaimRef`-style dedup, `hasEndedRef`, stable `endGameRef`).

```ts
interface UseMultiplayerCoinRushReturn {
  phase: 'countdown' | 'active' | 'done';
  score: number;                          // own
  playerScores: Record<string, number>;   // nickname → score
  playerGems: Record<string, number>;     // nickname → gems (tie-break)
  remotePlayers: Record<string, { x:number; y:number; stunned:boolean; targetX:number; targetY:number }>;
  timeRemaining: number;
  rankings: RankedResult[];
  ownNickname: string;
  participants: MultiplayerParticipant[];
  // engine glue:
  claimCoin: (coinId: number, kind: 'coin'|'gem') => boolean;  // → onCoinClaim
  broadcastPosition: (x: number, y: number, stunned: boolean) => void; // throttled internally
}
```

**Authority flow (mirror math buzzer):**
1. `game_start` → `setPhase('countdown')`; engine runs the shared seed/clock; flip to `'active'` at `start_at`.
2. Local coin overlap → `claimCoin(id)`:
   - **Host:** if `coin_id` already processed return false; else mark processed, increment own score/gems, broadcast `coin_collected`, return **true** (engine removes coin + replenishes via deterministic `nextCoin`).
   - **Non-host:** broadcast `coin_claimed`, return **false** for now; the authoritative removal happens when `coin_collected` arrives (engine reconciles).
3. **Host** on `coin_claimed`: dedup per `coin_id`; first wins → increment that player's score/gems, broadcast `coin_collected`.
4. **All** on `coin_collected`: remove coin from the engine, replenish deterministically, update scoreboard. (Engine exposes a `forceCollect(coinId, nickname)` method so the hook can drive removal regardless of who claimed.)
5. `position_update` (throttled 100ms) out; inbound updates set `remotePlayers[nickname].target*` for the renderer to interpolate.
6. Timer hits limit → **host** `buildRankings()` (sort by score, tie-break by gems), broadcast `game_end`, `finalizeResults`. Clients → `phase='done'`.
7. XP save: reuse `useMultiplayerMath`'s `saveGameSession` verbatim (game_type `'coin-rush'`, daily-cap check).

> **Engine change needed:** `useCoinRushEngine` must accept an authoritative `forceCollect`/reconcile path so removal is driven by `coin_collected`, not purely local overlap. Keep solo behavior intact (solo passes `onCoinClaim => true` and self-drives removal).

### 3. `src/pages/MultiplayerCoinRush.tsx` — MP page
- Root `data-mode="arcade"`, `min-h-screen flex flex-col` (spec §5).
- Top bar (z-10): room code · Timer + seconds (pulse ≤10s) · own score.
- `<Arena>` with remote avatars rendered + interpolated each frame toward `remotePlayers[*].target`. Own avatar from the local engine.
- Scoreboard strip (z-10, `aria-live="polite"`) — reuse the math scoreboard pattern; leader `ring-1 ring-primary`.
- Joystick (z-20, coarse pointers) + keyboard.
- 3-2-1 countdown overlay (z-30) keyed off `start_at`.
- Mobile warning banner (z-20) reused from multiplayer (note: Coin Rush is more mobile-friendly, but keep the pattern for consistency).
- `phase==='done'` → shared `<MultiplayerResults>` (`multiplayer.md §6`), auto-redirect after `MP_RESULT_DISPLAY_MS`.

### 4. Wire `src/pages/MultiplayerGame.tsx`
Add the branch: `room.game_type === 'coin-rush'` → `<MultiplayerCoinRush room={room} />`.

### 5. CreateRoom config
Add a `coin-rush` path: difficulty (Easy/Med/Hard) + round length (`CR_ROUND_OPTIONS`). No question-count control. Reuse the existing form per `multiplayer.md §2`.

### 6. DB / migration
- Extend the `game_type` check constraint on `multiplayer_rooms` and `game_sessions` to include `'coin-rush'`.
- **No new columns** — coins/saws are fully deterministic from `seed`.
- New migration `supabase/migrations/<ts>_coin_rush_game_type.sql`.

---

## Realtime budget (sanity)
8 players × 10 Hz position = ~80 msgs/s in one channel + sparse coin events. Within Supabase Realtime limits for a single room. Own avatar never blocks on the network. Worst case on packet loss: a rival's blob stutters — never your movement, never the score.

## Design reference
`pages/coin-rush.md` §5 (netcode/events/flow), §7 (z-index), §8 (registry).
`pages/multiplayer.md` §2/§3/§6/§7 (CreateRoom, lobby, results, nickname overlay) — reused unchanged.
`useMultiplayerMath.ts` — the authority/ref pattern to copy.

## Definition of done
- [ ] Two+ players in a room see the same coins/saws in the same places (determinism)
- [ ] Each player's own movement is perfectly responsive; rivals glide smoothly (interpolated 10 Hz)
- [ ] Contested coin awards to exactly ONE player; both clients agree on the scoreboard
- [ ] Saw stun is local and cosmetic to others (shake), costs no points, needs no host
- [ ] Synced 3-2-1; round ends together; host-built rankings tie-broken by gems
- [ ] Auth players get XP (position multipliers, caps) saved to `game_sessions`; guests show score only
- [ ] Results screen + auto-redirect reused from multiplayer spec
- [ ] Migration adds `coin-rush` to both `game_type` enums; no new columns
- [ ] No `setState` per frame; no raw hex/numbers in JSX; no emoji icons; no TS errors
- [ ] Tested at 375px · 768px · 1024px · 1440px with 2 real clients
