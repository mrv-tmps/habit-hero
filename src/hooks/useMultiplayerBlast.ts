import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerRoom, getStoredToken } from '@/hooks/useMultiplayerRoom';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { useBlastEngine, type BlastUnitInit } from '@/hooks/useBlastEngine';
import { resolveBlastMap } from '@/config/blastMaps';
import { getTitleForXp } from '@/lib/titles';
import type { ShotInput } from '@/lib/blastSim';
import type { BlastWeaponId } from '@/config/constants';
import type { MultiplayerRoom, MultiplayerParticipant, RankedResult } from '@/types/multiplayer';
import {
  XP_PER_SESSION_CAP,
  DAILY_SESSION_CAP,
  MP_XP_MULTIPLIER_1ST,
  MP_XP_MULTIPLIER_2ND,
  MP_XP_MULTIPLIER_DEFAULT,
  BA_COUNTDOWN_MS,
  BA_SKIP_GRACE_MS,
  MP_READY_RESYNC_MS,
  MP_READY_RESYNC_MAX,
  baTurnTimeMs,
  baMaxRounds,
} from '@/config/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export interface UseMultiplayerBlastReturn {
  mpPhase: 'ready' | 'active' | 'done';
  engine: ReturnType<typeof useBlastEngine>;
  rankings: RankedResult[];
  ownNickname: string;
  participants: MultiplayerParticipant[];
  readyNicknames: string[];
  markReady: () => void;
}

export function useMultiplayerBlast(room: MultiplayerRoom): UseMultiplayerBlastReturn {
  const { user } = useAuth();
  const { fetchParticipantByToken, fetchParticipants, finalizeResults } = useMultiplayerRoom();
  const { broadcast, onEvent } = useRealtimeRoom(room.code);

  const [ownParticipant, setOwnParticipant] = useState<MultiplayerParticipant | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [mpPhase, setMpPhase] = useState<'ready' | 'active' | 'done'>('ready');
  const [rankings, setRankings] = useState<RankedResult[]>([]);
  const [readyNicknames, setReadyNicknames] = useState<string[]>([]);
  const [startAt, setStartAt] = useState(0);
  // State, not just a ref: the engine's skip authority depends on it at render time
  const [isHost, setIsHost] = useState(false);

  const isHostRef = useRef(false);
  const ownParticipantRef = useRef<MultiplayerParticipant | null>(null);
  const participantsRef = useRef<MultiplayerParticipant[]>([]);
  const readyNicknamesRef = useRef<Set<string>>(new Set());
  const hasEndedRef = useRef(false);

  // Turn order = participant created_at order (fetchParticipants sorts ascending);
  // nickname doubles as the unit id — unique per room, shared by every client.
  const unitInits: BlastUnitInit[] = useMemo(
    () =>
      participants.map((p, i) => ({
        id: p.nickname,
        nickname: p.nickname,
        colorIndex: (i % 8) + 1,
        isLocal: p.nickname === ownParticipant?.nickname,
      })),
    [participants, ownParticipant],
  );

  // NULL map_id = random; the seed-derived pick is identical on every client
  const map = useMemo(() => resolveBlastMap(room.map_id, room.seed), [room.map_id, room.seed]);

  const engine = useBlastEngine({
    seed: room.seed,
    startAt,
    map,
    unitInits,
    autoSkipTurns: isHost,
    skipGraceMs: BA_SKIP_GRACE_MS,
    waitForMoveDone: true,
    // Derived from roster size — same on every client, so no extra sync needed
    turnTimeMs: baTurnTimeMs(participants.length),
    maxRounds: baMaxRounds(participants.length),
    onShotCommitted: (input: ShotInput, turnIndex: number) => {
      broadcast({ type: 'shot_fired', turn_index: turnIndex, ...input });
    },
    onTurnResolved: resolution => {
      if (isHostRef.current) broadcast({ type: 'turn_resolved', resolution });
    },
    onMoveDone: (turnIndex, x, y, hp) => {
      // The host folds its own reposition outcome in locally; only others report
      if (!isHostRef.current) broadcast({ type: 'move_done', turn_index: turnIndex, x, y, hp });
    },
    onCratePicked: (crateId, turnIndex, byId) => {
      broadcast({ type: 'crate_picked', crate_id: crateId, turn_index: turnIndex, by_id: byId });
    },
  });

  const engineRef = useRef(engine);
  engineRef.current = engine;

  const hasBegunRef = useRef(false);

  // Host: begin when everyone is ready
  const triggerStartIfAllReady = useCallback(() => {
    if (!isHostRef.current) return;
    const total = participantsRef.current.length;
    if (total === 0) return;
    if (readyNicknamesRef.current.size < total) return;
    // Re-broadcasting game_begin is safe and recovers stragglers who missed the
    // first one; only start our own countdown once.
    broadcast({ type: 'game_begin' });
    if (hasBegunRef.current) return;
    hasBegunRef.current = true;
    setStartAt(Date.now() + BA_COUNTDOWN_MS);
    setMpPhase('active');
  }, [broadcast]);

  const triggerStartIfAllReadyRef = useRef(triggerStartIfAllReady);
  useEffect(() => { triggerStartIfAllReadyRef.current = triggerStartIfAllReady; }, [triggerStartIfAllReady]);

  useEffect(() => {
    const token = getStoredToken(room.code);
    if (!token) return;

    fetchParticipantByToken(token).then(p => {
      setOwnParticipant(p);
      ownParticipantRef.current = p;
      isHostRef.current = p?.is_host ?? false;
      setIsHost(p?.is_host ?? false);
    });

    fetchParticipants(room.id).then(parts => {
      setParticipants(parts);
      participantsRef.current = parts;
      triggerStartIfAllReadyRef.current();
    });
  }, [room.code, room.id, fetchParticipantByToken, fetchParticipants]);

  const markReady = useCallback(() => {
    const nickname = ownParticipantRef.current?.nickname;
    if (!nickname || readyNicknamesRef.current.has(nickname)) return;
    readyNicknamesRef.current.add(nickname);
    setReadyNicknames([...readyNicknamesRef.current]);
    broadcast({ type: 'player_ready', nickname });
    triggerStartIfAllReadyRef.current();
  }, [broadcast]);

  // game_begin is a one-shot broadcast; if it is dropped, a readied player is
  // stranded on the ready screen. Keep re-announcing until the battle starts —
  // the host re-emits game_begin on each player_ready it receives.
  useEffect(() => {
    if (mpPhase !== 'ready') return;
    const nickname = ownParticipant?.nickname;
    if (!nickname || !readyNicknames.includes(nickname)) return;
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      broadcast({ type: 'player_ready', nickname });
      if (attempts >= MP_READY_RESYNC_MAX) clearInterval(id);
    }, MP_READY_RESYNC_MS);
    return () => clearInterval(id);
  }, [mpPhase, ownParticipant, readyNicknames, broadcast]);

  const buildRankings = useCallback((): RankedResult[] => {
    const units = engineRef.current.unitsView;
    const damage = engineRef.current.damageDealt;
    // Winner (alive) first, then the fallen ranked by damage dealt
    const sorted = [...units].sort((a, b) => {
      if ((a.hp > 0) !== (b.hp > 0)) return a.hp > 0 ? -1 : 1;
      return (damage[b.id] ?? 0) - (damage[a.id] ?? 0);
    });

    return sorted.map((unit, idx) => {
      const position = idx + 1;
      const score = damage[unit.id] ?? 0;
      const baseXp = Math.min(Math.floor(score / 10), XP_PER_SESSION_CAP);
      const multiplier =
        position === 1 ? MP_XP_MULTIPLIER_1ST :
        position === 2 ? MP_XP_MULTIPLIER_2ND :
        MP_XP_MULTIPLIER_DEFAULT;
      const xpEarned = Math.min(Math.floor(baseXp * multiplier), XP_PER_SESSION_CAP);
      const participant = participantsRef.current.find(p => p.nickname === unit.nickname);
      return { nickname: unit.nickname, user_id: participant?.user_id ?? null, score, position, xp_earned: xpEarned };
    });
  }, []);

  const saveGameSession = useCallback(async (myRanking: RankedResult) => {
    if (!user) return;

    const { count } = await db
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('game_type', 'blast-arena')
      .gte('completed_at', getTodayStart());

    const xpToSave = (count ?? 0) >= DAILY_SESSION_CAP ? 0 : myRanking.xp_earned;

    await db.from('game_sessions').insert({
      user_id: user.id,
      game_type: 'blast-arena',
      score_wpm: myRanking.score,
      accuracy: myRanking.position === 1 ? 100 : 0,
      xp_earned: xpToSave,
      completed_at: new Date().toISOString(),
    });

    if (xpToSave === 0) return;

    const { data: profileRow } = await db
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single();

    const oldXp = profileRow?.total_xp ?? 0;
    const newXp = oldXp + xpToSave;
    const oldTitle = getTitleForXp(oldXp).name;
    const newTitleTier = getTitleForXp(newXp);
    const titleChanged = newTitleTier.name !== oldTitle;

    const profileUpdate: Record<string, unknown> = { total_xp: newXp };
    if (titleChanged) {
      profileUpdate.current_title = newTitleTier.name;
      profileUpdate.current_title_unlocked_at = new Date().toISOString();
    }

    await db.from('profiles').update(profileUpdate).eq('id', user.id);
  }, [user]);

  // Host ends the game when the engine reaches done
  useEffect(() => {
    if (engine.phase !== 'done' || !isHostRef.current || hasEndedRef.current) return;
    hasEndedRef.current = true;

    const finalRankings = buildRankings();
    broadcast({ type: 'game_end', rankings: finalRankings });
    setRankings(finalRankings);
    setMpPhase('done');

    finalizeResults(room.id, finalRankings).then(() => {
      const myNickname = ownParticipantRef.current?.nickname;
      const myRanking = finalRankings.find(r => r.nickname === myNickname);
      if (user && myRanking) void saveGameSession(myRanking);
    });
  }, [engine.phase, broadcast, buildRankings, finalizeResults, room.id, saveGameSession, user]);

  useEffect(() => {
    return onEvent(async event => {
      if (event.type === 'player_ready') {
        if (!readyNicknamesRef.current.has(event.nickname)) {
          readyNicknamesRef.current.add(event.nickname);
          setReadyNicknames([...readyNicknamesRef.current]);
        }
        triggerStartIfAllReadyRef.current();
      }

      if (event.type === 'game_begin') {
        // Guard so a repeated game_begin (re-sent to recover stragglers) cannot
        // restart a client that already began.
        if (!isHostRef.current && !hasBegunRef.current) {
          hasBegunRef.current = true;
          setStartAt(Date.now() + BA_COUNTDOWN_MS);
          setMpPhase('active');
        }
      }

      if (event.type === 'shot_fired') {
        // Every client replays the identical deterministic sim; the engine rejects
        // shots that don't match its current turn (late arrivals, duplicates)
        engineRef.current.applyRemoteShot(
          {
            weapon: event.weapon as BlastWeaponId,
            x: event.x,
            y: event.y,
            vx: event.vx,
            vy: event.vy,
          },
          event.turn_index,
        );
      }

      if (event.type === 'turn_resolved') {
        // Authoritative turn boundary from the host — drift self-heals here
        if (!isHostRef.current) engineRef.current.applyTurnResolution(event.resolution);
      }

      if (event.type === 'move_done') {
        // Only the host consumes reposition reports; it folds them into turn_resolved
        if (isHostRef.current) {
          engineRef.current.applyMoveDone(event.turn_index, event.x, event.y, event.hp);
        }
      }

      if (event.type === 'crate_picked') {
        engineRef.current.applyCratePicked(event.crate_id, event.by_id);
      }

      if (event.type === 'game_end') {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;
        setRankings(event.rankings);
        setMpPhase('done');

        if (user) {
          const myNickname = ownParticipantRef.current?.nickname;
          const myRanking = event.rankings.find(r => r.nickname === myNickname);
          if (myRanking) await saveGameSession(myRanking);
        }
      }
    });
  }, [onEvent, saveGameSession, user]);

  return {
    mpPhase,
    engine,
    rankings,
    ownNickname: ownParticipant?.nickname ?? '',
    participants,
    readyNicknames,
    markReady,
  };
}
