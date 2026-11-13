import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Loader2,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { api } from '../lib/api';
import { tg } from '../lib/telegram';
import type { Customer, PublicConfig } from '../lib/types';

interface Props {
  config: PublicConfig | null;
  customer: Customer | null;
  telegramName?: { firstName?: string; lastName?: string } | null;
  onRegistered: (customer: Customer) => void;
  onRefresh: () => Promise<void>;
}

export const RegistrationScreen: React.FC<Props> = ({
  config,
  customer,
  telegramName,
  onRegistered,
  onRefresh,
}) => {
  const [firstName, setFirstName] = useState(customer?.firstName || telegramName?.firstName || '');
  const [lastName, setLastName] = useState(customer?.lastName || telegramName?.lastName || '');
  const [phone, setPhone] = useState(customer?.phone || '+998');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const botUrl = config?.registrationUrl || 'https://t.me/ikkidostbot?start=register';

  const openBot = () => {
    tg.haptic('light');
    tg.openTelegram(botUrl);
  };

  const checkVerification = async () => {
    setChecking(true);
    setError(null);
    try {
      await onRefresh();
      tg.hapticSuccess();
    } catch {
      setError('Tekshirib bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setChecking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ism va familiyani kiriting');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Telefon raqamini to‘g‘ri kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.registerCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      onRegistered(res.customer);
      setSent(true);
      tg.hapticSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ro‘yxatdan o‘tib bo‘lmadi');
    } finally {
      setLoading(false);
    }
  };

  // Already registered but the phone is not confirmed yet.
  if (customer && !customer.phoneVerified) {
    return (
      <div className="mx-auto max-w-md space-y-4 pb-24 pt-6">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-xl shadow-brand-900/20">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
            <ShieldCheck className="h-4 w-4" /> Oxirgi qadam
          </div>
          <h2 className="mt-3 text-2xl font-black leading-tight">Telefon raqamni tasdiqlang</h2>
          <p className="mt-2 text-sm text-brand-100">
            Xavfsizlik uchun raqam Telegram orqali tasdiqlanadi. Tasdiqlangach uydan buyurtma
            berish ochiladi.
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-stone-900">{customer.fullName}</p>
              <p className="text-xs text-stone-500">{customer.phone}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-4 text-xs text-stone-600">
            <p className="flex items-start gap-2">
              <span className="font-black text-brand-700">1.</span>
              Pastdagi tugma orqali botni oching.
            </p>
            <p className="flex items-start gap-2">
              <span className="font-black text-brand-700">2.</span>
              Botdagi «Telefon raqamni yuborish» tugmasini bosing.
            </p>
            <p className="flex items-start gap-2">
              <span className="font-black text-brand-700">3.</span>
              Bu ekranga qaytib «Tekshirish»ni bosing.
            </p>
          </div>

          {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

          <div className="mt-4 grid gap-2">
            <button
              onClick={openBot}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
            >
              <Bot className="h-4 w-4" /> Telegram botni ochish
            </button>
            <button
              onClick={checkVerification}
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white py-3 text-sm font-bold text-stone-700 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Tasdiqlanganini tekshirish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-24 pt-6">
      <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-xl shadow-brand-900/20">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
          <BadgeCheck className="h-4 w-4" /> Bir marta ro‘yxatdan o‘tish
        </div>
        <h2 className="mt-3 text-2xl font-black leading-tight">Xush kelibsiz!</h2>
        <p className="mt-2 text-sm text-brand-100">
          Ism, familiya va telefon raqamingizni kiriting. Rasmiy ismingiz Telegram
          profilidagi ism o‘rnida ko‘rsatiladi.
        </p>
      </div>

      {sent ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h3 className="mt-2 text-lg font-black text-emerald-900">Ariza yuborildi</h3>
          <p className="mt-1 text-sm text-emerald-800">
            Botga tasdiqlash xabari yuborildi. Raqamni tasdiqlab, «Tekshirish»ni bosing.
          </p>
          <button
            onClick={openBot}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] py-3 text-sm font-bold text-white active:scale-[0.98] transition-all"
          >
            <Bot className="h-4 w-4" /> Botni ochish
          </button>
          <button
            onClick={checkVerification}
            disabled={checking}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white py-3 text-sm font-bold text-emerald-800 disabled:opacity-50 transition-all"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Tasdiqlanganini tekshirish
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-bold text-stone-600">Ism</label>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 focus-within:border-brand-400 focus-within:bg-white transition-colors">
              <User className="h-4 w-4 text-stone-400" />
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ismingiz"
                autoComplete="given-name"
                className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-stone-600">Familiya</label>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 focus-within:border-brand-400 focus-within:bg-white transition-colors">
              <User className="h-4 w-4 text-stone-400" />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Familiyangiz"
                autoComplete="family-name"
                className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-stone-600">Telefon raqam</label>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 focus-within:border-brand-400 focus-within:bg-white transition-colors">
              <Phone className="h-4 w-4 text-stone-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                autoComplete="tel"
                className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
            <p className="mt-1 text-[11px] text-stone-400">
              Raqam Telegram orqali tasdiqlanadi — SMS talab qilinmaydi.
            </p>
          </div>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
            {loading ? 'Yuborilmoqda...' : 'Ro‘yxatdan o‘tish'}
          </button>
        </form>
      )}
    </div>
  );
};
