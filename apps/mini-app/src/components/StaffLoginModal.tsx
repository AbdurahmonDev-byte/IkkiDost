import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Lock, ShieldCheck, Smartphone, Sparkles, User, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-[30px] bg-[#fffdfa] shadow-2xl animate-rise sm:rounded-[30px]">
        <div className="sheet-grabber sm:hidden" />

        <div className="relative overflow-hidden border-b border-stone-100 px-4 pb-4 pt-3">
          <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-brand-200/60 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="icon-tile bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-brand-500" />
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-600">
                    Xodimlar uchun
                  </p>
                </div>
                <h3 className="truncate text-[17px] font-black leading-tight text-stone-900">
                  {telegramAvailable ? 'Telegram ID orqali kirish' : 'Xodimlar kirishi'}
                </h3>
                <p className="truncate text-[11.5px] font-medium text-stone-500">
                  {telegramAvailable ? 'Telegram orqali avtomatik kirish' : 'Login va parol bilan'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="tap shrink-0 rounded-2xl border border-stone-200/80 bg-white p-2.5 text-stone-400 shadow-sm hover:text-stone-700"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {telegramAvailable ? (
          <div className="space-y-3 p-4">
            <div className="surface-soft space-y-2.5 p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Smartphone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-black text-stone-900">Parol kerak emas</p>
                  <p className="text-[10.5px] font-medium text-stone-500">
                    ID: {tg.user?.id ?? 'aniqlanmadi'}
                  </p>
                </div>
              </div>
              <p className="text-[11.5px] leading-relaxed text-stone-600">
                Agar ega sizning Telegram ID’ingizni ro‘yxatga biriktirgan bo‘lsa, ilova avtomatik
                kiradi. “Ega” tabini tanlaganda ega paneli ochiladi, qo‘shimcha parol so‘ralmaydi.
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full py-3.5">
              <ShieldCheck className="h-4 w-4" /> Tushundim
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCredentials();
            }}
            className="space-y-3 p-4 pb-safe"
          >
            <label className="block">
              <span className="label-mini">Login</span>
              <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3.5 py-3 transition-colors focus-within:border-brand-400 focus-within:bg-white">
                <User className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Loginingiz"
                  autoCapitalize="none"
                  autoComplete="username"
                  className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
                />
              </div>
            </label>

            <label className="block">
              <span className="label-mini">Parol</span>
              <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3.5 py-3 transition-colors focus-within:border-brand-400 focus-within:bg-white">
                <KeyRound className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
                />
              </div>
            </label>

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? 'Kirilmoqda...' : 'Kirish'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
