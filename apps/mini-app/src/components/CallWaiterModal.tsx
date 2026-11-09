import React, { useState } from 'react';
import { Bell, CheckCircle2, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { tg } from '../lib/telegram';
import type { Room } from '../lib/types';

interface Props {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_TAGS = ['Choy keltiring', 'Hisobni bering', 'Menyu kerak', 'Qoshiq / vilkalar'];

export const CallWaiterModal: React.FC<Props> = ({ room, isOpen, onClose }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCall = async () => {
    if (!room) {
      setError('Iltimos, avval o‘tirgan xonangizni tanlang');
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
    } catch (err: any) {
      setError(err?.message || 'Ofitsiantni chaqirib bo‘lmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">Ofitsiant chaqirish</h3>
              <p className="text-xs text-stone-500">{room ? room.name : 'Xona tanlanmagan'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center animate-in zoom-in-95 duration-200">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 mb-3" />
            <h4 className="text-xl font-bold text-stone-900">Ofitsiant chaqirildi!</h4>
            <p className="text-sm text-stone-500 mt-1">Xodimlarimiz tez orada xonangizga kelishadi.</p>
          </div>
        ) : (
          <div className="pt-4 space-y-4">
            {!room && (
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
                ⚠️ Ofitsiant chaqirish uchun avval yuqoridan o‘tirgan xonangizni tanlang.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
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
                  className="rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200 active:scale-95 transition-all"
                >
                  + {tag}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <button
              onClick={handleCall}
              disabled={loading || !room}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                <>
                  <Bell className="h-5 w-5" />
                  Ofitsiantni chaqirish
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
