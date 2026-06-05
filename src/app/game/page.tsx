'use client';
import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import GameTable from '@/components/GameTable';
import type { RealtimeChannel } from '@supabase/supabase-js';

function GameContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { game, initOnlineGame, syncFromServer } = useGameStore();
  const { profile } = useAuthStore();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const mode = (params.get('mode') ?? 'local_2p') as 'local_2p' | 'local_4p' | 'online_2p' | 'online_4p';
  const roomId = params.get('room');

  // Online: cargar estado desde Supabase si el store está vacío (ej. recarga de página)
  useEffect(() => {
    if (!roomId) return;
    if (game?.roomId === roomId) return;

    (async () => {
      const { fetchGameState } = await import('@/supabase/queries');
      const state = await fetchGameState(roomId);
      if (state) initOnlineGame(state as never);
      else router.push('/home');
    })();
  }, [roomId]);

  // Online: suscribirse a cambios de estado en tiempo real
  useEffect(() => {
    if (!roomId) return;

    (async () => {
      const { subscribeToGame, unsubscribe } = await import('@/supabase/realtime');
      channelRef.current = subscribeToGame(roomId, {
        onStateUpdate: (payload) => {
          const row = payload as { state: unknown };
          if (row?.state) syncFromServer(row.state);
        },
      });
    })();

    return () => {
      if (channelRef.current) {
        import('@/supabase/realtime').then(({ unsubscribe }) => {
          if (channelRef.current) unsubscribe(channelRef.current);
        });
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (!game) {
      if (!roomId) router.push('/home');
      return;
    }
    if (game.phase === 'game_over') {
      router.push(`/results?w=${game.winner}&a=${game.teamScores[0]}&b=${game.teamScores[1]}`);
    }
  }, [game?.phase]);

  if (!game) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Cargando partida...</p>
    </div>
  );

  const myId = mode.startsWith('online') ? (profile?.id ?? 'human') : 'human';

  return <GameTable myId={myId} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  );
}
