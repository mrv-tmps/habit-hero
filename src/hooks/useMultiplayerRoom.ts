import { supabase } from '@/integrations/supabase/client';
import { MP_ROOM_CODE_LENGTH } from '@/config/constants';
import type {
  GameType,
  MathDifficulty,
  MultiplayerRoom,
  MultiplayerParticipant,
  RankedResult,
} from '@/types/multiplayer';

export interface CreateRoomConfig {
  game_type: GameType;
  difficulty?: MathDifficulty;
  question_count?: number;
  time_limit_seconds?: number;
  max_players?: number;
  nickname: string;
  user_id?: string | null;
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
  async function createRoom(
    config: CreateRoomConfig,
  ): Promise<{ room: MultiplayerRoom; participantToken: string }> {
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
  }

  async function joinRoom(
    code: string,
    nickname: string,
    userId?: string | null,
  ): Promise<{ room: MultiplayerRoom; participantToken: string }> {
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
  }

  async function fetchParticipantByToken(
    token: string,
  ): Promise<MultiplayerParticipant | null> {
    const { data, error } = await db
      .from('multiplayer_participants')
      .select()
      .eq('participant_token', token)
      .single();

    if (error) return null;
    return data as MultiplayerParticipant;
  }

  async function fetchRoom(code: string): Promise<MultiplayerRoom | null> {
    const { data, error } = await db
      .from('multiplayer_rooms')
      .select()
      .eq('code', code.toUpperCase())
      .single();

    if (error) return null;
    return data as MultiplayerRoom;
  }

  async function fetchParticipants(roomId: string): Promise<MultiplayerParticipant[]> {
    const { data, error } = await db
      .from('multiplayer_participants')
      .select()
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return (data ?? []) as MultiplayerParticipant[];
  }

  async function leaveRoom(participantId: string): Promise<void> {
    const { error } = await db
      .from('multiplayer_participants')
      .delete()
      .eq('id', participantId);

    if (error) throw error;
  }

  async function startGame(roomId: string): Promise<void> {
    const { error } = await db
      .from('multiplayer_rooms')
      .update({ status: 'active' })
      .eq('id', roomId);

    if (error) throw error;
  }

  async function finalizeResults(roomId: string, rankings: RankedResult[]): Promise<void> {
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
  }

  return {
    createRoom,
    joinRoom,
    fetchParticipantByToken,
    fetchRoom,
    fetchParticipants,
    leaveRoom,
    startGame,
    finalizeResults,
  };
}
