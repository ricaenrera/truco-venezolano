import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Handler = (payload: unknown) => void;

// ─── Room channel (lobby) ─────────────────────────────────────────────────────

export function subscribeToRoom(
  roomId: string,
  handlers: {
    onPlayerJoin?: Handler;
    onPlayerUpdate?: Handler;
    onPlayerLeave?: Handler;
    onRoomUpdate?: Handler;
  }
): RealtimeChannel {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      (p) => handlers.onPlayerJoin?.(p.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      (p) => handlers.onPlayerUpdate?.(p.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      (p) => handlers.onPlayerLeave?.(p.old)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (p) => handlers.onRoomUpdate?.(p.new)
    )
    .subscribe();

  return channel;
}

// ─── Game channel ─────────────────────────────────────────────────────────────

export function subscribeToGame(
  roomId: string,
  handlers: {
    onStateUpdate?: Handler;
    onAction?: Handler;
    onMessage?: Handler;
  }
): RealtimeChannel {
  const channel = supabase
    .channel(`game:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` },
      (p) => handlers.onStateUpdate?.(p.new)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'game_actions', filter: `room_id=eq.${roomId}` },
      (p) => handlers.onAction?.(p.new)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (p) => handlers.onMessage?.(p.new)
    )
    .subscribe();

  return channel;
}

// ─── Presence (connection status) ────────────────────────────────────────────

export function subscribeToPresence(
  roomId: string,
  userId: string,
  username: string,
  onSync: (presences: Record<string, unknown[]>) => void
): RealtimeChannel {
  const channel = supabase.channel(`presence:${roomId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      onSync(channel.presenceState());
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, username, online_at: new Date().toISOString() });
      }
    });

  return channel;
}

export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
