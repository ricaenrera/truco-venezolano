'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function LoginForm() {
  const router = useRouter();
  const { signIn, signUp, loading, error, clearError } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (isRegister) {
      const ok = await signUp(email.trim().toLowerCase(), password, username.trim());
      if (ok) router.push('/home');
    } else {
      const ok = await signIn(email.trim().toLowerCase(), password);
      if (ok) router.push('/home');
    }
  };

  return (
    <div className="bg-[#1e2d20] border border-[#2a3d2c] rounded-2xl p-8">
      <h2 className="text-xl font-semibold mb-6 text-center">
        {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Apodo</label>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="TucasDelTruco" required
              className="w-full bg-[#0f1a12] border border-[#2a3d2c] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Correo electrónico</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com" required
            className="w-full bg-[#0f1a12] border border-[#2a3d2c] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Contraseña</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required minLength={6}
            className="w-full bg-[#0f1a12] border border-[#2a3d2c] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-primary text-black font-bold text-base hover:bg-green-400 disabled:opacity-50 transition-colors mt-2"
        >
          {loading ? 'Cargando...' : isRegister ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>

      <button
        onClick={() => { setIsRegister(!isRegister); clearError(); }}
        className="w-full text-center text-sm text-primary hover:text-green-400 mt-4 transition-colors"
      >
        {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
      </button>
    </div>
  );
}
