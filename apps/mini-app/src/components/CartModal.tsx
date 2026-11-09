import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  FileEdit,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { money, qty } from '../lib/format';
import { tg } from '../lib/telegram';
import type { CartItem, OrderDto, Room, ServiceFeeConfig } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (productId: string, delta: number) => void;
  onUpdateNote: (productId: string, note: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  orderType: 'DINE_IN' | 'DELIVERY';
  selectedRoom: Room | null;
  serviceFeeConfig: ServiceFeeConfig | null;
  onOrderSuccess: (order: OrderDto) => void;
}

export const CartModal: React.FC<Props> = ({
  isOpen,
  onClose,
  items,
  onUpdateQty,
  onUpdateNote,
  onRemove,
  onClear,
  orderType,
  selectedRoom,
  serviceFeeConfig,
  onOrderSuccess,
}) => {
  const [people, setPeople] = useState(2);
  const [generalNote, setGeneralNote] = useState('');
  const [customerName, setCustomerName] = useState(tg.user?.first_name || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const itemsSubtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  let serviceFeeAmount = 0;
  if (serviceFeeConfig?.enabled) {
    const applies =
      orderType === 'DINE_IN'
        ? serviceFeeConfig.applyToDineIn
        : serviceFeeConfig.applyToDelivery;
    if (applies) {
      serviceFeeAmount = serviceFeeConfig.amountPerPerson * (orderType === 'DINE_IN' ? people : 1);
    }
  }

  const grandTotal = itemsSubtotal + serviceFeeAmount;

  const handleSubmit = async () => {
    if (items.length === 0) return;

    if (orderType === 'DINE_IN' && !selectedRoom) {
      setError('Iltimos, o‘tirgan xonangizni tanlang');
      return;
    }

    if (orderType === 'DELIVERY') {
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

    try {
      const order = await api.createOrder({
        type: orderType,
        roomId: orderType === 'DINE_IN' && selectedRoom ? selectedRoom.id : undefined,
        numberOfPeople: orderType === 'DINE_IN' ? people : 1,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: String(i.quantity),
          note: i.note ? i.note.trim() : null,
        })),
        note: generalNote.trim() || null,
        customerName: orderType === 'DELIVERY' ? customerName.trim() : undefined,
        customerPhone: orderType === 'DELIVERY' ? customerPhone.trim() : undefined,
        address: orderType === 'DELIVERY' ? address.trim() : undefined,
      });

      tg.hapticSuccess();
      onClear();
      onClose();
      onOrderSuccess(order);
    } catch (err: any) {
      setError(err?.message || 'Buyurtma yuborishda xatolik yuz berdi');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-[90vh] sm:h-auto sm:max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900">Savat ({items.length} taom)</h3>
              <p className="text-xs text-stone-500">
                {orderType === 'DINE_IN'
                  ? selectedRoom
                    ? `🏠 ${selectedRoom.name}`
                    : 'Xona tanlanmagan'
                  : '🛵 Yetkazib berish'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <ShoppingBag className="mx-auto h-12 w-12 opacity-30 mb-2" />
              <p className="text-sm">Savatingiz bo‘sh</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-stone-900 text-sm">{item.product.name}</h4>
                    <p className="text-xs text-stone-500">
                      {money(item.product.price)} / {qty(1, item.product.unit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-stone-900 text-sm">
                      {money(item.product.price * item.quantity)}
                    </span>
                  </div>
                </div>

                {/* Specific Note for the Cook (yozadigan joyi) */}
                <div className="mt-2 pt-2 border-t border-stone-200/60">
                  {editingNoteFor === item.product.id ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        value={tempNote}
                        onChange={(e) => setTempNote(e.target.value)}
                        placeholder="Oshxona uchun izoh (masalan: Piyozsiz)"
                        className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        autoFocus
                      />
                      <button
                        onClick={() => saveItemNote(item.product.id)}
                        className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        Saqlash
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      {item.note ? (
                        <div
                          onClick={() => openNoteEditor(item.product.id, item.note)}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-100/80 px-2 py-1 text-[11px] font-medium text-amber-900 cursor-pointer hover:bg-amber-200/80"
                        >
                          <span>📝 Izoh: {item.note}</span>
                          <FileEdit className="h-3 w-3 opacity-60" />
                        </div>
                      ) : (
                        <button
                          onClick={() => openNoteEditor(item.product.id)}
                          className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-brand-600 transition-colors"
                        >
                          <FileEdit className="h-3 w-3" />
                          <span>Oshxona uchun izoh yozish (piyozsiz...)</span>
                        </button>
                      )}

                      {/* Stepper */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQty(item.product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-700 active:scale-95 shadow-sm"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-stone-800">
                          {qty(item.quantity, item.product.unit)}
                        </span>
                        <button
                          onClick={() => onUpdateQty(item.product.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-700 active:scale-95 shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(item.product.id)}
                          className="p-1 text-stone-300 hover:text-rose-500 ml-1 transition-colors"
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

          {/* Dine In Details: People Count */}
          {items.length > 0 && orderType === 'DINE_IN' && (
            <div className="rounded-2xl bg-amber-50/60 border border-amber-200/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-700" />
                  <span className="text-xs font-semibold text-stone-800">Necha kishi uchun?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPeople((p) => Math.max(1, p - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-amber-200 text-stone-700 active:scale-95 shadow-sm"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-stone-900">{people}</span>
                  <button
                    onClick={() => setPeople((p) => Math.min(50, p + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-amber-200 text-stone-700 active:scale-95 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between text-[11px] text-amber-800 pt-1 border-t border-amber-200/60">
                  <span>Xizmat haqi ({people} kishi × {money(serviceFeeConfig!.amountPerPerson)}):</span>
                  <span className="font-semibold">{money(serviceFeeAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Delivery Details */}
          {items.length > 0 && orderType === 'DELIVERY' && (
            <div className="rounded-2xl bg-sky-50/60 border border-sky-200/80 p-3.5 space-y-2.5">
              <h4 className="text-xs font-bold text-sky-900">Mijoz ma’lumotlari</h4>
              <div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ismingiz"
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Telefon raqamingiz (+998 90 123 45 67)"
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Yetkazish manzili (ko‘cha, uy, mo‘ljal)"
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          {/* General Order Note */}
          {items.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Umumiy buyurtma izohi (ixtiyoriy):
              </label>
              <textarea
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Buyurtma bo‘yicha umumiy talablar..."
                rows={2}
                className="w-full rounded-2xl border border-stone-200 p-3 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-stone-100 p-4 bg-stone-50/80 rounded-b-3xl space-y-3">
            <div className="space-y-1 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Taomlar narxi:</span>
                <span className="font-medium text-stone-900">{money(itemsSubtotal)}</span>
              </div>
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Xizmat haqi:</span>
                  <span className="font-medium text-stone-900">{money(serviceFeeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-stone-900 pt-1 border-t border-stone-200">
                <span>Jami to‘lov:</span>
                <span className="text-brand-700">{money(grandTotal)}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Buyurtmani tasdiqlash ({money(grandTotal)})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
