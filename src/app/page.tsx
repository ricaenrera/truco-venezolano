'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initAuth, useAuthStore } from '@/store/authStore';
import LoginForm from '@/components/LoginForm';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (user) router.push('/home');
  }, [user, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🃏</div>
          <h1 className="text-4xl font-bold text-primary">Truco</h1>
          <p className="text-2xl font-light tracking-widest text-gray-400 mt-1">Venezolano</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
