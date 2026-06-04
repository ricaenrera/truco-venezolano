'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useGameStore } from '@/store/gameStore';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { initLocalGame } = useGameStore();

  useEffect(() => {
    if (!profile && typeof window !== 'undefined') {
      const check = async () => {
        const { initAuth } = await import('@/store/authStore');
        await initAuth();
      };
      check();
    }
  }, [profile]);

  const startLocal = (mode: 'local_2p' | 'local_4p', maxPoints: 12 | 24) => {
    initLocalGame(mode, maxPoints, profile?.username ?? 'Tú');
    router.push(`/game?mode=${mode}&pts=${maxPoints}`);
  };

  const LOCAL_MODES = [
    { icon: '👤', title: '1 vs 1 (con IA)', desc: 'Tú solo contra un bot', mode: 'local_2p' as const },
    { icon: '👥', title: '2 vs 2 (con IA)', desc: 'Tú y un compañero bot vs 2 bots', mode: 'local_4p' as const },
  ];

  const ONLINE_MODES = [
    { icon: '🌐', title: '1 vs 1 Online', desc: 'Juega contra otra persona', mode: 'online_2p' as const },
    { icon: '🏆', title: '2 vs 2 Online', desc: 'Equipos de 2 jugadores reales', mode: 'online_4p' as const },
  ];

  return (
    <main className="min-h-screen p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-8 pb-6 border-b border-[#1e2d20]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-lg font-bold text-black">
            {profile?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold">{profile?.username ?? 'Jugador'}</p>
            <p className="text-xs text-gray-400">
              {profile?.gamesWon ?? 0}G · {profile?.gamesLost ?? 0}D · {profile?.currentStreak ?? 0}🔥
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/profile')} className="px-3 py-2 rounded-lg bg-[#1e2d20] text-sm hover:bg-[#2a3d2c] transition-colors">
            ⚙️ Perfil
          </button>
          <button onClick={signOut} className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
            Salir
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-primary text-center mt-8 mb-2">🃏 Truco Venezolano</h1>
      <p className="text-center text-gray-400 text-sm mb-8">¿A cuántos puntos juegas?</p>

      {/* Modos locales */}
      {LOCAL_MODES.map((m) => (
        <div key={m.mode} className="mb-3">
          <div className="bg-[#1e2d20] border border-[#2a3d2c] rounded-xl p-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-3xl">{m.icon}</span>
              <div>
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-gray-400">{m.desc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startLocal(m.mode, 12)}
                className="flex-1 py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold hover:bg-primary/30 transition-colors"
              >
                12 puntos
              </button>
              <button
                onClick={() => startLocal(m.mode, 24)}
                className="flex-1 py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold hover:bg-primary/30 transition-colors"
              >
                24 puntos
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Modos online */}
      {ONLINE_MODES.map((m) => (
        <div key={m.mode} className="mb-3">
          <button
            onClick={() => router.push(`/lobby?mode=${m.mode}`)}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1e2d20] border border-[#2a3d2c] hover:border-primary/50 hover:bg-[#2a3d2c] transition-all text-left"
          >
            <span className="text-3xl">{m.icon}</span>
            <div className="flex-1">
              <p className="font-semibold">{m.title}</p>
              <p className="text-sm text-gray-400">{m.desc}</p>
            </div>
            <span className="text-gray-500 text-xl">›</span>
          </button>
        </div>
      ))}
    </main>
  );
}
