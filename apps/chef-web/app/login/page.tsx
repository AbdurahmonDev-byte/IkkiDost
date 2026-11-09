'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Loader2 } from 'lucide-react';
import { api, useAuth } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ username: username.trim(), password });
      if (res.user.role !== 'CHEF' && res.user.role !== 'OWNER') {
        setError('Bu ilova faqat oshpaz va egasi uchun');
        return;
      }
      setSession({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 pb-safe pt-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-card">
            <ChefHat size={32} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Oshxona paneli</h1>
            <p className="mt-1 text-sm text-ink-soft">Ikki Do‘st choyxonasi</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5">
          <label className="block text-sm font-medium text-ink" htmlFor="username">
            Login
          </label>
          <input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            className="mt-1.5 h-12 w-full rounded-xl border border-neutral-200 bg-paper px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label className="mt-4 block text-sm font-medium text-ink" htmlFor="password">
            Parol
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1.5 h-12 w-full rounded-xl border border-neutral-200 bg-paper px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            Kirish
          </button>
        </form>
      </div>
    </main>
  );
}
