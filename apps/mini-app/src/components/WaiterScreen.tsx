import React, { useEffect, useState } from 'react';
import {
  DoorOpen,
  Loader2,
  Plus,
  ReceiptText,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '../lib/api';
import { money, orderStatusLabel, statusColor } from '../lib/format';
import { tg } from '../lib/telegram';
import type { OrderDto, Room } from '../lib/types';
import { StaffHeader } from './StaffHeader';

interface Props {
  token: string;
  onSelectRoomForOrder: (room: Room) => void;
  onShowReceipt: (order: OrderDto) => void;
}

export const WaiterScreen: React.FC<Props> = ({ token, onSelectRoomForOrder, onShowReceipt }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [roomRows, orderRows] = await Promise.all([
        api.getRooms(),
        api.getOrders(token, { type: 'DINE_IN', active: true }).catch(() => [] as OrderDto[]),
      ]);
      setRooms(roomRows);
      setOrders(orderRows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const startOrder = (room: Room) => {
    tg.selection();
    onSelectRoomForOrder(room);
  };

  return (
    <div className="space-y-4 pb-20">
      <StaffHeader
        icon={UtensilsCrossed}
        title="Ofitsiant paneli"
        subtitle={`${rooms.filter((r) => r.isOccupied).length} band xona · ${orders.length} faol buyurtma`}
        tone="orange"
        onRefresh={() => fetchData()}
        loading={loading}
      />

      <div>
        <h3 className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-stone-400">
          Xonalar
        </h3>
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-xs">Yuklanmoqda...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`rounded-2xl border p-3.5 shadow-sm ${
                  room.isOccupied
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-stone-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      room.isOccupied ? 'bg-amber-200 text-amber-800' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <DoorOpen className="h-4 w-4" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      room.isOccupied
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {room.isOccupied ? 'Band' : 'Bo‘sh'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-stone-900">{room.name}</p>
                <button
                  onClick={() => startOrder(room)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Buyurtma qo‘shish
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-stone-400">
          Faol buyurtmalar
        </h3>
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-4 py-8 text-center text-xs font-semibold text-stone-400">
            Faol buyurtma yo‘q
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-[11px] font-black text-stone-700">
                  #{order.orderNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-900">
                    {order.roomName || 'Xona'} · {order.items.length} taom
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${statusColor[order.status]}`}
                    >
                      {orderStatusLabel[order.status]}
                    </span>
                    <span className="text-[11px] font-bold text-stone-700">
                      {money(order.totalAmount)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                      <Users className="h-3 w-3" /> {order.numberOfPeople}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onShowReceipt(order)}
                  className="rounded-xl bg-stone-900 p-2 text-white active:scale-95 transition-all"
                  title="Chek"
                >
                  <ReceiptText className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
