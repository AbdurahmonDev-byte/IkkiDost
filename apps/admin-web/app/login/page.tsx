'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gauge, Loader2 } from 'lucide-react';
import { api, useAuth } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const setSession = useAuth((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && user?.role === 'OWNER') router.replace('/dashboard');
  }, [hydrated, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ username: username.trim(), password });
      if (res.user.role !== 'OWNER') {
        setError('Bu panel faqat ega uchun');
        return;
      }
      setSession({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70 md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-primary p-8 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Gauge size={22} />
            </div>
            <div>
              <p className="font-bold leading-tight">Ikki Do‘st</p>
              <p className="text-xs text-white/70">choyxonasi</p>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-snug">Butun restoran bir joyda.</h1>
            <p className="mt-2 text-sm text-white/70">
              Buyurtmalar, xonalar, moliya, xodimlar va hisobotlar — real vaqtda.
            </p>
          </div>
          <p className="text-[11px] text-white/50">© {new Date().getFullYear()} Ikki Do‘st</p>
        </div>

        <div className="p-8 sm:p-10">
          <h2 className="text-xl font-semibold">Tizimga kirish</h2>
          <p className="mt-1 text-sm text-ink-soft">Ega hisobi bilan kiring.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Login
              </label>
              <input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Parol
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>

            {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Kirish
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
