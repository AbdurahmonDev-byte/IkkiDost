import React, { useEffect, useState } from 'react';
import { DoorClosed, Loader2, Plus, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { Room } from '../lib/types';

interface Props {
  onSelectRoomForOrder: (room: Room) => void;
}

export const WaiterScreen: React.FC<Props> = ({ onSelectRoomForOrder }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    try {
      const data = await api.getRooms();
      setRooms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between bg-stone-900 text-white p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white">
            <DoorClosed className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-wide">Ofitsiant ekrani</h2>
            <p className="text-xs text-stone-400">Xonalar va chaqiruvlar</p>
          </div>
        </div>
        <button
          onClick={fetchRooms}
          className="rounded-xl bg-stone-800 p-2 text-stone-300 hover:bg-stone-700 active:rotate-180 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`rounded-3xl border p-4 shadow-sm flex flex-col justify-between transition-all ${
                room.isOccupied
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-white border-stone-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      room.isOccupied ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  <h3 className="font-extrabold text-stone-900 text-base">{room.name}</h3>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    room.isOccupied
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {room.isOccupied ? 'Band' : 'Bo‘sh'}
                </span>
              </div>

              <div className="pt-2 border-t border-stone-100">
                <button
                  onClick={() => onSelectRoomForOrder(room)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white py-2.5 text-xs font-bold shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Taom qo‘shish / Buyurtma</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
