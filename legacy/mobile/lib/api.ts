import { ApiClient, ApiClientError } from '@ikki-dost/api-client';
import type { AuthTokens } from '@ikki-dost/shared-types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from './auth';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
const fallback =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';

/** API base URL. Override with EXPO_PUBLIC_API_URL (real devices need a LAN IP). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || fallback).replace(/\/$/, '');

/** Socket.IO server origin (the API URL minus the `/api` prefix). */
export const SOCKET_URL = API_URL.replace(/\/api$/, '');

let refreshing: Promise<boolean> | null = null;

/**
 * Refresh the access token once, sharing the in-flight promise across all
 * concurrent 401 responses. Uses raw fetch to avoid recursive retries.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const token = useAuth.getState().refreshToken;
  if (!token) return Promise.resolve(false);

  refreshing = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) {
        useAuth.getState().clear();
        return false;
      }
      const tokens = (await res.json()) as AuthTokens;
      useAuth.getState().setTokens(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

const raw = new ApiClient({
  baseUrl: API_URL,
  getAccessToken: () => useAuth.getState().accessToken,
});

/**
 * Shared API client with transparent token refresh: a request that fails with
 * 401 refreshes the session once and is retried.
 */
export const api = new Proxy(raw, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== 'function') return value;
    return async (...args: unknown[]) => {
      try {
        return await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
      } catch (error) {
        const isAuthCall = prop === 'login' || prop === 'refresh' || prop === 'logout';
        if (error instanceof ApiClientError && error.statusCode === 401 && !isAuthCall) {
          const ok = await refreshSession();
          if (ok) {
            return await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
          }
        }
        throw error;
      }
    };
  },
}) as ApiClient;

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Kutilmagan xatolik yuz berdi';
}

export { ApiClientError };
