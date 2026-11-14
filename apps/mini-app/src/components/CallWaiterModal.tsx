import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-[30px] bg-[#fffdfa] shadow-2xl animate-rise sm:rounded-[30px]">
        <div className="sheet-grabber sm:hidden" />

        <div className="relative overflow-hidden border-b border-stone-100 px-4 pb-4 pt-3">
          <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-amber-200/60 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="icon-tile bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-orange-500/30">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-600">
                    Xizmat
                  </p>
                </div>
                <h3 className="truncate text-[17px] font-black leading-tight text-stone-900">
                  Ofitsiant chaqirish
                </h3>
                <p className="truncate text-[11.5px] font-medium text-stone-500">
                  {room ? `🏠 ${room.name}` : 'Xonangizni tanlang'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="tap shrink-0 rounded-2xl border border-stone-200/80 bg-white p-2.5 text-stone-400 shadow-sm hover:text-stone-700"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <h4 className="mt-3 text-lg font-black text-stone-900">Ofitsiant chaqirildi!</h4>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
              Xodimlarimiz tez orada xonangizga kelishadi.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4 pb-safe">
            <div>
              <p className="label-mini">Qaysi xonadasiz?</p>
              <div className="grid grid-cols-3 gap-1.5">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelectRoom(r);
                      tg.selection();
                    }}
                    className={`tap rounded-xl px-2 py-2.5 text-[11px] font-bold ${
                      room?.id === r.id
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/25'
                        : 'border border-stone-200/80 bg-white text-stone-600 shadow-sm hover:bg-stone-50'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
                {rooms.length === 0 && (
                  <p className="col-span-3 rounded-xl bg-stone-50 px-3 py-2 text-[11px] font-medium text-stone-400">
                    Xonalar yuklanmadi
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="label-mini">Qo‘shimcha iltimos (ixtiyoriy)</p>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Masalan: Choy olib keling, hisob..."
                className="field"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNote((prev) => (prev ? `${prev}, ${tag}` : tag))}
                  className="tap rounded-xl bg-stone-100 px-2.5 py-1.5 text-[11px] font-bold text-stone-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  + {tag}
                </button>
              ))}
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
                {error}
              </p>
            )}

            <button
              onClick={handleCall}
              disabled={loading || !room}
              className="btn-primary w-full py-3.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {loading ? 'Yuborilmoqda...' : 'Ofitsiantni chaqirish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
