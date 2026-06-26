import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { MultiplayerEvent } from '@/types/multiplayer';

export interface PresenceEntry {
  nickname: string;
  user_id: string | null;
  is_host: boolean;
  player_slot: number;
}

interface PresencePayload {
  nickname: string;
  user_id: string | null;
  is_host: boolean;
}

export function useRealtimeRoom(code: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef<Set<(event: MultiplayerEvent) => void>>(new Set());
  const [presenceList, setPresenceList] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!code) return;

    const channel = supabase.channel(`room:${code}`);

    channel
      .on('broadcast', { event: 'mp_event' }, ({ payload }) => {
        const event = payload as MultiplayerEvent;
        handlersRef.current.forEach(h => h(event));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const entries = Object.values(state)
          .flat()
          .map((entry, idx) => ({
            nickname: entry.nickname,
            user_id: entry.user_id,
            is_host: entry.is_host,
            player_slot: idx + 1,
          }));
        setPresenceList(entries);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code]);

  const broadcast = useCallback((event: MultiplayerEvent) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'mp_event',
      payload: event,
    });
  }, []);

  const onEvent = useCallback((handler: (event: MultiplayerEvent) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const trackPresence = useCallback(
    (info: { nickname: string; user_id: string | null; is_host: boolean }) => {
      channelRef.current?.track(info);
    },
    [],
  );

  return { broadcast, onEvent, presenceList, trackPresence };
}
