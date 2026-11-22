import { ApiClient } from '@ikki-dost/api-client';
import type { AuthUser } from '@ikki-dost/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
/** Optional shared key embedded at build time (GitHub secret CASHIER_KIOSK_KEY). */
const KIOSK_KEY: string = import.meta.env.VITE_KIOSK_KEY || '';
export const TOKENS_REFRESHED = 'ikki:tokens-refreshed';
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
/** Product photos are stored as `/uploads/...` on the API host. */
export const assetUrl = (path: string | null | undefined) =>
  !path ? null : /^https?:/.test(path) ? path : `${SOCKET_URL}${path.startsWith('/') ? '' : '/'}${path}`;

/** The terminal always runs as the dedicated `kassa` account — no login screen. */
export const KIOSK_USERNAME = 'kassa';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (s: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'ikki-cashier-auth' },
  ),
);

/** Opens a kiosk session. Throws with the server's message when refused. */
export async function kioskLogin(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/kiosk`, {
    method: 'POST',
    headers: KIOSK_KEY ? { 'x-kiosk-key': KIOSK_KEY } : {},
  });
  if (!res.ok) {
    let message = `Server javobi: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON body
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { user: AuthUser; accessToken: string; refreshToken: string };
  useAuth.getState().setSession(data);
}

async function tryRefresh(): Promise<boolean> {
  const state = useAuth.getState();
  if (state.refreshToken) {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: state.refreshToken }),
      });
      if (res.ok) {
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        useAuth.getState().setTokens(data.accessToken, data.refreshToken);
        return true;
      }
    } catch {
      // network error — fall through to a fresh kiosk session
    }
  }
  try {
    await kioskLogin();
    return true;
  } catch {
    return false;
  }
}

let refreshing: Promise<boolean> | null = null;

export const api = new ApiClient({
  baseUrl: API_URL,
  getAccessToken: () => useAuth.getState().accessToken,
  onUnauthorized: () => {
    refreshing ??= tryRefresh().finally(() => {
      refreshing = null;
    });
    void refreshing.then((ok) => {
      // The failed request is not retried by the client; screens refetch.
      if (ok) window.dispatchEvent(new Event(TOKENS_REFRESHED));
    });
  },
});
