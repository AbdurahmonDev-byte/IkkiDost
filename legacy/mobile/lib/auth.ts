import type { AuthTokens, AuthUser } from '@ikki-dost/shared-types';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (session: { user: AuthUser; tokens: AuthTokens }) => void;
  setTokens: (tokens: AuthTokens) => void;
  clear: () => void;
  markHydrated: () => void;
}

/**
 * SecureStore does not exist on web. The fallback keeps the app usable in a
 * browser during development while mobile builds always use the keychain.
 */
const storage = createJSONStorage(() =>
  Platform.OS === 'web'
    ? {
        getItem: (name: string) => Promise.resolve(window.localStorage.getItem(name)),
        setItem: (name: string, value: string) => {
          window.localStorage.setItem(name, value);
          return Promise.resolve();
        },
        removeItem: (name: string) => {
          window.localStorage.removeItem(name);
          return Promise.resolve();
        },
      }
    : {
        getItem: (name: string) => SecureStore.getItemAsync(name),
        setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
        removeItem: (name: string) => SecureStore.deleteItemAsync(name),
      },
);

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: ({ user, tokens }) =>
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'ikki-dost-auth',
      storage,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

/** Roles allowed to use the mobile app. */
export const MOBILE_ROLES = ['OWNER', 'WAITER'] as const;

export function isMobileRole(role: string | undefined | null): boolean {
  return role === 'OWNER' || role === 'WAITER';
}

/**
 * True once persisted credentials have been read from the keychain. Both the
 * hydration callback and zustand's own persisted-state API are consulted so a
 * cold start never flashes the login screen for a signed-in user.
 */
export function useAuthReady(): boolean {
  const hydrated = useAuth((s) => s.hydrated);
  const persisted = useAuth.persist;
  const [finished, setFinished] = useState(() => persisted?.hasHydrated?.() ?? false);

  useEffect(() => {
    if (finished) return;
    if (persisted.hasHydrated()) {
      setFinished(true);
      return;
    }
    return persisted.onFinishHydration(() => setFinished(true));
  }, [finished, persisted]);

  return finished || hydrated;
}
