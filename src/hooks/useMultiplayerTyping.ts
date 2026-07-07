import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerRoom, getStoredToken } from '@/hooks/useMultiplayerRoom';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { generateWordSet, getCodeSnippet } from '@/lib/typingWordSets';
import { calculateWpm, calculateCharWpm } from '@/lib/typingRender';
import { getTitleForXp } from '@/lib/titles';
import type {
  MultiplayerRoom,
  MultiplayerParticipant,
  RankedResult,
  TypingMode,
  CodeLanguage,
} from '@/types/multiplayer';
import {
  XP_PER_SESSION_CAP,
  DAILY_SESSION_CAP,
  MP_XP_MULTIPLIER_1ST,
  MP_XP_MULTIPLIER_2ND,
  MP_XP_MULTIPLIER_DEFAULT,
  MP_PROGRESS_BROADCAST_MS,
  MP_TYPING_WORD_COUNT,
} from '@/config/constants';

export interface PlayerProgress {
  progress_pct: number;
  wpm: number;
  score: number;
  finished: boolean;
  finishOrder: number | null;
}

export interface UseMultiplayerTypingReturn {
  phase: 'ready' | 'countdown' | 'active' | 'done';
  mode: TypingMode;
  language: CodeLanguage | null;
  words: string[];
  snippetText: string;
  wordIdx: number;
  typedChars: string;
  charIdx: number;
  myWpm: number;
  myProgressPct: number;
  myFinished: boolean;
  playerProgress: Record<string, PlayerProgress>;
  timeRemaining: number | null;
  rankings: RankedResult[];
  ownNickname: string;
  participants: MultiplayerParticipant[];
  readyNicknames: string[];
  markReady: () => void;
  startRace: () => void;
  handleEnglishInput: (raw: string) => void;
  handleCodeKey: (key: string) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useMultiplayerTyping(room: MultiplayerRoom): UseMultiplayerTypingReturn {
  const { user } = useAuth();
  const { fetchParticipantByToken, fetchParticipants, finalizeResults } = useMultiplayerRoom();
  const { broadcast, onEvent } = useRealtimeRoom(room.code);

  const mode: TypingMode = room.typing_mode ?? 'english';
  const language: CodeLanguage | null = room.code_language;

  // Shared seed guarantees every client races on the same target text.
  const words = useMemo(
    () => (mode === 'english' ? generateWordSet(room.seed, room.question_count ?? MP_TYPING_WORD_COUNT) : []),
    [mode, room.seed, room.question_count],
  );
  const snippetText = useMemo(
    () => (mode === 'code' && language ? getCodeSnippet(room.seed, language)?.code ?? '' : ''),
    [mode, room.seed, language],
  );

  const totalUnits = mode === 'english' ? words.length : snippetText.length;

  const [ownParticipant, setOwnParticipant] = useState<MultiplayerParticipant | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'active' | 'done'>('ready');
  const [wordIdx, setWordIdx] = useState(0);
  const [typedChars, setTypedChars] = useState('');
  const [charIdx, setCharIdx] = useState(0);
  const [playerProgress, setPlayerProgress] = useState<Record<string, PlayerProgress>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rankings, setRankings] = useState<RankedResult[]>([]);
  const [readyNicknames, setReadyNicknames] = useState<string[]>([]);

  // Refs for stable access in async callbacks
  const isHostRef = useRef(false);
  const ownParticipantRef = useRef<MultiplayerParticipant | null>(null);
  const participantsRef = useRef<MultiplayerParticipant[]>([]);
  const playerProgressRef = useRef<Record<string, PlayerProgress>>({});
  const readyNicknamesRef = useRef<Set<string>>(new Set());
  const hasEndedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const lastBroadcastRef = useRef(0);
  const finishCounterRef = useRef(0);
  const myFinishedRef = useRef(false);
  const totalUnitsRef = useRef(totalUnits);

  useEffect(() => { totalUnitsRef.current = totalUnits; }, [totalUnits]);

  const setProgressEntry = useCallback((nickname: string, entry: Partial<PlayerProgress>) => {
    const prev = playerProgressRef.current[nickname] ?? {
      progress_pct: 0, wpm: 0, score: 0, finished: false, finishOrder: null,
    };
    const updated = { ...playerProgressRef.current, [nickname]: { ...prev, ...entry } };
    playerProgressRef.current = updated;
    setPlayerProgress({ ...updated });
  }, []);

  // Host: begin race once every participant has pressed ready
  const triggerStartIfAllReady = useCallback(() => {
    if (!isHostRef.current) return;
    const total = participantsRef.current.length;
    if (total === 0) return;
    if (readyNicknamesRef.current.size >= total) {
      broadcast({ type: 'game_begin' });
      setPhase('countdown');
    }
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
    });

    fetchParticipants(room.id).then(parts => {
      setParticipants(parts);
      participantsRef.current = parts;

      const merged = { ...playerProgressRef.current };
      parts.forEach(p => {
        if (!(p.nickname in merged)) {
          merged[p.nickname] = { progress_pct: 0, wpm: 0, score: 0, finished: false, finishOrder: null };
        }
      });
      playerProgressRef.current = merged;
      setPlayerProgress({ ...merged });

      // Re-check in case all readied before participants loaded
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

  // Called when the local 3-2-1 overlay finishes. Starting the clock here (rather
  // than at game_begin) keeps the countdown out of everyone's WPM and time limit.
  const startRace = useCallback(() => {
    setPhase(p => (p === 'countdown' ? 'active' : p));
  }, []);

  // ── Rankings & persistence ────────────────────────────────────────────────────

  const buildRankings = useCallback((): RankedResult[] => {
    const entries = Object.entries(playerProgressRef.current);
    // Finishers first by finish order, then unfinished players by progress
    entries.sort(([, a], [, b]) => {
      if (a.finished && b.finished) return (a.finishOrder ?? 0) - (b.finishOrder ?? 0);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.score - a.score;
    });

    return entries.map(([nickname, p], idx) => {
      const position = idx + 1;
      const baseXp = Math.min(Math.floor(p.wpm / 10), XP_PER_SESSION_CAP);
      const multiplier =
        position === 1 ? MP_XP_MULTIPLIER_1ST :
        position === 2 ? MP_XP_MULTIPLIER_2ND :
        MP_XP_MULTIPLIER_DEFAULT;
      const xpEarned = Math.min(Math.floor(baseXp * multiplier), XP_PER_SESSION_CAP);
      const participant = participantsRef.current.find(pt => pt.nickname === nickname);
      return {
        nickname,
        user_id: participant?.user_id ?? null,
        score: p.score,
        wpm: p.wpm,
        position,
        xp_earned: xpEarned,
      };
    });
  }, []);

  const saveGameSession = useCallback(async (myRanking: RankedResult) => {
    if (!user) return;

    const { count } = await db
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('game_type', 'typing-race')
      .gte('completed_at', getTodayStart());

    const xpToSave = (count ?? 0) >= DAILY_SESSION_CAP ? 0 : myRanking.xp_earned;

    await db.from('game_sessions').insert({
      user_id: user.id,
      game_type: 'typing-race',
      score_wpm: myRanking.wpm ?? 0,
      accuracy: 100,
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

  const endGame = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    const finalRankings = buildRankings();
    broadcast({ type: 'game_end', rankings: finalRankings });
    setRankings(finalRankings);
    setPhase('done');

    await finalizeResults(room.id, finalRankings);

    if (user) {
      const myNickname = ownParticipantRef.current?.nickname;
      const myRanking = finalRankings.find(r => r.nickname === myNickname);
      if (myRanking) await saveGameSession(myRanking);
    }
  }, [broadcast, buildRankings, finalizeResults, room.id, saveGameSession, user]);

  const endGameRef = useRef(endGame);
  useEffect(() => { endGameRef.current = endGame; }, [endGame]);

  // Host: end the race when every participant has finished
  const checkAllFinished = useCallback(() => {
    if (!isHostRef.current) return;
    const total = participantsRef.current.length;
    if (total === 0) return;
    const finished = Object.values(playerProgressRef.current).filter(p => p.finished).length;
    if (finished >= total) void endGameRef.current();
  }, []);

  // ── Event handling ────────────────────────────────────────────────────────────

  useEffect(() => {
    return onEvent(async (event) => {
      if (event.type === 'player_ready') {
        const { nickname } = event;
        if (!readyNicknamesRef.current.has(nickname)) {
          readyNicknamesRef.current.add(nickname);
          setReadyNicknames([...readyNicknamesRef.current]);
        }
        triggerStartIfAllReadyRef.current();
      }

      if (event.type === 'game_begin') {
        if (!isHostRef.current) setPhase('countdown');
      }

      if (event.type === 'progress_update') {
        setProgressEntry(event.nickname, {
          progress_pct: event.progress_pct,
          score: event.current_score,
          wpm: event.wpm ?? 0,
        });
      }

      if (event.type === 'player_finished') {
        finishCounterRef.current += 1;
        setProgressEntry(event.nickname, {
          progress_pct: 100,
          score: event.final_score,
          wpm: event.wpm ?? 0,
          finished: true,
          finishOrder: finishCounterRef.current,
        });
        checkAllFinished();
      }

      if (event.type === 'game_end') {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;
        setRankings(event.rankings);
        setPhase('done');

        if (user) {
          const myNickname = ownParticipantRef.current?.nickname;
          const myRanking = event.rankings.find(r => r.nickname === myNickname);
          if (myRanking) await saveGameSession(myRanking);
        }
      }
    });
  }, [onEvent, saveGameSession, setProgressEntry, checkAllFinished, user]);

  // ── Race clock ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'active') return;
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const timeRemaining = room.time_limit_seconds !== null
    ? Math.max(0, room.time_limit_seconds - elapsedSeconds)
    : null;

  useEffect(() => {
    if (phase !== 'active' || timeRemaining !== 0) return;
    if (!isHostRef.current) return;
    void endGameRef.current();
  }, [timeRemaining, phase]);

  // ── Own progress ──────────────────────────────────────────────────────────────

  const elapsedNow = useCallback(() => {
    if (startTimeRef.current === null) return 0;
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  const ownEntry = playerProgress[ownParticipant?.nickname ?? ''];
  // Once finished, freeze WPM at the recorded final value instead of decaying with the clock
  const myWpm = ownEntry?.finished
    ? ownEntry.wpm
    : mode === 'english'
    ? calculateWpm(wordIdx, elapsedSeconds)
    : calculateCharWpm(charIdx, elapsedSeconds);

  const unitsCompleted = mode === 'english' ? wordIdx : charIdx;
  const myProgressPct = totalUnits > 0 ? Math.round((unitsCompleted / totalUnits) * 100) : 0;

  const broadcastProgress = useCallback((completed: number, force = false) => {
    const nickname = ownParticipantRef.current?.nickname;
    if (!nickname) return;
    const now = Date.now();
    if (!force && now - lastBroadcastRef.current < MP_PROGRESS_BROADCAST_MS) return;
    lastBroadcastRef.current = now;

    const total = totalUnitsRef.current;
    const elapsed = elapsedNow();
    const wpm = mode === 'english'
      ? calculateWpm(completed, elapsed)
      : calculateCharWpm(completed, elapsed);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    setProgressEntry(nickname, { progress_pct: pct, score: completed, wpm });
    broadcast({
      type: 'progress_update',
      nickname,
      progress_pct: pct,
      current_score: completed,
      wpm,
    });
  }, [broadcast, elapsedNow, mode, setProgressEntry]);

  const finishRace = useCallback((completed: number) => {
    if (myFinishedRef.current) return;
    myFinishedRef.current = true;

    const nickname = ownParticipantRef.current?.nickname;
    if (!nickname) return;

    const elapsed = elapsedNow();
    const wpm = mode === 'english'
      ? calculateWpm(completed, elapsed)
      : calculateCharWpm(completed, elapsed);

    finishCounterRef.current += 1;
    setProgressEntry(nickname, {
      progress_pct: 100,
      score: completed,
      wpm,
      finished: true,
      finishOrder: finishCounterRef.current,
    });
    broadcast({ type: 'player_finished', nickname, final_score: completed, wpm });
    checkAllFinished();
  }, [broadcast, elapsedNow, mode, setProgressEntry, checkAllFinished]);

  // ── Input handlers ────────────────────────────────────────────────────────────

  // English mode: driven by hidden-input onChange (mobile-safe). A word only
  // commits when typed correctly — spaces on a wrong word are ignored.
  const handleEnglishInput = useCallback((raw: string) => {
    if (phase !== 'active' || myFinishedRef.current) return;

    if (!raw.includes(' ')) {
      setTypedChars(raw);
      return;
    }

    const attempted = raw.replace(/ +$/, '');
    const target = words[wordIdx];
    if (attempted === target) {
      const next = wordIdx + 1;
      setWordIdx(next);
      setTypedChars('');
      if (next >= words.length) {
        broadcastProgress(next, true);
        finishRace(next);
      } else {
        broadcastProgress(next);
      }
    } else {
      // Wrong word — drop the trailing space so the player can correct it
      setTypedChars(attempted);
    }
  }, [phase, words, wordIdx, broadcastProgress, finishRace]);

  // Code mode: strict character-by-character advance. Returns false on a miss
  // so the page can flash an error.
  const handleCodeKey = useCallback((key: string): boolean => {
    if (phase !== 'active' || myFinishedRef.current) return true;
    if (charIdx >= snippetText.length) return true;

    const expected = snippetText[charIdx];
    const typed = key === 'Enter' ? '\n' : key;
    if (typed !== expected) return false;

    const next = charIdx + 1;
    setCharIdx(next);
    if (next >= snippetText.length) {
      broadcastProgress(next, true);
      finishRace(next);
    } else {
      broadcastProgress(next);
    }
    return true;
  }, [phase, charIdx, snippetText, broadcastProgress, finishRace]);

  return {
    phase,
    mode,
    language,
    words,
    snippetText,
    wordIdx,
    typedChars,
    charIdx,
    myWpm,
    myProgressPct,
    myFinished: myFinishedRef.current,
    playerProgress,
    timeRemaining,
    rankings,
    ownNickname: ownParticipant?.nickname ?? '',
    participants,
    readyNicknames,
    markReady,
    startRace,
    handleEnglishInput,
    handleCodeKey,
  };
}
