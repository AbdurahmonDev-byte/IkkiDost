import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileEdit,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { lineTotal, money, qty, quantityForApi } from '../lib/format';
import { tg } from '../lib/telegram';
import type { CartItem, OrderDto, OrderType, Room, ServiceFeeConfig } from '../lib/types';
import { QuantityStepper } from './QuantityStepper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onSetQty: (productId: string, quantity: number) => void;
  onUpdateNote: (productId: string, note: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  orderType: OrderType;
  selectedRoom: Room | null;
  serviceFeeConfig: ServiceFeeConfig | null;
  token?: string;
  onOrderSuccess: (order: OrderDto) => void;
}


export const CartModal: React.FC<Props> = ({
  isOpen,
  onClose,
  items,
  onSetQty,
  onUpdateNote,
  onRemove,
  onClear,
  orderType,
  selectedRoom,
  serviceFeeConfig,
  token,
  onOrderSuccess,
}) => {
  const [people, setPeople] = useState(2);
  const [generalNote, setGeneralNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveType = orderType;

  const itemsSubtotal = items.reduce(
    (sum, item) => sum + lineTotal(item.product.price, item.quantity),
    0,
  );

  let serviceFeeAmount = 0;
  if (serviceFeeConfig?.enabled) {
    const applies =
      effectiveType === 'DINE_IN'
        ? serviceFeeConfig.applyToDineIn
        : serviceFeeConfig.applyToDelivery;
    if (applies) {
      serviceFeeAmount =
        serviceFeeConfig.amountPerPerson * (effectiveType === 'DINE_IN' ? people : 1);
    }
  }

  const grandTotal = itemsSubtotal + serviceFeeAmount;

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Bu qurilmada lokatsiya aniqlanmaydi. Manzilni matn bilan kiriting.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const mapUrl = `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
        setAddress((current) => {
          const withoutOldLocation = current
            .split('\n')
            .filter((line) => !line.startsWith('https://maps.google.com/?q='))
            .join('\n')
            .trim();
          return withoutOldLocation ? `${withoutOldLocation}\n${mapUrl}` : mapUrl;
        });
        setLocating(false);
      },
      (locationError) => {
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Lokatsiya ruxsati berilmadi. Manzilni matn bilan kiriting yoki sozlamadan ruxsat bering.'
            : 'Lokatsiyani aniqlab bo‘lmadi. Qayta urinib ko‘ring yoki manzilni matn bilan kiriting.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;

    if (!token) {
      setError('Buyurtma berish uchun xodim sifatida kiring');
      return;
    }

    if (effectiveType === 'DINE_IN' && !selectedRoom) {
      setError('Iltimos, o‘tirgan xonangizni tanlang');
      return;
    }

    if (effectiveType === 'DELIVERY') {
      if (!customerName.trim()) {
        setError('Iltimos, ismingizni kiriting');
        return;
      }
      if (!customerPhone.trim() || customerPhone.trim().length < 7) {
        setError('Iltimos, to‘g‘ri telefon raqamingizni kiriting');
        return;
      }
      if (!address.trim() || address.trim().length < 3) {
        setError('Iltimos, yetkazish manzilini to‘liq kiriting');
        return;
      }
    }

    setLoading(true);
    setError(null);

    const payloadItems = items.map((i) => ({
      productId: i.product.id,
      quantity: quantityForApi(i.quantity),
      note: i.note ? i.note.trim() : null,
    }));

    try {
      const order: OrderDto =
        effectiveType === 'DINE_IN'
          ? await api.createStaffOrder(token, {
              type: 'DINE_IN',
              roomId: selectedRoom!.id,
              numberOfPeople: people,
              items: payloadItems,
              note: generalNote.trim() || null,
            })
          : await api.createStaffOrder(token, {
              type: 'DELIVERY',
              numberOfPeople: 1,
              items: payloadItems,
              note: generalNote.trim() || null,
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              address: address.trim(),
            });

      tg.hapticSuccess();
      onClear();
      onClose();
      onOrderSuccess(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Buyurtma yuborishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const openNoteEditor = (productId: string, currentNote?: string) => {
    setEditingNoteFor(productId);
    setTempNote(currentNote || '');
  };

  const saveItemNote = (productId: string) => {
    onUpdateNote(productId, tempNote.trim());
    setEditingNoteFor(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 backdrop-blur-sm sm:items-center">
      <div className="flex h-[92vh] w-full max-w-lg flex-col rounded-t-[30px] bg-[#fffdfa] dark:bg-[#151311] shadow-2xl animate-rise sm:h-auto sm:max-h-[86vh] sm:rounded-[30px]">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-stone-100 dark:border-stone-800 px-4 pb-4 pt-3">
          <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-brand-200/60 dark:bg-brand-400/10 blur-2xl" />
          <div className="sheet-grabber mb-1 sm:hidden" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="icon-tile bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-black leading-tight text-stone-900 dark:text-stone-100">
                  Savat
                  <span className="ml-1.5 rounded-full bg-brand-50 dark:bg-brand-400/10 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:text-brand-200">
                    {items.length} taom
                  </span>
                </h3>
                <p className="truncate text-[11.5px] font-medium text-stone-500 dark:text-stone-400">
                  {effectiveType === 'DINE_IN'
                    ? selectedRoom
                      ? `🏠 ${selectedRoom.name}`
                      : 'Xona tanlanmagan'
                    : '🛵 Yetkazib berish'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="tap shrink-0 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900 p-2.5 text-stone-500 shadow-sm hover:text-stone-700 dark:hover:text-stone-300"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-400/10">
                <ShoppingBag className="h-7 w-7 text-brand-300" />
              </div>
              <p className="mt-3 text-sm font-black text-stone-700 dark:text-stone-300">Savatingiz bo‘sh</p>
              <p className="mt-1 text-xs text-stone-500">Menyudan taom tanlab qo‘shing.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="surface-soft p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="text-[13px] font-black leading-snug text-stone-900 dark:text-stone-100">
                      {item.product.name}
                    </h4>
                    <p className="mt-0.5 text-[10.5px] font-medium text-stone-500">
                      {money(item.product.price)} / {qty(1, item.product.unit)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-brand-700 dark:text-brand-200">
                    {money(lineTotal(item.product.price, item.quantity))}
                  </span>
                </div>

                <div className="mt-2 border-t border-stone-200/60 dark:border-stone-800/60 pt-2">
                  {editingNoteFor === item.product.id ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={tempNote}
                        onChange={(e) => setTempNote(e.target.value)}
                        placeholder="Piyozsiz, achchiqroq..."
                        className="min-w-0 flex-1 rounded-xl border border-amber-300 dark:border-amber-400/40 bg-white dark:bg-stone-900 px-3 py-2 text-[11px] font-semibold text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-amber-400"
                        autoFocus
                      />
                      <button
                        onClick={() => saveItemNote(item.product.id)}
                        className="tap rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-bold text-amber-950 shadow-sm hover:bg-amber-400"
                      >
                        Saqlash
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      {item.note ? (
                        <button
                          onClick={() => openNoteEditor(item.product.id, item.note)}
                          className="tap flex min-w-0 items-center gap-1.5 rounded-lg bg-amber-100/80 dark:bg-amber-400/15 px-2 py-1 text-[10.5px] font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-200/80"
                        >
                          <span className="truncate">📝 {item.note}</span>
                          <FileEdit className="h-3 w-3 shrink-0 opacity-60" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openNoteEditor(item.product.id)}
                          className="tap flex items-center gap-1 text-[10.5px] font-semibold text-stone-500 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
                        >
                          <FileEdit className="h-3 w-3" />
                          <span>Oshxona uchun izoh</span>
                        </button>
                      )}

                      <div className="flex shrink-0 items-center gap-1.5">
                        <QuantityStepper
                          value={item.quantity}
                          unit={item.product.unit}
                          onChange={(next) =>
                            next <= 0 ? onRemove(item.product.id) : onSetQty(item.product.id, next)
                          }
                        />
                        <button
                          onClick={() => onRemove(item.product.id)}
                          className="ml-0.5 rounded-lg p-1.5 text-stone-300 dark:text-stone-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-400/15 hover:text-rose-500"
                          aria-label="O‘chirish"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Staff dine-in: people count */}
          {items.length > 0 && effectiveType === 'DINE_IN' && (
            <div className="space-y-2 rounded-2xl border border-amber-200/70 dark:border-amber-400/25 bg-amber-50/60 dark:bg-amber-400/10 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="text-[12px] font-black text-stone-800 dark:text-stone-200">Necha kishi uchun?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPeople((p) => Math.max(1, p - 1))}
                    className="tap flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 dark:border-amber-400/25 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 shadow-sm"
                    aria-label="Kamaytirish"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-stone-900 dark:text-stone-100">{people}</span>
                  <button
                    onClick={() => setPeople((p) => Math.min(50, p + 1))}
                    className="tap flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm"
                    aria-label="Qo‘shish"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between border-t border-amber-200/60 dark:border-amber-400/25 pt-1.5 text-[10.5px] font-semibold text-amber-800 dark:text-amber-300">
                  <span>
                    Xizmat haqi ({people} kishi × {money(serviceFeeConfig!.amountPerPerson)}):
                  </span>
                  <span className="font-black">{money(serviceFeeAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Delivery details */}
          {items.length > 0 && effectiveType === 'DELIVERY' && (
            <div className="space-y-2.5 rounded-2xl border border-sky-200/70 dark:border-sky-400/25 bg-sky-50/60 dark:bg-sky-400/10 p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-400/15 text-sky-700 dark:text-sky-300">
                  <MapPin className="h-4 w-4" />
                </span>
                <h4 className="text-[12px] font-black text-sky-900 dark:text-sky-300">
                  Mijoz ma’lumotlari
                </h4>
              </div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Mijoz ismi"
                className="field-mini border-sky-200 dark:border-sky-400/25 bg-white dark:bg-stone-900 focus:border-sky-400"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Telefon (+998 90 123 45 67)"
                className="field-mini border-sky-200 dark:border-sky-400/25 bg-white dark:bg-stone-900 focus:border-sky-400"
              />
              <button
                type="button"
                onClick={requestLocation}
                disabled={locating}
                className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 dark:border-sky-400/40 bg-white dark:bg-stone-900 py-2.5 text-[11.5px] font-bold text-sky-800 dark:text-sky-300 shadow-sm disabled:opacity-50"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {locating ? 'Lokatsiya aniqlanmoqda…' : 'Hozirgi lokatsiyani yuborish'}
              </button>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Yetkazish manzili (ko‘cha, uy, mo‘ljal)"
                className="field-mini border-sky-200 dark:border-sky-400/25 bg-white dark:bg-stone-900 focus:border-sky-400"
              />
            </div>
          )}

          {/* General note */}
          {items.length > 0 && (
            <div>
              <p className="label-mini">Umumiy buyurtma izohi (ixtiyoriy)</p>
              <textarea
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Buyurtma bo‘yicha umumiy talablar..."
                rows={2}
                className="field resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="space-y-3 border-t border-stone-100 dark:border-stone-800 bg-[#fdf8f1] dark:bg-[#151311] p-4 pb-safe">
            <div className="space-y-1 text-[11.5px] text-stone-600 dark:text-stone-300">
              <div className="flex justify-between">
                <span>Taomlar narxi:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{money(itemsSubtotal)}</span>
              </div>
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Xizmat haqi:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{money(serviceFeeAmount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-stone-200/80 dark:border-stone-800/80 pt-1.5">
                <span className="text-[12px] font-black text-stone-900 dark:text-stone-100">Jami to‘lov:</span>
                <span className="text-lg font-black text-brand-700 dark:text-brand-200">{money(grandTotal)}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-400/10 px-3 py-2 text-[11.5px] font-semibold text-rose-700 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full py-3.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Yuborilmoqda...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Buyurtmani tasdiqlash ({money(grandTotal)})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
