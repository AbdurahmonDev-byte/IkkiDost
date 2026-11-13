import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
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
      <div
        key={d.id}
        className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-3">
          <div>
            <p className="text-sm font-black text-stone-900">Buyurtma #{d.orderNumber}</p>
            <p className="text-[11px] text-stone-500">{d.items.length} ta mahsulot</p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${deliveryStatusColor[d.status]}`}
          >
            {deliveryStatusLabel[d.status]}
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-stone-900">{d.customerName}</p>
              <p className="text-xs text-stone-500">{d.address}</p>
            </div>
          </div>

          <a
            href={`tel:${d.customerPhone}`}
            className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800"
          >
            <Phone className="h-3.5 w-3.5" /> {d.customerPhone}
          </a>

          <div className="space-y-1 rounded-2xl bg-stone-50 p-3 text-xs text-stone-600">
            {d.items.slice(0, 4).map((i) => (
              <div key={i.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {i.productName} × {qty(i.quantity, i.productUnit)}
                </span>
                <span className="shrink-0 font-semibold text-stone-800">{money(i.lineTotal)}</span>
              </div>
            ))}
            {d.items.length > 4 && (
              <p className="text-[11px] text-stone-400">+{d.items.length - 4} ta yana</p>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-1 font-bold text-stone-900">
              <span>Jami</span>
              <span>{money(d.totalAmount)}</span>
            </div>
            {d.paidAmount > 0 && (
              <div className="flex justify-between text-[11px] text-emerald-700">
                <span>To‘langan</span>
                <span>{money(d.paidAmount)}</span>
              </div>
            )}
            {d.outstandingAmount > 0 && (
              <div className="flex justify-between text-[11px] font-semibold text-amber-700">
                <span>Qoldiq</span>
                <span>{money(d.outstandingAmount)}</span>
              </div>
            )}
            {d.cashCollectedAmount != null && (
              <div className="flex justify-between text-[11px] text-stone-600">
                <span>Naqd (kuryer)</span>
                <span>
                  {money(d.cashCollectedAmount)}
                  {d.cashHandedOverAt ? ' ✅ kassada' : ' ⏳'}
                </span>
              </div>
            )}
          </div>

          {d.note && <p className="text-xs italic text-stone-500">✍️ {d.note}</p>}

          <div className="flex flex-wrap gap-2">
            {claimable && (
              <button
                onClick={() => claim(d)}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand-600 py-2.5 text-xs font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Qabul qilish
              </button>
            )}
            {!claimable && mine && d.status === 'READY' && (
              <button
                onClick={() => advance(d, 'OUT_FOR_DELIVERY')}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Yo‘lga chiqdim
              </button>
            )}
            {!claimable && mine && d.status === 'OUT_FOR_DELIVERY' && (
              <button
                onClick={() => openCash(d)}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Yetkazildi
              </button>
            )}
            {!claimable && !mine && d.assignedToId && (
              <p className="text-[11px] text-stone-400">{d.assignedToName || 'Boshqa kuryerga'} biriktirilgan</p>
            )}
          </div>

          {cashFor?.id === d.id && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-black text-emerald-900">Mijozdan olingan naqd pul</p>
              <p className="mb-2 text-[11px] text-emerald-700">
                Qoldiq: {money(d.outstandingAmount)} · kamida 0, ko‘pi bilan qoldiq
              </p>
              <input
                type="number"
                min={0}
                max={d.outstandingAmount}
                inputMode="numeric"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-stone-900 outline-none focus:border-emerald-500"
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
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Tasdiqlash
                </button>
                <button
                  onClick={() => advance(d, 'DELIVERED', 0)}
                  disabled={busy}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-800 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  Naqdsiz
                </button>
                <button
                  onClick={() => setCashFor(null)}
                  className="rounded-xl px-3 py-2 text-xs font-bold text-stone-500"
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
      <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight">Yetkazib berish</h2>
            <p className="text-xs text-slate-300">{active.length} ta faol buyurtma</p>
          </div>
        </div>
        <button
          onClick={() => fetchDeliveries()}
          className="rounded-2xl bg-white/10 p-2.5 active:scale-95 transition-all"
          title="Yangilash"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && active.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">Yuklanmoqda...</p>
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-4 py-14 text-center">
          <Truck className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 text-sm font-bold text-stone-600">Hozircha faol yetkazish yo‘q</p>
          <p className="mt-1 text-xs text-stone-400">Yangi buyurtmalar avtomatik paydo bo‘ladi.</p>
        </div>
      ) : (
        <div className="space-y-3">{active.map(renderCard)}</div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-black uppercase tracking-wider text-stone-400">
            Yakunlangan
          </h3>
          <div className="space-y-3 opacity-80">{done.map(renderCard)}</div>
        </div>
      )}
    </div>
  );
};
