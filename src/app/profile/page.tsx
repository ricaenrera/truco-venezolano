'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const AVATARS = ['🦁','🐯','🦊','🐺','🦅','🦋','🐬','🦈','🎭','👑','🌟','🔥'];
const COLORS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#795548','#607d8b','#00bcd4','#8bc34a'];

export default function ProfilePage() {
  const router = useRouter();
  const { profile, updateUsername, updateAvatar, loading } = useAuthStore();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) return;
    const ok = await updateUsername(username.trim());
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-8 mb-8">
        <button onClick={() => router.push('/home')} className="text-primary text-xl">‹</button>
        <h1 className="text-xl font-bold">Mi perfil</h1>
      </div>

      {/* Current avatar */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{ backgroundColor: COLORS[(profile?.avatarId ?? 0) % COLORS.length] }}>
          {AVATARS[(profile?.avatarId ?? 0) % AVATARS.length]}
        </div>
      </div>

      {/* Avatar picker */}
      <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">Elige tu avatar</h2>
      <div className="grid grid-cols-6 gap-2 mb-6">
        {AVATARS.map((emoji, i) => (
          <button key={i} onClick={() => updateAvatar(i)}
            className={`w-full aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${profile?.avatarId === i ? 'ring-2 ring-primary scale-110' : 'hover:scale-105'}`}
            style={{ backgroundColor: COLORS[i] }}>
            {emoji}
          </button>
        ))}
      </div>

      {/* Username */}
      <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">Apodo</h2>
      <div className="flex gap-2 mb-8">
        <input value={username} onChange={(e) => setUsername(e.target.value)}
          className="flex-1 bg-[#1e2d20] border border-[#2a3d2c] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
          placeholder="Tu apodo" />
        <button onClick={handleSave} disabled={loading}
          className="px-5 py-3 rounded-lg bg-primary text-black font-semibold hover:bg-green-400 disabled:opacity-50 transition-colors">
          {saved ? '✓' : 'Guardar'}
        </button>
      </div>

      {/* Stats */}
      <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">Estadísticas</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Partidas', value: profile?.gamesPlayed ?? 0, color: 'text-white' },
          { label: 'Ganadas', value: profile?.gamesWon ?? 0, color: 'text-green-400' },
          { label: 'Perdidas', value: profile?.gamesLost ?? 0, color: 'text-red-400' },
          { label: 'Racha 🔥', value: profile?.currentStreak ?? 0, color: 'text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#1e2d20] border border-[#2a3d2c] rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
