import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { tg } from '../lib/telegram';
import type { Room } from '../lib/types';

interface Props {
  isOpen: boolean;
  rooms: Room[];
  room: Room | null;
  onSelectRoom: (room: Room | null) => void;
  onClose: () => void;
}

const QUICK_TAGS = ['Choy keltiring', 'Hisobni bering', 'Menyu kerak', 'Qoshiq / vilkalar'];

export const CallWaiterModal: React.FC<Props> = ({
  isOpen,
  rooms,
  room,
  onSelectRoom,
  onClose,
}) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCall = async () => {
    if (!room) {
      setError('Iltimos, o‘tirgan xonangizni tanlang');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.callWaiter(room.id, note.trim() || undefined);
      tg.hapticSuccess();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setNote('');
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ofitsiantni chaqirib bo‘lmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl transition-all sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900">Ofitsiant chaqirish</h3>
              <p className="text-xs text-stone-500">
                {room ? `🏠 ${room.name}` : 'Xonangizni tanlang'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="animate-in zoom-in-95 py-8 text-center duration-200">
            <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-emerald-500" />
            <h4 className="text-xl font-black text-stone-900">Ofitsiant chaqirildi!</h4>
            <p className="mt-1 text-sm text-stone-500">
              Xodimlarimiz tez orada xonangizga kelishadi.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-600">
                Qaysi xonadasiz?
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelectRoom(r);
                      tg.selection();
                    }}
                    className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition-all active:scale-95 ${
                      room?.id === r.id
                        ? 'border-amber-400 bg-amber-100 text-amber-900'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
                {rooms.length === 0 && (
                  <p className="col-span-3 text-xs text-stone-400">Xonalar yuklanmadi</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-600">
                Qo‘shimcha iltimos (ixtiyoriy):
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Masalan: Choy olib keling, hisob..."
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNote((prev) => (prev ? `${prev}, ${tag}` : tag))}
                  className="rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition-all hover:bg-stone-200 active:scale-95"
                >
                  + {tag}
                </button>
              ))}
            </div>

            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

            <button
              onClick={handleCall}
              disabled={loading || !room}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Yuborilmoqda...
                </>
              ) : (
                <>
                  <Bell className="h-5 w-5" /> Ofitsiantni chaqirish
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
