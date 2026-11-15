import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  Truck,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  deliveryStatusColor,
  deliveryStatusLabel,
  isDeliveryActive,
  money,
  qty,
} from '../lib/format';
import { tg } from '../lib/telegram';
import type { DeliveryDto } from '../lib/types';
import { StaffHeader } from './StaffHeader';

interface Props {
  token: string;
  userId: string;
}

const CLAIMABLE: DeliveryDto['status'][] = ['CONFIRMED', 'PREPARING', 'READY'];

export const DeliveryScreen: React.FC<Props> = ({ token, userId }) => {
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cashFor, setCashFor] = useState<DeliveryDto | null>(null);
  const [cashAmount, setCashAmount] = useState('');

  const fetchDeliveries = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getDeliveries(token);
      setDeliveries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yetkazishlarni yuklab bo‘lmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    const timer = setInterval(() => fetchDeliveries(true), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const claim = async (d: DeliveryDto) => {
    setActingId(d.id);
    setError(null);
    try {
      const updated = await api.claimDelivery(token, d.id);
      setDeliveries((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      tg.hapticSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yetkazishni qabul qilib bo‘lmadi');
    } finally {
      setActingId(null);
    }
  };

  const advance = async (d: DeliveryDto, status: DeliveryDto['status'], cash?: number) => {
    setActingId(d.id);
    setError(null);
    try {
      const updated = await api.updateDeliveryStatus(token, d.id, status, cash);
      setDeliveries((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      setCashFor(null);
      tg.hapticSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Holatni o‘zgartirib bo‘lmadi');
    } finally {
      setActingId(null);
    }
  };

  const openCash = (d: DeliveryDto) => {
    setCashFor(d);
    setCashAmount(String(d.outstandingAmount));
  };

  const active = deliveries.filter((d) => isDeliveryActive(d.status));
  const done = deliveries.filter((d) => !isDeliveryActive(d.status)).slice(0, 6);

  const renderCard = (d: DeliveryDto) => {
    const mine = d.assignedToId === userId;
    const claimable = !d.assignedToId && CLAIMABLE.includes(d.status);
    const busy = actingId === d.id;

    return (
      <div key={d.id} className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-400/15 px-1.5 text-xs font-black text-sky-800 dark:text-sky-300">
              #{d.orderNumber}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black text-stone-900 dark:text-stone-100">Buyurtma</p>
              <p className="text-[10.5px] font-medium text-stone-500">{d.items.length} ta mahsulot</p>
            </div>
          </div>
          <span
            className={`chip shrink-0 border ${deliveryStatusColor[d.status]}`}
          >
            {deliveryStatusLabel[d.status]}
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-400/10 text-brand-600 dark:text-brand-300">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-black text-stone-900 dark:text-stone-100">{d.customerName}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-stone-500 dark:text-stone-400">{d.address}</p>
            </div>
          </div>

          <a
            href={`tel:${d.customerPhone}`}
            className="tap flex items-center gap-2 rounded-2xl bg-sky-50 dark:bg-sky-400/10 px-3 py-2.5 text-xs font-bold text-sky-800 dark:text-sky-300 ring-1 ring-sky-100"
          >
            <Phone className="h-3.5 w-3.5" /> {d.customerPhone}
          </a>

          <div className="surface-inset space-y-1.5 p-3 text-[11.5px] text-stone-600 dark:text-stone-300">
            {d.items.slice(0, 4).map((i) => (
              <div key={i.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {i.productName} × {qty(i.quantity, i.productUnit)}
                </span>
                <span className="shrink-0 font-semibold text-stone-800 dark:text-stone-200">{money(i.lineTotal)}</span>
              </div>
            ))}
            {d.items.length > 4 && (
              <p className="text-[10.5px] text-stone-500">+{d.items.length - 4} ta yana</p>
            )}
            <div className="flex justify-between border-t border-stone-200/70 dark:border-stone-800/70 pt-1.5 text-xs font-black text-stone-900 dark:text-stone-100">
              <span>Jami</span>
              <span>{money(d.totalAmount)}</span>
            </div>
            {d.paidAmount > 0 && (
              <div className="flex justify-between text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span>To‘langan</span>
                <span>{money(d.paidAmount)}</span>
              </div>
            )}
            {d.outstandingAmount > 0 && (
              <div className="flex justify-between text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
                <span>Qoldiq</span>
                <span>{money(d.outstandingAmount)}</span>
              </div>
            )}
            {d.cashCollectedAmount != null && (
              <div className="flex justify-between text-[10.5px] text-stone-600 dark:text-stone-300">
                <span>Naqd (kuryer)</span>
                <span>
                  {money(d.cashCollectedAmount)}
                  {d.cashHandedOverAt ? ' · kassada' : ' · kutilmoqda'}
                </span>
              </div>
            )}
          </div>

          {d.note && (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-400/10 px-3 py-2 text-[11px] italic text-amber-800 dark:text-amber-300">
              {d.note}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {claimable && (
              <button
                onClick={() => claim(d)}
                disabled={busy}
                className="btn-primary flex-1 py-2.5 text-xs"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Qabul qilish
              </button>
            )}
            {!claimable && mine && d.status === 'READY' && (
              <button
                onClick={() => advance(d, 'OUT_FOR_DELIVERY')}
                disabled={busy}
                className="btn-primary flex-1 py-2.5 text-xs"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Yo‘lga chiqdim
              </button>
            )}
            {!claimable && mine && d.status === 'OUT_FOR_DELIVERY' && (
              <button
                onClick={() => openCash(d)}
                disabled={busy}
                className="btn-primary flex-1 py-2.5 text-xs"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Yetkazildi
              </button>
            )}
            {!claimable && !mine && d.assignedToId && (
              <p className="text-[11px] font-medium text-stone-500">
                {d.assignedToName || 'Boshqa kuryerga'} biriktirilgan
              </p>
            )}
          </div>

          {cashFor?.id === d.id && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 p-3.5">
              <p className="text-xs font-black text-emerald-900 dark:text-emerald-300">Mijozdan olingan naqd pul</p>
              <p className="mb-2 text-[10.5px] text-emerald-700 dark:text-emerald-300">
                Qoldiq: {money(d.outstandingAmount)} · 0 dan qoldiqgacha kiriting
              </p>
              <input
                type="number"
                min={0}
                max={d.outstandingAmount}
                inputMode="numeric"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full rounded-xl border border-emerald-200 dark:border-emerald-400/25 bg-white dark:bg-stone-900 px-3 py-2.5 text-sm font-bold text-stone-900 dark:text-stone-100 outline-none focus:border-emerald-500"
                placeholder="0"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    advance(
                      d,
                      'DELIVERED',
                      Math.min(Number(cashAmount) || 0, d.outstandingAmount),
                    )
                  }
                  disabled={busy}
                  className="tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Tasdiqlash
                </button>
                <button
                  onClick={() => advance(d, 'DELIVERED', 0)}
                  disabled={busy}
                  className="tap rounded-xl bg-white dark:bg-stone-900 px-3 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 disabled:opacity-50"
                >
                  Naqdsiz
                </button>
                <button
                  onClick={() => setCashFor(null)}
                  className="tap rounded-xl px-3 py-2.5 text-xs font-bold text-stone-500 dark:text-stone-400"
                >
                  Bekor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      <StaffHeader
        icon={Truck}
        title="Yetkazib berish"
        subtitle={`${active.length} ta faol buyurtma · naqd pulni kiriting`}
        tone="sky"
        onRefresh={() => fetchDeliveries()}
        loading={loading}
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-400/25 bg-rose-50 dark:bg-rose-400/10 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading && active.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 py-16 text-stone-500">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <p className="text-xs font-semibold">Yuklanmoqda...</p>
        </div>
      ) : active.length === 0 ? (
        <div className="surface flex flex-col items-center px-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 dark:bg-sky-400/10">
            <Truck className="h-7 w-7 text-sky-400" />
          </div>
          <p className="mt-3 text-sm font-black text-stone-700 dark:text-stone-300">Hozircha faol yetkazish yo‘q</p>
          <p className="mt-1 text-xs text-stone-500">Yangi buyurtmalar avtomatik paydo bo‘ladi.</p>
        </div>
      ) : (
        <div className="space-y-3">{active.map(renderCard)}</div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <h3 className="section-kicker px-1">Yakunlangan</h3>
          <div className="space-y-3 opacity-80">{done.map(renderCard)}</div>
        </div>
      )}
    </div>
  );
};
