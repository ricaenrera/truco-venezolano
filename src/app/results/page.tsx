'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';

function ResultsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { game, reset, initLocalGame } = useGameStore();
  const { profile } = useAuthStore();

  const winnerTeam = parseInt(params.get('w') ?? '0') as 0 | 1;
  const scoreA = parseInt(params.get('a') ?? '0');
  const scoreB = parseInt(params.get('b') ?? '0');

  const myTeam = game?.players.find((p) => p.id === (profile?.id ?? 'human'))?.team ?? 0;
  const won = myTeam === winnerTeam;

  const handleRematch = () => {
    if (!game) return;
    const mode = game.mode;
    const maxPoints = game.maxPoints;
    reset();
    if (mode.startsWith('local')) {
      initLocalGame(mode as 'local_2p' | 'local_4p', maxPoints, profile?.username ?? 'Tú');
      router.push(`/game?mode=${mode}&pts=${maxPoints}`);
    } else {
      router.push(`/lobby?mode=${mode}`);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-8xl mb-4">{won ? '🏆' : '💀'}</div>
      <h1 className={`text-4xl font-bold mb-2 ${won ? 'text-primary' : 'text-red-400'}`}>
        {won ? '¡Ganaste!' : 'Perdiste'}
      </h1>
      <p className="text-gray-400 mb-8">{won ? '¡Bien jugado, figura!' : 'La próxima te va mejor'}</p>

      <div className="flex items-center gap-8 bg-[#1e2d20] border border-[#2a3d2c] rounded-2xl px-10 py-6 mb-8">
        <div className="text-center">
          <p className="text-5xl font-bold text-primary">{scoreA}</p>
          <p className="text-sm text-gray-400 mt-1">Equipo A</p>
        </div>
        <p className="text-3xl text-gray-500">–</p>
        <div className="text-center">
          <p className="text-5xl font-bold text-red-400">{scoreB}</p>
          <p className="text-sm text-gray-400 mt-1">Equipo B</p>
        </div>
      </div>

      <button onClick={handleRematch} className="w-full max-w-xs py-4 rounded-xl bg-primary text-black font-bold text-lg mb-3 hover:bg-green-400 transition-colors">
        🔄 Revancha
      </button>
      <button onClick={() => { reset(); router.push('/home'); }} className="text-gray-400 hover:text-white text-sm transition-colors py-2">
        Volver al inicio
      </button>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <ResultsContent />
    </Suspense>
  );
}
