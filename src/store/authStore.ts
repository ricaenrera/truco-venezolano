'use client';
import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { fetchProfile, updateProfile } from '../supabase/queries';
import type { UserProfile } from '../game/types';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, username: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateUsername: (username: string) => Promise<boolean>;
  updateAvatar: (avatarId: number) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  error: null,

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { set({ loading: false, error: error.message }); return false; }
    set({ user: { id: data.user.id, email: data.user.email! } });
    await get().loadProfile();
    set({ loading: false });
    return true;
  },

  signUp: async (email, password, username) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { username } },
    });
    if (error) { set({ loading: false, error: error.message }); return false; }
    if (data.user) {
      set({ user: { id: data.user.id, email: data.user.email! } });
      await get().loadProfile();
    }
    set({ loading: false });
    return true;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await fetchProfile(user.id);
    set({ profile });
  },

  updateUsername: async (username) => {
    const { user } = get();
    if (!user) return false;
    const ok = await updateProfile(user.id, { username });
    if (ok) await get().loadProfile();
    return ok;
  },

  updateAvatar: async (avatarId) => {
    const { user } = get();
    if (!user) return false;
    const ok = await updateProfile(user.id, { avatar_id: avatarId });
    if (ok) await get().loadProfile();
    return ok;
  },

  clearError: () => set({ error: null }),
}));

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    const u = data.session.user;
    useAuthStore.setState({ user: { id: u.id, email: u.email! } });
    const profile = await fetchProfile(u.id);
    useAuthStore.setState({ profile });
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const u = session.user;
      useAuthStore.setState({ user: { id: u.id, email: u.email! } });
      const profile = await fetchProfile(u.id);
      useAuthStore.setState({ profile });
    } else {
      useAuthStore.setState({ user: null, profile: null });
    }
  });
}
