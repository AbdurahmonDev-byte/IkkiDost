import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, User, X } from 'lucide-react';
import { api } from '../lib/api';
import { tg } from '../lib/telegram';
import type { StaffUser } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: StaffUser) => void;
}

export const StaffLoginModal: React.FC<Props> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (u = username, p = password) => {
    if (!u.trim() || !p.trim()) {
      setError('Login va parolni kiriting');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.login(u.trim(), p.trim());
      tg.hapticSuccess();
      onLoginSuccess({
        ...res.user,
        accessToken: res.accessToken,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Login yoki parol noto‘g‘ri');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleLogin(u, p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-800">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">Xodimlar uchun kirish</h3>
              <p className="text-xs text-stone-500">Oshpaz, ofitsiant yoki egasi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="pt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Login</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Login"
                className="w-full rounded-2xl border border-stone-200 pl-10 pr-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Parol</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parol"
                className="w-full rounded-2xl border border-stone-200 pl-10 pr-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <button
            onClick={() => handleLogin()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 text-sm font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Tizimga kirish'}
          </button>

          {/* Quick login helpers */}
          <div className="pt-2 border-t border-stone-100">
            <span className="block text-[11px] font-medium text-stone-400 mb-2">Tezkor kirish:</span>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('oshpaz', 'password123')}
                className="rounded-xl bg-orange-50 border border-orange-200/80 px-2.5 py-2 font-bold text-orange-800 hover:bg-orange-100 active:scale-95 transition-all text-center"
              >
                👨‍🍳 Oshpaz
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('ofitsiant', 'password123')}
                className="rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-2 font-bold text-amber-800 hover:bg-amber-100 active:scale-95 transition-all text-center"
              >
                🤵 Ofitsiant
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('owner', 'owner12345')}
                className="rounded-xl bg-purple-50 border border-purple-200/80 px-2.5 py-2 font-bold text-purple-800 hover:bg-purple-100 active:scale-95 transition-all text-center"
              >
                👑 Egasi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
