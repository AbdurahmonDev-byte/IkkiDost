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

  const occupied = rooms.filter((r) => r.isOccupied).length;

  return (
    <div className="space-y-5 pb-20">
      <StaffHeader
        icon={UtensilsCrossed}
        title="Ofitsiant paneli"
        subtitle={`${occupied} band xona · ${orders.length} faol buyurtma`}
        tone="orange"
        onRefresh={() => fetchData()}
        loading={loading}
      />

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="section-kicker">Xonalar</h3>
          <span className="text-[10px] font-bold text-stone-400">
            {occupied}/{rooms.length} band
          </span>
        </div>
        {loading && rooms.length === 0 ? (
          <div className="surface flex items-center justify-center gap-2 py-12 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs font-semibold">Yuklanmoqda...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`surface relative overflow-hidden p-4 ${
                  room.isOccupied ? 'ring-1 ring-amber-200/80' : ''
                }`}
              >
                {room.isOccupied && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
                )}
                <div className="flex items-start justify-between">
                  <div
                    className={`icon-tile ${
                      room.isOccupied
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    <DoorOpen className="h-5 w-5" />
                  </div>
                  <span
                    className={`chip ${
                      room.isOccupied
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {room.isOccupied ? 'Band' : 'Bo‘sh'}
                  </span>
                </div>
                <p className="mt-3 text-[15px] font-black leading-tight text-stone-900">
                  {room.name}
                </p>
                <p className="mt-0.5 text-[10.5px] font-medium text-stone-400">
                  {room.isOccupied ? 'Mijozlar xizmatda' : 'Buyurtma uchun tayyor'}
                </p>
                <button
                  onClick={() => startOrder(room)}
                  className={`tap mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold ${
                    room.isOccupied
                      ? 'bg-stone-900 text-white'
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" /> Buyurtma
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="section-kicker">Faol buyurtmalar</h3>
          <span className="text-[10px] font-bold text-stone-400">{orders.length} ta</span>
        </div>
        {orders.length === 0 ? (
          <div className="surface flex flex-col items-center px-4 py-10 text-center">
            <UtensilsCrossed className="h-8 w-8 text-stone-300" />
            <p className="mt-2 text-xs font-bold text-stone-500">Faol buyurtma yo‘q</p>
            <p className="mt-0.5 text-[11px] text-stone-400">Xonadan buyurtma qo‘shsangiz, shu yerda ko‘rinadi.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((order) => (
              <div key={order.id} className="surface flex items-center gap-3 p-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-stone-800 to-stone-950 text-[11px] font-black text-white">
                  #{order.orderNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-stone-900">
                    {order.roomName || 'Xona'} · {order.items.length} taom
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${statusColor[order.status]}`}
                    >
                      {orderStatusLabel[order.status]}
                    </span>
                    <span className="text-[11px] font-black text-stone-800">
                      {money(order.totalAmount)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-stone-400">
                      <Users className="h-3 w-3" /> {order.numberOfPeople}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onShowReceipt(order)}
                  className="tap rounded-xl bg-stone-100 p-2.5 text-stone-700 hover:bg-stone-200"
                  title="Chek"
                >
                  <ReceiptText className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
