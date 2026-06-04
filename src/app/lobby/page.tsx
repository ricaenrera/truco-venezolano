'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { createRoom, fetchRoomByCode, joinRoom } from '@/supabase/queries';

function LobbyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get('mode') ?? 'online_2p') as 'online_2p' | 'online_4p';
  const { profile } = useAuthStore();
  const [joinCode, setJoinCode] = useState('');
  const [maxPoints, setMaxPoints] = useState<12 | 24>(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (visibility: 'public' | 'private') => {
    if (!profile) return;
    setLoading(true); setError('');
    const room = await createRoom(profile.id, mode, maxPoints, visibility);
    if (!room) { setError('No se pudo crear la sala'); setLoading(false); return; }
    await joinRoom(room.id, profile.id, 0);
    router.push(`/lobby/${room.code}`);
  };

  const handleJoin = async () => {
    if (!profile || !joinCode.trim()) return;
    setLoading(true); setError('');
    const room = await fetchRoomByCode(joinCode.trim());
    if (!room) { setError('Sala no encontrada'); setLoading(false); return; }
    const pos = room.players.length as 0 | 1 | 2 | 3;
    await joinRoom(room.id, profile.id, pos);
    router.push(`/lobby/${room.code}`);
  };

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 pt-8 mb-8">
        <button onClick={() => router.push('/home')} className="text-primary text-xl">‹</button>
        <h1 className="text-xl font-bold">{mode === 'online_2p' ? '1 vs 1 Online' : '2 vs 2 Online'}</h1>
      </div>

      {/* Points */}
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Puntos de partida</p>
      <div className="flex gap-3 mb-6">
        {([12, 24] as const).map((pts) => (
          <button key={pts} onClick={() => setMaxPoints(pts)}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${maxPoints === pts ? 'bg-primary text-black' : 'bg-[#1e2d20] text-gray-300 hover:bg-[#2a3d2c]'}`}>
            {pts} puntos
          </button>
        ))}
      </div>

      <button onClick={() => handleCreate('public')} disabled={loading}
        className="w-full py-4 rounded-xl bg-primary text-black font-bold text-base mb-3 hover:bg-green-400 disabled:opacity-50 transition-colors">
        ⚡ Crear sala pública
      </button>

      <button onClick={() => handleCreate('private')} disabled={loading}
        className="w-full py-4 rounded-xl bg-[#1e2d20] border border-[#2a3d2c] font-bold text-base mb-6 hover:bg-[#2a3d2c] disabled:opacity-50 transition-colors">
        🔒 Crear sala privada
      </button>

      <p className="text-center text-gray-500 text-sm mb-6">— o únete con código —</p>

      <div className="flex gap-2">
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Código de sala" maxLength={6}
          className="flex-1 bg-[#1e2d20] border border-[#2a3d2c] rounded-xl px-4 py-3 text-white uppercase tracking-widest focus:outline-none focus:border-primary" />
        <button onClick={handleJoin} disabled={loading || !joinCode}
          className="px-5 py-3 rounded-xl bg-[#2a3d2c] font-semibold hover:bg-[#3a4d3c] disabled:opacity-50 transition-colors">
          Unirse
        </button>
      </div>

      {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
    </main>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={null}>
      <LobbyContent />
    </Suspense>
  );
}
