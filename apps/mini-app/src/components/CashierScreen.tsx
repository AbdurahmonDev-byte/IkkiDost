import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Loader2, Phone, RefreshCw, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { tg } from '../lib/telegram';
import type { DeliveryDto } from '../lib/types';

interface Props {
  token: string;
}

/** Cashier/owner confirms couriers handed the collected cash over. */
export const CashierScreen: React.FC<Props> = ({ token }) => {
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getDeliveries(token);
      setDeliveries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ma’lumotlarni yuklab bo‘lmadi');
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

  const confirm = async (d: DeliveryDto) => {
    setActingId(d.id);
    setError(null);
    try {
      const updated = await api.handoverDeliveryCash(token, d.id);
      setDeliveries((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      tg.hapticSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To‘lovni tasdiqlab bo‘lmadi');
    } finally {
      setActingId(null);
    }
  };

  const pending = deliveries.filter(
    (d) => d.status === 'DELIVERED' && (d.cashCollectedAmount ?? 0) > 0 && !d.cashHandedOverAt,
  );
  const recent = deliveries.filter((d) => d.cashHandedOverAt).slice(0, 5);
  const pendingTotal = pending.reduce((sum, d) => sum + (d.cashCollectedAmount ?? 0), 0);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight">Kassa · naqd pul</h2>
            <p className="text-xs text-emerald-100">
              {pending.length} ta kutilmoqda · {money(pendingTotal)}
            </p>
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

      {loading && pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">Yuklanmoqda...</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-4 py-14 text-center">
          <Banknote className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 text-sm font-bold text-stone-600">Topshirilishi kutilayotgan pul yo‘q</p>
          <p className="mt-1 text-xs text-stone-400">
            Kuryer «yetkazildi» qilganda naqd pul shu yerda paydo bo‘ladi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((d) => (
            <div
              key={d.id}
              className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-stone-900">Buyurtma #{d.orderNumber}</p>
                  <p className="text-[11px] text-stone-500">{d.customerName}</p>
                </div>
                <p className="text-base font-black text-emerald-700">
                  {money(d.cashCollectedAmount ?? 0)}
                </p>
              </div>
              <div className="space-y-2 p-4">
                <p className="text-xs text-stone-500">{d.address}</p>
                <a
                  href={`tel:${d.customerPhone}`}
                  className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800"
                >
                  <Phone className="h-3.5 w-3.5" /> {d.customerPhone}
                </a>
                <p className="text-xs text-stone-500">
                  Kuryer: <span className="font-bold text-stone-800">{d.assignedToName || '—'}</span>
                </p>
                <div className="flex justify-between rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
                  <span>Qoldiq</span>
                  <span className="font-bold text-stone-900">{money(d.outstandingAmount)}</span>
                </div>
                <button
                  onClick={() => confirm(d)}
                  disabled={actingId === d.id}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {actingId === d.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  To‘lov qilindi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-black uppercase tracking-wider text-stone-400">
            Qabul qilingan
          </h3>
          <div className="space-y-2">
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-bold text-stone-900">#{d.orderNumber} · {d.customerName}</p>
                  <p className="text-[11px] text-stone-400">
                    {d.cashHandedOverAt
                      ? new Date(d.cashHandedOverAt).toLocaleString('uz-UZ')
                      : ''}
                  </p>
                </div>
                <p className="font-black text-emerald-700">{money(d.cashCollectedAmount ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
