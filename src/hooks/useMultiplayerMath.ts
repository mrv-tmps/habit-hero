import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerRoom, getStoredToken } from '@/hooks/useMultiplayerRoom';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { generateQuestions, type MathProblem } from '@/lib/mathQuestions';
import { getTitleForXp } from '@/lib/titles';
import type { MultiplayerRoom, MultiplayerParticipant, RankedResult } from '@/types/multiplayer';
import {
  XP_PER_SESSION_CAP,
  DAILY_SESSION_CAP,
  MP_XP_MULTIPLIER_1ST,
  MP_XP_MULTIPLIER_2ND,
  MP_XP_MULTIPLIER_DEFAULT,
} from '@/config/constants';

export interface ClaimerFlash {
  nickname: string;
  questionIdx: number;
}

export interface UseMultiplayerMathReturn {
  phase: 'ready' | 'active' | 'done';
  questions: MathProblem[];
  currentQuestionIdx: number;
  myScore: number;
  playerScores: Record<string, number>;
  timeRemaining: number | null;
  submitAnswer: (answer: number) => boolean;
  rankings: RankedResult[];
  ownNickname: string;
  participants: MultiplayerParticipant[];
  claimerFlash: ClaimerFlash | null;
  readyNicknames: string[];
  markReady: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useMultiplayerMath(room: MultiplayerRoom): UseMultiplayerMathReturn {
  const { user } = useAuth();
  const { fetchParticipantByToken, fetchParticipants, finalizeResults } = useMultiplayerRoom();
  const { broadcast, onEvent } = useRealtimeRoom(room.code);

  const [ownParticipant, setOwnParticipant] = useState<MultiplayerParticipant | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [phase, setPhase] = useState<'ready' | 'active' | 'done'>('ready');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [playerScores, setPlayerScores] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(room.time_limit_seconds ?? null);
  const [rankings, setRankings] = useState<RankedResult[]>([]);
  const [claimerFlash, setClaimerFlash] = useState<ClaimerFlash | null>(null);
  const [readyNicknames, setReadyNicknames] = useState<string[]>([]);

  const questions = useMemo(
    () => generateQuestions(room.seed, room.question_count ?? 10, room.difficulty ?? 'easy'),
    [room.seed, room.question_count, room.difficulty],
  );

  // Refs for stable access in async callbacks
  const isHostRef = useRef(false);
  const ownParticipantRef = useRef<MultiplayerParticipant | null>(null);
  const playerScoresRef = useRef<Record<string, number>>({});
  const currentQuestionIdxRef = useRef(0);
  const processedClaimRef = useRef(-1);
  const hasEndedRef = useRef(false);
  const participantsRef = useRef<MultiplayerParticipant[]>([]);
  const questionsRef = useRef(questions);
  const readyNicknamesRef = useRef<Set<string>>(new Set());

  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentQuestionIdxRef.current = currentQuestionIdx; }, [currentQuestionIdx]);

  // Host: start game when all participants have pressed ready
  const triggerStartIfAllReady = useCallback(() => {
    if (!isHostRef.current) return;
    const total = participantsRef.current.length;
    if (total === 0) return;
    if (readyNicknamesRef.current.size >= total) {
      broadcast({ type: 'game_begin' });
      setPhase('active');
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

      const merged = { ...playerScoresRef.current };
      parts.forEach(p => {
        if (!(p.nickname in merged)) merged[p.nickname] = 0;
      });
      playerScoresRef.current = merged;
      setPlayerScores({ ...merged });

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

  const buildRankings = useCallback((): RankedResult[] => {
    const sorted = Object.entries(playerScoresRef.current)
      .sort(([, a], [, b]) => b - a);

    return sorted.map(([nickname, score], idx) => {
      const position = idx + 1;
      const baseXp = Math.min(Math.floor((score / 10) * 1.0), XP_PER_SESSION_CAP);
      const multiplier =
        position === 1 ? MP_XP_MULTIPLIER_1ST :
        position === 2 ? MP_XP_MULTIPLIER_2ND :
        MP_XP_MULTIPLIER_DEFAULT;
      const xpEarned = Math.min(Math.floor(baseXp * multiplier), XP_PER_SESSION_CAP);
      const participant = participantsRef.current.find(p => p.nickname === nickname);
      return { nickname, user_id: participant?.user_id ?? null, score, position, xp_earned: xpEarned };
    });
  }, []);

  const saveGameSession = useCallback(async (myRanking: RankedResult) => {
    if (!user) return;

    const { count } = await db
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('game_type', 'math-buzzer')
      .gte('completed_at', getTodayStart());

    const xpToSave = (count ?? 0) >= DAILY_SESSION_CAP ? 0 : myRanking.xp_earned;

    await db.from('game_sessions').insert({
      user_id: user.id,
      game_type: 'math-buzzer',
      score_wpm: myRanking.score,
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
        // Host already transitioned in triggerStartIfAllReady
        if (!isHostRef.current) {
          setPhase('active');
        }
      }

      if (event.type === 'answer_claimed') {
        if (!isHostRef.current) return;
        if (processedClaimRef.current >= event.question_idx) return;
        processedClaimRef.current = event.question_idx;

        const { question_idx, by_nickname } = event;
        const newScores = { ...playerScoresRef.current };
        newScores[by_nickname] = (newScores[by_nickname] ?? 0) + 1;
        playerScoresRef.current = newScores;
        setPlayerScores({ ...newScores });

        setClaimerFlash({ nickname: by_nickname, questionIdx: question_idx });

        const total = questionsRef.current.length;
        broadcast({
          type: 'progress_update',
          nickname: by_nickname,
          progress_pct: Math.round((newScores[by_nickname] / total) * 100),
          current_score: newScores[by_nickname],
        });

        const nextIdx = question_idx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        broadcast({
          type: 'question_advance',
          question_idx: nextIdx,
          claimer_nickname: by_nickname,
        });

        if (nextIdx >= total) {
          await endGameRef.current();
        }
      }

      if (event.type === 'question_advance') {
        if (isHostRef.current) return;
        setCurrentQuestionIdx(event.question_idx);
        currentQuestionIdxRef.current = event.question_idx;
        setClaimerFlash({
          nickname: event.claimer_nickname,
          questionIdx: event.question_idx - 1,
        });
      }

      if (event.type === 'progress_update') {
        const { nickname, current_score } = event;
        const updated = { ...playerScoresRef.current, [nickname]: current_score };
        playerScoresRef.current = updated;
        setPlayerScores({ ...updated });
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
  }, [onEvent, broadcast, saveGameSession, user]);

  useEffect(() => {
    if (phase !== 'active' || room.time_limit_seconds === null) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, room.time_limit_seconds]);

  useEffect(() => {
    if (timeRemaining !== 0 || phase !== 'active') return;
    if (!isHostRef.current) return;
    void endGameRef.current();
  }, [timeRemaining, phase]);

  const submitAnswer = useCallback((answer: number): boolean => {
    const idx = currentQuestionIdxRef.current;
    const qs = questionsRef.current;
    if (idx >= qs.length) return false;

    const correct = answer === qs[idx].answer;
    if (!correct) return false;

    const myNickname = ownParticipantRef.current?.nickname;
    if (!myNickname) return false;

    if (isHostRef.current) {
      if (processedClaimRef.current >= idx) return true;
      processedClaimRef.current = idx;

      const newScores = { ...playerScoresRef.current };
      newScores[myNickname] = (newScores[myNickname] ?? 0) + 1;
      playerScoresRef.current = newScores;
      setPlayerScores({ ...newScores });

      setClaimerFlash({ nickname: myNickname, questionIdx: idx });

      const nextIdx = idx + 1;
      setCurrentQuestionIdx(nextIdx);
      currentQuestionIdxRef.current = nextIdx;

      broadcast({
        type: 'progress_update',
        nickname: myNickname,
        progress_pct: Math.round((newScores[myNickname] / qs.length) * 100),
        current_score: newScores[myNickname],
      });
      broadcast({
        type: 'question_advance',
        question_idx: nextIdx,
        claimer_nickname: myNickname,
      });

      if (nextIdx >= qs.length) {
        void endGameRef.current();
      }
    } else {
      broadcast({ type: 'answer_claimed', question_idx: idx, by_nickname: myNickname });
    }

    return true;
  }, [broadcast]);

  const myScore = playerScores[ownParticipant?.nickname ?? ''] ?? 0;

  return {
    phase,
    questions,
    currentQuestionIdx,
    myScore,
    playerScores,
    timeRemaining,
    submitAnswer,
    rankings,
    ownNickname: ownParticipant?.nickname ?? '',
    participants,
    claimerFlash,
    readyNicknames,
    markReady,
  };
}
