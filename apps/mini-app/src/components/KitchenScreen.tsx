import React, { useEffect, useState } from 'react';
import { ChefHat, Check, Clock, Flame, Loader2, NotebookPen, UtensilsCrossed } from 'lucide-react';
import { api } from '../lib/api';
import { qty } from '../lib/format';
import { tg } from '../lib/telegram';
import type { OrderDto } from '../lib/types';
import { StaffHeader } from './StaffHeader';

interface Props {
  token: string;
}

export const KitchenScreen: React.FC<Props> = ({ token }) => {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const data = await api.getKitchenOrders(token);
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch kitchen orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000); // 4s poll
    return () => clearInterval(interval);
  }, [token]);

  const handleSetStatus = async (
    orderId: string,
    itemId: string,
    status: 'PREPARING' | 'READY',
  ) => {
    setUpdatingItemId(itemId);
    try {
      await api.setItemStatus(token, orderId, itemId, status);
      tg.haptic(status === 'READY' ? 'medium' : 'light');
      await fetchOrders();
    } catch (err) {
      console.error('Failed to update item status', err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <StaffHeader
        icon={ChefHat}
        title="Oshxona navbati"
        subtitle={`${orders.length} ta faol buyurtma · har 4 soniyada yangilanadi`}
        tone="orange"
        onRefresh={fetchOrders}
        loading={loading}
      />

      {loading && orders.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center py-16 text-stone-500">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-brand-500" />
          <p className="text-xs font-semibold">Buyurtmalar yuklanmoqda...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="surface flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-400/10">
            <UtensilsCrossed className="h-7 w-7 text-brand-300" />
          </div>
          <h3 className="mt-3 text-base font-black text-stone-800 dark:text-stone-200">Hozircha buyurtma yo‘q</h3>
          <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-stone-500 dark:text-stone-400">
            Yangi buyurtmalar tushishi bilan ushbu ekranda avtomatik paydo bo‘ladi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {orders.map((order) => {
            const isDineIn = order.type === 'DINE_IN';
            const kitchenItems = order.items.filter(
              (it) => it.status === 'PENDING' || it.status === 'PREPARING',
            );
            const readyItems = order.items.filter((it) => it.status === 'READY');

            return (
              <div key={order.id} className="surface overflow-hidden">
                {/* Ticket Header */}
                <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/60 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-1.5 text-sm font-black ${
                        isDineIn
                          ? 'bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300'
                          : 'bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-300'
                      }`}
                    >
                      #{order.orderNumber}
                    </span>
                    <span
                      className={`chip ${
                        isDineIn
                          ? 'bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300'
                          : 'bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-300'
                      }`}
                    >
                      {isDineIn ? `🏠 ${order.roomName || 'Xona'}` : '🛵 Yetkazish'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-stone-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Overall Order Note */}
                {order.note && (
                  <div className="flex items-start gap-1.5 border-b border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 px-4 py-2.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
                    <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-bold">Buyurtma izohi:</span> {order.note}
                    </span>
                  </div>
                )}

                {/* Items */}
                <div className="flex-1 divide-y divide-stone-100 dark:divide-stone-800 px-4 py-2">
                  {kitchenItems.map((item) => (
                    <div key={item.id} className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-black leading-snug text-stone-900 dark:text-stone-100">
                          {item.productName}
                        </span>
                        <span className="shrink-0 rounded-lg bg-brand-50 dark:bg-brand-400/10 px-2 py-0.5 text-xs font-black text-brand-700 dark:text-brand-200">
                          × {qty(item.quantity, item.productUnit)}
                        </span>
                      </div>

                      {item.note && (
                        <div className="flex items-start gap-1.5 rounded-xl border border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                          <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Izoh: “{item.note}”</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-0.5">
                        {item.status === 'PENDING' ? (
                          <button
                            onClick={() => handleSetStatus(order.id, item.id, 'PREPARING')}
                            disabled={updatingItemId === item.id}
                            className="tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-50 dark:bg-orange-400/10 py-2.5 text-[11px] font-bold text-orange-800 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-400/30 disabled:opacity-50"
                          >
                            {updatingItemId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Flame className="h-4 w-4 text-orange-600" />
                            )}
                            Boshlash
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSetStatus(order.id, item.id, 'READY')}
                            disabled={updatingItemId === item.id}
                            className="tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-[11px] font-bold text-white shadow-md shadow-emerald-600/20 disabled:opacity-50"
                          >
                            {updatingItemId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Tayyor bo‘ldi
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Ready items list */}
                  {readyItems.length > 0 && (
                    <div className="space-y-1 py-3 text-[11px] text-stone-500">
                      <span className="flex items-center gap-1 font-bold text-emerald-600">
                        <Check className="h-3.5 w-3.5" /> Tayyor bo‘lganlar
                      </span>
                      {readyItems.map((it) => (
                        <div key={it.id} className="line-through">
                          {it.productName} × {qty(it.quantity, it.productUnit)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
