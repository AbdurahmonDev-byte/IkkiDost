import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  Check,
  Clock,
  Flame,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p className="text-sm">Buyurtmalar yuklanmoqda...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl bg-white border border-stone-200/80 p-8 shadow-sm">
          <UtensilsCrossed className="h-14 w-14 text-stone-300 mb-3" />
          <h3 className="font-bold text-stone-800 text-lg">Hozircha buyurtma yo‘q</h3>
          <p className="text-xs text-stone-500 max-w-xs mt-1">
            Yangi buyurtmalar tushishi bilan ushbu ekranda avtomatik paydo bo‘ladi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {orders.map((order) => {
            const isDineIn = order.type === 'DINE_IN';
            const kitchenItems = order.items.filter(
              (it) => it.status === 'PENDING' || it.status === 'PREPARING',
            );
            const readyItems = order.items.filter((it) => it.status === 'READY');

            return (
              <div
                key={order.id}
                className="rounded-3xl bg-white border border-stone-200/90 shadow-md overflow-hidden flex flex-col"
              >
                {/* Ticket Header */}
                <div
                  className={`p-3.5 flex items-center justify-between ${
                    isDineIn ? 'bg-amber-500 text-stone-950' : 'bg-sky-600 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xl">#{order.orderNumber}</span>
                    <span className="text-xs font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-lg">
                      {isDineIn ? `🏠 ${order.roomName || 'Xona'}` : '🛵 Yetkazish'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Overall Order Note */}
                {order.note && (
                  <div className="bg-amber-100/70 border-b border-amber-200 px-3.5 py-2 text-xs font-medium text-amber-900">
                    <span className="font-bold">⚠️ Buyurtma izohi:</span> {order.note}
                  </div>
                )}

                {/* Items */}
                <div className="p-3.5 flex-1 divide-y divide-stone-100 space-y-2.5">
                  {kitchenItems.map((item) => (
                    <div key={item.id} className="pt-2.5 first:pt-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-stone-900 text-base">
                            {item.productName}
                          </span>
                          <span className="ml-2 font-black text-base text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg">
                            × {qty(item.quantity, item.productUnit)}
                          </span>
                        </div>
                      </div>

                      {/* SPECIFIC ITEM NOTE ("haligini mini appni yozadigan joyiga yozadi u povarga boradi") */}
                      {item.note && (
                        <div className="rounded-xl bg-amber-50 border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 flex items-center gap-1.5 shadow-sm">
                          <span className="text-base">📝</span>
                          <span>Izoh: &quot;{item.note}&quot;</span>
                        </div>
                      )}

                      {/* Action Buttons for Cook */}
                      <div className="flex items-center gap-2 pt-1">
                        {item.status === 'PENDING' ? (
                          <button
                            onClick={() => handleSetStatus(order.id, item.id, 'PREPARING')}
                            disabled={updatingItemId === item.id}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 py-2 text-xs font-bold active:scale-[0.98] transition-all"
                          >
                            <Flame className="h-4 w-4 text-orange-600" />
                            <span>Boshlash (Tayyorlanmoqda)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSetStatus(order.id, item.id, 'READY')}
                            disabled={updatingItemId === item.id}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all"
                          >
                            <Check className="h-4 w-4" />
                            <span>Tayyor bo‘ldi!</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Ready items list (grayed out) */}
                  {readyItems.length > 0 && (
                    <div className="pt-2 text-xs text-stone-400 space-y-0.5">
                      <span className="font-semibold text-emerald-600">✓ Tayyor bo‘lganlar:</span>
                      {readyItems.map((it) => (
                        <div key={it.id} className="line-through pl-2">
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
