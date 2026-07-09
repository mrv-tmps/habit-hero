import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MP_ROOM_CODE_LENGTH } from '@/config/constants';
import type {
  GameType,
  MathDifficulty,
  TypingMode,
  CodeLanguage,
  MultiplayerRoom,
  MultiplayerParticipant,
  RankedResult,
} from '@/types/multiplayer';

export interface CreateRoomConfig {
  game_type: GameType;
  difficulty?: MathDifficulty;
  typing_mode?: TypingMode;
  code_language?: CodeLanguage;
  question_count?: number;
  time_limit_seconds?: number;
  max_players?: number;
  nickname: string;
  user_id?: string | null;
}

// Full config the host can edit in the lobby. Nulls clear a column that does not
// apply to the selected game type.
export interface RoomConfigUpdate {
  game_type: GameType;
  difficulty: MathDifficulty | null;
  typing_mode: TypingMode | null;
  code_language: CodeLanguage | null;
  question_count: number | null;
  time_limit_seconds: number | null;
  max_players: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function generateRoomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function tokenKey(roomCode: string): string {
  return `mp-token-${roomCode}`;
}

export function getStoredToken(roomCode: string): string | null {
  return sessionStorage.getItem(tokenKey(roomCode));
}

export function useMultiplayerRoom() {
  // All functions close only over module-level constants (db, MP_ROOM_CODE_LENGTH),
  // so empty deps [] is correct — prevents re-render loops when used in useEffect deps.

  const createRoom = useCallback(async (
    config: CreateRoomConfig,
  ): Promise<{ room: MultiplayerRoom; participantToken: string }> => {
    const seed = Math.floor(Math.random() * 2 ** 31);

    let room: MultiplayerRoom | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode(MP_ROOM_CODE_LENGTH);
      const { data, error } = await db
        .from('multiplayer_rooms')
        .insert({
          code,
          game_type: config.game_type,
          difficulty: config.difficulty ?? null,
          typing_mode: config.typing_mode ?? null,
          code_language: config.code_language ?? null,
          host_user_id: config.user_id ?? null,
          question_count: config.question_count ?? null,
          time_limit_seconds: config.time_limit_seconds ?? null,
          max_players: config.max_players ?? 8,
          seed,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') continue;
        throw error;
      }

      room = data as MultiplayerRoom;
      break;
    }

    if (!room) throw new Error('Failed to generate a unique room code.');

    const { data: participant, error: pError } = await db
      .from('multiplayer_participants')
      .insert({
        room_id: room.id,
        user_id: config.user_id ?? null,
        nickname: config.nickname,
        is_host: true,
      })
      .select()
      .single();

    if (pError) throw pError;

    const participantToken = (participant as MultiplayerParticipant).participant_token;
    sessionStorage.setItem(tokenKey(room.code), participantToken);

    return { room, participantToken };
  }, []);

  const joinRoom = useCallback(async (
    code: string,
    nickname: string,
    userId?: string | null,
  ): Promise<{ room: MultiplayerRoom; participantToken: string }> => {
    const { data: roomData, error: rError } = await db
      .from('multiplayer_rooms')
      .select()
      .eq('code', code.toUpperCase())
      .single();

    if (rError) throw rError;

    const room = roomData as MultiplayerRoom;
    if (room.status !== 'waiting') {
      throw new Error('This room has already started or finished.');
    }

    const { data: participant, error: pError } = await db
      .from('multiplayer_participants')
      .insert({
        room_id: room.id,
        user_id: userId ?? null,
        nickname,
        is_host: false,
      })
      .select()
      .single();

    if (pError) throw pError;

    const participantToken = (participant as MultiplayerParticipant).participant_token;
    sessionStorage.setItem(tokenKey(room.code), participantToken);

    return { room, participantToken };
  }, []);

  const fetchParticipantByToken = useCallback(async (
    token: string,
  ): Promise<MultiplayerParticipant | null> => {
    const { data, error } = await db
      .from('multiplayer_participants')
      .select()
      .eq('participant_token', token)
      .single();

    if (error) return null;
    return data as MultiplayerParticipant;
  }, []);

  const fetchRoom = useCallback(async (code: string): Promise<MultiplayerRoom | null> => {
    const { data, error } = await db
      .from('multiplayer_rooms')
      .select()
      .eq('code', code.toUpperCase())
      .single();

    if (error) return null;
    return data as MultiplayerRoom;
  }, []);

  const fetchParticipants = useCallback(async (roomId: string): Promise<MultiplayerParticipant[]> => {
    const { data, error } = await db
      .from('multiplayer_participants')
      .select()
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return (data ?? []) as MultiplayerParticipant[];
  }, []);

  const leaveRoom = useCallback(async (participantId: string): Promise<void> => {
    const { error } = await db
      .from('multiplayer_participants')
      .delete()
      .eq('id', participantId);

    if (error) throw error;
  }, []);

  const startGame = useCallback(async (roomId: string): Promise<void> => {
    const { error } = await db
      .from('multiplayer_rooms')
      .update({ status: 'active' })
      .eq('id', roomId);

    if (error) throw error;
  }, []);

  const resetRoomForRematch = useCallback(async (
    roomId: string,
    token: string,
    seed: number,
  ): Promise<void> => {
    const { error } = await db.rpc('reset_room_for_rematch', {
      p_room_id: roomId,
      p_token: token,
      p_seed: seed,
    });
    if (error) throw error;
  }, []);

  const updateRoomConfig = useCallback(async (
    roomId: string,
    token: string,
    config: RoomConfigUpdate,
  ): Promise<void> => {
    const { error } = await db.rpc('update_room_config', {
      p_room_id: roomId,
      p_token: token,
      p_game_type: config.game_type,
      p_difficulty: config.difficulty,
      p_typing_mode: config.typing_mode,
      p_code_language: config.code_language,
      p_question_count: config.question_count,
      p_time_limit_seconds: config.time_limit_seconds,
      p_max_players: config.max_players,
    });
    if (error) throw error;
  }, []);

  const finalizeResults = useCallback(async (roomId: string, rankings: RankedResult[]): Promise<void> => {
    await Promise.all(
      rankings.map(r =>
        db
          .from('multiplayer_participants')
          .update({
            position: r.position,
            xp_earned: r.xp_earned,
            finished_at: new Date().toISOString(),
          })
          .eq('room_id', roomId)
          .eq('nickname', r.nickname),
      ),
    );

    const { error } = await db
      .from('multiplayer_rooms')
      .update({ status: 'finished' })
      .eq('id', roomId);

    if (error) throw error;
  }, []);

  return {
    createRoom,
    joinRoom,
    fetchParticipantByToken,
    fetchRoom,
    fetchParticipants,
    leaveRoom,
    startGame,
    resetRoomForRematch,
    updateRoomConfig,
    finalizeResults,
  };
}
