'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useGameStore } from '@/store/gameStore';
import {
  fetchRoomByCode, joinRoom, leaveRoom, setReady,
  updateRoomStatus, upsertGameState, fetchGameState,
} from '@/supabase/queries';
import { subscribeToRoom, unsubscribe } from '@/supabase/realtime';
import { createInitialGameState, startHand } from '@/game/gameEngine';
import type { Room, Player } from '@/game/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const MAX_PLAYERS: Record<string, number> = { online_2p: 2, online_4p: 4 };
const TEAM_LABEL = ['Equipo A', 'Equipo B'];

export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { initOnlineGame } = useGameStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const myUserId = profile?.id ?? '';

  const refresh = useCallback(async () => {
    const r = await fetchRoomByCode(code);
    if (!r) return;
    setRoom(r);

    if (r.status === 'playing') {
      const state = await fetchGameState(r.id);
      if (state) {
        initOnlineGame(state as never);
        router.push(`/game?mode=${r.mode}&room=${r.id}`);
      }
    }
  }, [code, initOnlineGame, router]);

  useEffect(() => {
    if (!myUserId) return;

    (async () => {
      const r = await fetchRoomByCode(code);
      if (!r) { setError('Sala no encontrada'); setLoading(false); return; }

      if (!r.players.find(p => p.userId === myUserId)) {
        const pos = r.players.length as 0 | 1 | 2 | 3;
        const ok = await joinRoom(r.id, myUserId, pos);
        if (!ok) { setError('No se pudo unir a la sala'); setLoading(false); return; }
      }

      await refresh();
      setLoading(false);

      channelRef.current = subscribeToRoom(r.id, {
        onPlayerJoin: refresh,
        onPlayerUpdate: refresh,
        onPlayerLeave: refresh,
        onRoomUpdate: refresh,
      });
    })();

    return () => { if (channelRef.current) unsubscribe(channelRef.current); };
  }, [myUserId, code]);

  const handleReady = async () => {
    if (!room) return;
    const me = room.players.find(p => p.userId === myUserId);
    if (!me) return;
    await setReady(room.id, myUserId, !me.isReady);
  };

  const handleStart = async () => {
    if (!room) return;
    const max = MAX_PLAYERS[room.mode] ?? 2;
    const sorted = [...room.players].sort((a, b) => a.position - b.position).slice(0, max);

    const players: Player[] = sorted.map(rp => ({
      id: rp.userId,
      name: rp.username,
      avatarId: rp.avatarId,
      isHuman: true,
      isOnline: true,
      position: rp.position as 0 | 1 | 2 | 3,
      team: (rp.position % 2) as 0 | 1,
    }));

    const initialState = createInitialGameState(players, room.mode as never, room.maxPoints, room.id);
    const withHand = startHand(initialState);

    await upsertGameState(room.id, withHand);
    await updateRoomStatus(room.id, 'playing');
  };

  const handleLeave = async () => {
    if (!room) return;
    await leaveRoom(room.id, myUserId);
    router.push('/home');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!myUserId) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Inicia sesión para unirte</p>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Entrando a la sala...</p>
    </div>
  );

  if (error || !room) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <p className="text-red-400">{error || 'Sala no encontrada'}</p>
      <button onClick={() => router.push('/home')} className="text-primary">← Volver</button>
    </div>
  );

  const max = MAX_PLAYERS[room.mode] ?? 2;
  const positions = Array.from({ length: max }, (_, i) => i);
  const me = room.players.find(p => p.userId === myUserId);
  const isHost = room.createdBy === myUserId;
  const allReady = room.players.length === max && room.players.every(p => p.isReady);

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pt-8 mb-8">
        <button onClick={handleLeave} className="text-primary text-xl">‹</button>
        <h1 className="text-xl font-bold">
          {room.mode === 'online_2p' ? '1 vs 1 Online' : '2 vs 2 Online'}
        </h1>
        <span className="ml-auto text-xs text-gray-400">{room.maxPoints} pts</span>
      </div>

      {/* Room code */}
      <div className="bg-[#1e2d20] border border-[#2a3d2c] rounded-2xl p-5 mb-6 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Código de sala</p>
        <p className="text-4xl font-mono font-bold text-primary tracking-widest mb-3">{code}</p>
        <button onClick={copyCode} className="text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? '✓ Copiado' : 'Copiar código'}
        </button>
      </div>

      {/* Players list */}
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
        Jugadores ({room.players.length}/{max})
      </p>
      <div className="space-y-2 mb-6">
        {positions.map(pos => {
          const player = room.players.find(p => p.position === pos);
          const isMe = player?.userId === myUserId;
          return (
            <div key={pos} className={`flex items-center gap-3 p-3 rounded-xl border ${
              player
                ? 'bg-[#1e2d20] border-[#2a3d2c]'
                : 'border-dashed border-[#2a3d2c] opacity-40'
            }`}>
              <div className="w-9 h-9 rounded-full bg-[#2a3d2c] flex items-center justify-center text-sm font-bold">
                {player ? player.username[0].toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {player ? player.username : 'Esperando...'}
                  {isMe && <span className="text-primary text-xs ml-1">(tú)</span>}
                  {player?.userId === room.createdBy && <span className="text-yellow-400 text-xs ml-1">👑</span>}
                </p>
                <p className="text-xs text-gray-500">{TEAM_LABEL[pos % 2]}</p>
              </div>
              {player && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                  player.isReady
                    ? 'bg-primary/20 text-primary'
                    : 'bg-[#2a3d2c] text-gray-400'
                }`}>
                  {player.isReady ? '✓ Listo' : 'Esperando'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {me && (
        <button
          onClick={handleReady}
          className={`w-full py-4 rounded-xl font-bold text-base mb-3 transition-colors ${
            me.isReady
              ? 'bg-[#2a3d2c] text-gray-300 hover:bg-[#1e2d20]'
              : 'bg-primary text-black hover:bg-green-400'
          }`}
        >
          {me.isReady ? 'Cancelar' : '✓ Estoy listo'}
        </button>
      )}

      {isHost && (
        <button
          onClick={handleStart}
          disabled={!allReady}
          className="w-full py-4 rounded-xl font-bold text-base border border-[#2a3d2c] bg-[#1e2d20] disabled:opacity-40 hover:bg-[#2a3d2c] disabled:cursor-not-allowed transition-colors"
        >
          {allReady
            ? '🃏 Iniciar partida'
            : `Esperando jugadores (${room.players.length}/${max})`}
        </button>
      )}

      {!isHost && (
        <p className="text-center text-sm text-gray-500 mt-2">
          El anfitrión iniciará la partida cuando todos estén listos
        </p>
      )}
    </main>
  );
}
