import { getSupabase } from './client';
import type { UserProfile, Room, RoomPlayer } from '../game/types';
import { generateRoomCode } from '../utils/helpers';

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    username: data.username,
    avatarId: data.avatar_id,
    gamesPlayed: data.games_played,
    gamesWon: data.games_won,
    gamesLost: data.games_lost,
    currentStreak: data.current_streak,
  };
}

export async function updateProfile(
  userId: string,
  updates: { username?: string; avatar_id?: number }
): Promise<boolean> {
  const { error } = await getSupabase()
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  return !error;
}

export async function updateStats(
  userId: string,
  won: boolean
): Promise<void> {
  const profile = await fetchProfile(userId);
  if (!profile) return;

  const newStreak = won ? profile.currentStreak + 1 : 0;

  await getSupabase()
    .from('profiles')
    .update({
      games_played: profile.gamesPlayed + 1,
      games_won: won ? profile.gamesWon + 1 : profile.gamesWon,
      games_lost: won ? profile.gamesLost : profile.gamesLost + 1,
      current_streak: newStreak,
    })
    .eq('id', userId);
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoom(
  createdBy: string,
  mode: 'online_2p' | 'online_4p',
  maxPoints: 12 | 24,
  visibility: 'public' | 'private'
): Promise<Room | null> {
  const code = generateRoomCode();

  const { data, error } = await getSupabase()
    .from('rooms')
    .insert({
      code,
      mode,
      max_points: maxPoints,
      visibility,
      created_by: createdBy,
      status: 'waiting',
    })
    .select()
    .single();

  if (error || !data) return null;
  return mapRoom(data);
}

export async function fetchRoomByCode(code: string): Promise<Room | null> {
  const { data, error } = await getSupabase()
    .from('rooms')
    .select('*, room_players(*, profiles(username, avatar_id))')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) return null;
  return mapRoomWithPlayers(data);
}

export async function fetchPublicRooms(): Promise<Room[]> {
  const { data, error } = await getSupabase()
    .from('rooms')
    .select('*, room_players(*, profiles(username, avatar_id))')
    .eq('status', 'waiting')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data.map(mapRoomWithPlayers);
}

export async function joinRoom(
  roomId: string,
  userId: string,
  position: 0 | 1 | 2 | 3
): Promise<boolean> {
  const { error } = await getSupabase()
    .from('room_players')
    .upsert({ room_id: roomId, user_id: userId, position, is_ready: false, is_connected: true });
  return !error;
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await getSupabase()
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

export async function setReady(
  roomId: string,
  userId: string,
  ready: boolean
): Promise<void> {
  await getSupabase()
    .from('room_players')
    .update({ is_ready: ready })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

export async function updateRoomStatus(
  roomId: string,
  status: 'waiting' | 'playing' | 'finished'
): Promise<void> {
  await getSupabase().from('rooms').update({ status, updated_at: new Date().toISOString() }).eq('id', roomId);
}

// ─── Game State ───────────────────────────────────────────────────────────────

export async function fetchGameState(roomId: string): Promise<unknown | null> {
  const { data, error } = await getSupabase()
    .from('game_state')
    .select('state')
    .eq('room_id', roomId)
    .single();

  if (error || !data) return null;
  return data.state;
}

export async function upsertGameState(roomId: string, state: unknown): Promise<void> {
  await getSupabase()
    .from('game_state')
    .upsert({ room_id: roomId, state, updated_at: new Date().toISOString() });
}

export async function insertGameAction(
  roomId: string,
  userId: string,
  actionType: string,
  payload: unknown
): Promise<void> {
  await getSupabase()
    .from('game_actions')
    .insert({ room_id: roomId, user_id: userId, action_type: actionType, payload });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendMessage(
  roomId: string,
  userId: string,
  content: string,
  isQuickReply = false
): Promise<void> {
  await getSupabase()
    .from('messages')
    .insert({ room_id: roomId, user_id: userId, content, is_quick_reply: isQuickReply });
}

export async function fetchMessages(roomId: string, limit = 50) {
  const { data } = await getSupabase()
    .from('messages')
    .select('*, profiles(username)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse();
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapRoom(data: Record<string, unknown>): Room {
  return {
    id: data.id as string,
    code: data.code as string,
    mode: data.mode as 'online_2p' | 'online_4p',
    maxPoints: (data.max_points as 12 | 24),
    status: data.status as Room['status'],
    visibility: data.visibility as Room['visibility'],
    createdBy: data.created_by as string,
    players: [],
  };
}

function mapRoomWithPlayers(data: Record<string, unknown>): Room {
  const room = mapRoom(data);
  const rps = (data.room_players as Array<Record<string, unknown>>) ?? [];

  room.players = rps.map((rp) => ({
    userId: rp.user_id as string,
    username: ((rp.profiles as Record<string, unknown>)?.username as string) ?? 'Jugador',
    avatarId: ((rp.profiles as Record<string, unknown>)?.avatar_id as number) ?? 0,
    position: rp.position as RoomPlayer['position'],
    isReady: rp.is_ready as boolean,
    isConnected: rp.is_connected as boolean,
  }));

  return room;
}
