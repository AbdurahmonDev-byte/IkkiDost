import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Loader2, Phone, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { tg } from '../lib/telegram';
import type { DeliveryDto } from '../lib/types';
import { StaffHeader } from './StaffHeader';

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
      <StaffHeader
        icon={Wallet}
        title="Kassa · naqd pul"
        subtitle={`${pending.length} ta kutilmoqda · ${money(pendingTotal)}`}
        tone="emerald"
        onRefresh={() => fetchDeliveries()}
        loading={loading}
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && pending.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 py-16 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <p className="text-xs font-semibold">Yuklanmoqda...</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="surface flex flex-col items-center px-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50">
            <Banknote className="h-7 w-7 text-emerald-400" />
          </div>
          <p className="mt-3 text-sm font-black text-stone-700">
            Topshirilishi kutilayotgan pul yo‘q
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-400">
            Kuryer «yetkazildi» qilganda naqd pul shu yerda paydo bo‘ladi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((d) => (
            <div
              key={d.id}
              className="surface overflow-hidden ring-1 ring-emerald-200/70"
            >
              <div className="flex items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Banknote className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-stone-900">
                      Buyurtma #{d.orderNumber}
                    </p>
                    <p className="text-[10.5px] font-medium text-stone-500">{d.customerName}</p>
                  </div>
                </div>
                <p className="text-base font-black text-emerald-700">
                  {money(d.cashCollectedAmount ?? 0)}
                </p>
              </div>
              <div className="space-y-2.5 p-4">
                <p className="text-[11.5px] leading-relaxed text-stone-500">{d.address}</p>
                <a
                  href={`tel:${d.customerPhone}`}
                  className="tap flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2.5 text-xs font-bold text-sky-800 ring-1 ring-sky-100"
                >
                  <Phone className="h-3.5 w-3.5" /> {d.customerPhone}
                </a>
                <p className="text-[11.5px] text-stone-500">
                  Kuryer:{' '}
                  <span className="font-bold text-stone-800">{d.assignedToName || '—'}</span>
                </p>
                <div className="surface-inset flex justify-between px-3 py-2.5 text-xs text-stone-600">
                  <span>Qoldiq</span>
                  <span className="font-black text-stone-900">{money(d.outstandingAmount)}</span>
                </div>
                <button
                  onClick={() => confirm(d)}
                  disabled={actingId === d.id}
                  className="btn-primary w-full py-3 text-xs"
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
          <h3 className="section-kicker px-1">Qabul qilingan</h3>
          <div className="space-y-2">
            {recent.map((d) => (
              <div
                key={d.id}
                className="surface flex items-center justify-between px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-stone-900">
                    #{d.orderNumber} · {d.customerName}
                  </p>
                  <p className="text-[10.5px] text-stone-400">
                    {d.cashHandedOverAt
                      ? new Date(d.cashHandedOverAt).toLocaleString('uz-UZ')
                      : ''}
                  </p>
                </div>
                <p className="shrink-0 font-black text-emerald-700">
                  {money(d.cashCollectedAmount ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
