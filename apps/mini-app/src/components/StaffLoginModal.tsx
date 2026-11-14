import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Lock, ShieldCheck, User, X } from 'lucide-react';
import { api } from '../lib/api';
import { tg } from '../lib/telegram';
import type { StaffUser } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: StaffUser) => void;
  telegramAvailable?: boolean;
}

export const StaffLoginModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  telegramAvailable = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const finish = (res: { accessToken: string; refreshToken?: string; user: Omit<StaffUser, 'accessToken'> }) => {
    tg.hapticSuccess();
    onLoginSuccess({
      ...res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    });
    onClose();
  };

  const handleCredentials = async (u = username, p = password) => {
    if (!u.trim() || !p.trim()) {
      setError('Login va parolni kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(u.trim(), p.trim());
      finish(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kira olmadim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-900 px-4 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black">
                {telegramAvailable ? 'Telegram ID orqali kirish' : 'Xodimlar kirishi'}
              </h3>
              <p className="text-[11px] text-stone-400">
                {telegramAvailable ? 'Telegram orqali avtomatik kirish' : 'Login va parol'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-stone-400 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {telegramAvailable ? (
          <div className="space-y-3 p-4">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <p className="font-bold">Xodimlar parol bilan kirmaydi</p>
              <p className="mt-1 text-xs leading-relaxed">
                Telegram ID’ingiz: <strong>{tg.user?.id ?? 'aniqlanmadi'}</strong>. Agar ega sizning ID’ingizni
                ro‘yxatga biriktirgan bo‘lsa, ilova avtomatik kiradi. “Ega” tabini tanlaganda ega paneli
                ochiladi, qo‘shimcha parol so‘ralmaydi.
              </p>
            </div>
            <button type="button" onClick={onClose} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-bold text-white">
              Yopish
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCredentials();
            }}
            className="space-y-3 p-4"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 focus-within:border-brand-400 focus-within:bg-white">
              <User className="h-4 w-4 text-stone-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Login"
                autoCapitalize="none"
                autoComplete="username"
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 focus-within:border-brand-400 focus-within:bg-white">
              <KeyRound className="h-4 w-4 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parol"
                autoComplete="current-password"
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>

            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/25 disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? 'Kirilmoqda...' : 'Kirish'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
