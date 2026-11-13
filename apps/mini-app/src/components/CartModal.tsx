import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileEdit,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { money, qty } from '../lib/format';
import { tg } from '../lib/telegram';
import type { CartItem, Customer, OrderDto, Room, ServiceFeeConfig } from '../lib/types';

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
  /** Customers always order delivery; staff may create dine-in orders. */
  mode: 'customer' | 'staff';
  token?: string;
  customer: Customer | null;
  onOrderSuccess: (order: OrderDto) => void;
  onRequireVerification?: () => void;
}

const ADDRESS_KEY = 'ikki_dost_delivery_address';

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
  mode,
  token,
  customer,
  onOrderSuccess,
  onRequireVerification,
}) => {
  const [people, setPeople] = useState(2);
  const [generalNote, setGeneralNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState(() => localStorage.getItem(ADDRESS_KEY) || '');
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customers order delivery only — prefill from the registered profile.
  useEffect(() => {
    if (customer) {
      setCustomerName(customer.fullName);
      setCustomerPhone(customer.phone);
      const saved = customer.deliveryAddress || localStorage.getItem(ADDRESS_KEY) || '';
      setAddress((current) => (current.trim() ? current : saved));
    }
  }, [customer?.id, customer?.deliveryAddress]);

  if (!isOpen) return null;

  const isCustomer = mode === 'customer';
  const effectiveType: 'DINE_IN' | 'DELIVERY' = isCustomer ? 'DELIVERY' : orderType;
  const canOrder = customer?.phoneVerified === true;

  const itemsSubtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

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

    if (isCustomer && !canOrder) {
      onRequireVerification?.();
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
      quantity: String(i.quantity),
      note: i.note ? i.note.trim() : null,
    }));

    try {
      let order: OrderDto;
      if (isCustomer) {
        order = await api.createOrder({
          type: 'DELIVERY',
          numberOfPeople: 1,
          items: payloadItems,
          note: generalNote.trim() || null,
          address: address.trim(),
        });
        localStorage.setItem(ADDRESS_KEY, address.trim());
      } else {
        if (!token) throw new Error('Sessiya topilmadi');
        order =
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
      }

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center">
      <div className="flex h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-stone-900">Savat ({items.length} taom)</h3>
              <p className="text-xs text-stone-500">
                {effectiveType === 'DINE_IN'
                  ? selectedRoom
                    ? `🏠 ${selectedRoom.name}`
                    : 'Xona tanlanmagan'
                  : isCustomer
                    ? '🛵 Uyga yetkazish'
                    : '🛵 Yetkazib berish'}
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

        {/* Items */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <ShoppingBag className="mx-auto mb-2 h-12 w-12 opacity-30" />
              <p className="text-sm">Savatingiz bo‘sh</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-stone-900">{item.product.name}</h4>
                    <p className="text-xs text-stone-500">
                      {money(item.product.price)} / {qty(1, item.product.unit)}
                    </p>
                  </div>
                  <span className="text-sm font-black text-stone-900">
                    {money(item.product.price * item.quantity)}
                  </span>
                </div>

                <div className="mt-2 border-t border-stone-200/60 pt-2">
                  {editingNoteFor === item.product.id ? (
                    <div className="mt-1 flex items-center gap-1.5">
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
                        <button
                          onClick={() => openNoteEditor(item.product.id, item.note)}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-100/80 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-200/80"
                        >
                          <span>📝 {item.note}</span>
                          <FileEdit className="h-3 w-3 opacity-60" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openNoteEditor(item.product.id)}
                          className="flex items-center gap-1 text-[11px] text-stone-400 transition-colors hover:text-brand-600"
                        >
                          <FileEdit className="h-3 w-3" />
                          <span>Oshxona uchun izoh</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQty(item.product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm active:scale-95"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-9 text-center text-xs font-bold text-stone-800">
                          {qty(item.quantity, item.product.unit)}
                        </span>
                        <button
                          onClick={() => onUpdateQty(item.product.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(item.product.id)}
                          className="ml-1 p-1 text-stone-300 transition-colors hover:text-rose-500"
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
            <div className="space-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-700" />
                  <span className="text-xs font-semibold text-stone-800">Necha kishi uchun?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPeople((p) => Math.max(1, p - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-white text-stone-700 shadow-sm active:scale-95"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-stone-900">{people}</span>
                  <button
                    onClick={() => setPeople((p) => Math.min(50, p + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-white text-stone-700 shadow-sm active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between border-t border-amber-200/60 pt-1 text-[11px] text-amber-800">
                  <span>
                    Xizmat haqi ({people} kishi × {money(serviceFeeConfig!.amountPerPerson)}):
                  </span>
                  <span className="font-semibold">{money(serviceFeeAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Delivery details */}
          {items.length > 0 && effectiveType === 'DELIVERY' && (
            <div className="space-y-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/60 p-3.5">
              <h4 className="text-xs font-bold text-sky-900">
                {isCustomer ? 'Buyurtma ma’lumotlari' : 'Mijoz ma’lumotlari'}
              </h4>
              {isCustomer ? (
                <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-stone-900">
                      {customer?.fullName || 'Ro‘yxatdan o‘tilmagan'}
                    </p>
                    <p className="text-[11px] text-stone-500">{customer?.phone || '—'}</p>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Mijoz ismi"
                    className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Telefon (+998 90 123 45 67)"
                    className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </>
              )}
              <button
                type="button"
                onClick={requestLocation}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white py-2.5 text-xs font-bold text-sky-800 disabled:opacity-50"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {locating ? 'Lokatsiya aniqlanmoqda…' : 'Hozirgi lokatsiyani yuborish'}
              </button>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Yetkazish manzili (ko‘cha, uy, mo‘ljal)"
                className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {isCustomer && !canOrder && (
                <button
                  onClick={onRequireVerification}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-[11px] font-bold text-white"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Avval ro‘yxatdan o‘ting
                </button>
              )}
            </div>
          )}

          {/* General note */}
          {items.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">
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
          <div className="space-y-3 rounded-b-3xl border-t border-stone-100 bg-stone-50/80 p-4">
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
              <div className="flex justify-between border-t border-stone-200 pt-1 text-base font-black text-stone-900">
                <span>Jami to‘lov:</span>
                <span className="text-brand-700">{money(grandTotal)}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Yuborilmoqda...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" /> Buyurtmani tasdiqlash ({money(grandTotal)})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
