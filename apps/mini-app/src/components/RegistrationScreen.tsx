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
      <div className="mx-auto max-w-md space-y-4 pb-24 pt-4 animate-rise">
        <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#8a4f27] via-brand-600 to-[#5b331b] p-5 text-white shadow-[0_26px_60px_-34px_rgba(91,51,27,0.95)]">
          <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
          <div className="relative">
            <span className="chip bg-white/15 text-white backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> Oxirgi qadam
            </span>
            <h2 className="mt-3 text-[24px] font-black leading-tight tracking-tight">
              Telefon raqamni tasdiqlang
            </h2>
            <p className="mt-1.5 max-w-[300px] text-[12px] leading-relaxed text-brand-100/90">
              Xavfsizlik uchun raqam Telegram orqali tasdiqlanadi. Tasdiqlangach uydan buyurtma
              berish ochiladi.
            </p>
          </div>
        </div>

        <div className="surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-600/25">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-stone-900">{customer.fullName}</p>
              <p className="text-[11.5px] font-medium text-stone-500">{customer.phone}</p>
            </div>
          </div>

          <div className="surface-inset mt-3.5 space-y-2 p-3.5 text-[11.5px] text-stone-600">
            {[
              'Pastdagi tugma orqali botni oching.',
              'Botdagi «Telefon raqamni yuborish» tugmasini bosing.',
              'Bu ekranga qaytib «Tekshirish»ni bosing.',
            ].map((step, index) => (
              <p key={step} className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-black text-brand-700">
                  {index + 1}
                </span>
                <span>{step}</span>
              </p>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-3.5 grid gap-2">
            <button
              onClick={openBot}
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25"
            >
              <Bot className="h-4 w-4" /> Telegram botni ochish
            </button>
            <button onClick={checkVerification} disabled={checking} className="btn-secondary disabled:opacity-50">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Tasdiqlanganini tekshirish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-24 pt-4 animate-rise">
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#8a4f27] via-brand-600 to-[#5b331b] p-5 text-white shadow-[0_26px_60px_-34px_rgba(91,51,27,0.95)]">
        <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        <div className="relative">
          <span className="chip bg-white/15 text-white backdrop-blur">
            <BadgeCheck className="h-3 w-3" /> Bir marta ro‘yxatdan o‘tish
          </span>
          <h2 className="mt-3 text-[24px] font-black leading-tight tracking-tight">Xush kelibsiz!</h2>
          <p className="mt-1.5 max-w-[300px] text-[12px] leading-relaxed text-brand-100/90">
            Ism, familiya va telefon raqamingizni kiriting. Rasmiy ismingiz Telegram profilidagi
            ism o‘rnida ko‘rsatiladi.
          </p>
        </div>
      </div>

      {sent ? (
        <div className="surface flex flex-col items-center p-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <h3 className="mt-3 text-lg font-black text-stone-900">Ariza yuborildi</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-stone-500">
            Botga tasdiqlash xabari yuborildi. Raqamni tasdiqlab, «Tekshirish»ni bosing.
          </p>
          <button
            onClick={openBot}
            className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25"
          >
            <Bot className="h-4 w-4" /> Botni ochish
          </button>
          <button onClick={checkVerification} disabled={checking} className="btn-secondary mt-2 w-full disabled:opacity-50">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Tasdiqlanganini tekshirish
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="surface space-y-3.5 p-4">
          <label className="block">
            <span className="label-mini">Ism</span>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3.5 py-3 transition-colors focus-within:border-brand-400 focus-within:bg-white">
              <User className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ismingiz"
                autoComplete="given-name"
                className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </label>

          <label className="block">
            <span className="label-mini">Familiya</span>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3.5 py-3 transition-colors focus-within:border-brand-400 focus-within:bg-white">
              <User className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Familiyangiz"
                autoComplete="family-name"
                className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </label>

          <label className="block">
            <span className="label-mini">Telefon raqam</span>
            <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3.5 py-3 transition-colors focus-within:border-brand-400 focus-within:bg-white">
              <Phone className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                autoComplete="tel"
                className="w-full bg-transparent text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
            <p className="mt-1 px-1 text-[10.5px] font-medium text-stone-400">
              Raqam Telegram orqali tasdiqlanadi — SMS talab qilinmaydi.
            </p>
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? 'Yuborilmoqda...' : 'Ro‘yxatdan o‘tish'}
          </button>
        </form>
      )}
    </div>
  );
};
