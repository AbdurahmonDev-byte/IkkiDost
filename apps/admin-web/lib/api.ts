'use client';

import { ApiClient } from '@ikki-dost/api-client';
import type { AuthUser } from '@ikki-dost/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (s: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  setHydrated: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'ikki-admin-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const state = useAuth.getState();
  if (!state.refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: state.refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        useAuth.getState().setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export const api = new ApiClient({
  baseUrl: API_URL,
  getAccessToken: () => useAuth.getState().accessToken,
  onUnauthorized: () => {
    void tryRefresh().then((ok) => {
      if (!ok) {
        useAuth.getState().clear();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    });
  },
});
