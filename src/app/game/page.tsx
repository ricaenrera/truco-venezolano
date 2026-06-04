'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import GameTable from '@/components/GameTable';

function GameContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { game, startNextHand } = useGameStore();
  const { profile } = useAuthStore();

  const mode = (params.get('mode') ?? 'local_2p') as 'local_2p' | 'local_4p' | 'online_2p' | 'online_4p';

  useEffect(() => {
    if (!game) { router.push('/home'); return; }
    if (game.phase === 'game_over') {
      router.push(`/results?w=${game.winner}&a=${game.teamScores[0]}&b=${game.teamScores[1]}`);
    }
  }, [game?.phase]);

  if (!game) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Cargando partida...</p>
    </div>
  );

  // Para juego local el jugador humano siempre tiene id 'human'
  // Para juego online usa el id real del perfil
  const myId = mode.startsWith('online') ? (profile?.id ?? 'human') : 'human';

  return <GameTable myId={myId} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Cargando...</p></div>}>
      <GameContent />
    </Suspense>
  );
}
