import React, { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  ChefHat,
  FileEdit,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  Utensils,
} from 'lucide-react';
import { money, orderStatusLabel, qty, statusColor } from '../lib/format';
import { tg } from '../lib/telegram';
import type { CartItem, Category, Customer, OrderDto, Product, Room } from '../lib/types';

interface Props {
  categories: Category[];
  products: Product[];
  customer: Customer | null;
  isStaff: boolean;
  orderType: 'DINE_IN' | 'DELIVERY';
  selectedRoom: Room | null;
  cart: CartItem[];
  onUpdateCartQty: (productId: string, delta: number) => void;
  onUpdateCartNote: (productId: string, note: string) => void;
  onOpenCart: () => void;
  onOpenCallWaiter: () => void;
  onShowReceipt: (order: OrderDto) => void;
  activeOrder: OrderDto | null;
}

export const CustomerMenu: React.FC<Props> = ({
  categories,
  products,
  customer,
  isStaff,
  orderType,
  selectedRoom,
  cart,
  onUpdateCartQty,
  onUpdateCartNote,
  onOpenCart,
  onOpenCallWaiter,
  onShowReceipt,
  activeOrder,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCatId && p.categoryId !== selectedCatId) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, selectedCatId, search]);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartSum = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleAdd = (product: Product) => {
    tg.haptic('light');
    onUpdateCartQty(product.id, 1);
  };

  const handleMinus = (product: Product) => {
    tg.haptic('light');
    onUpdateCartQty(product.id, -1);
  };

  const saveNote = (productId: string) => {
    onUpdateCartNote(productId, tempNote.trim());
    setEditingNoteFor(null);
  };

  const isDineIn = isStaff && orderType === 'DINE_IN';

  return (
    <div className="space-y-4 pb-32">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-5 text-white shadow-xl shadow-brand-900/20">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 -left-6 h-36 w-36 rounded-full bg-black/10" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            {isDineIn ? 'Choyxonada xizmat' : 'Uydan buyurtma'}
          </div>
          <h1 className="mt-3 text-2xl font-black leading-tight">
            {customer?.firstName ? `Salom, ${customer.firstName}!` : 'Ikki Do‘st choyxonasi'}
          </h1>
          <p className="mt-1 max-w-[260px] text-xs text-brand-100">
            {isDineIn
              ? selectedRoom
                ? `🏠 ${selectedRoom.name} — ofitsiant buyurtmani qabul qiladi.`
                : 'Xonani tanlang yoki ofitsiantni chaqiring.'
              : 'Mazali taomlarni tanlang — iliq holda eshigingizgacha yetkazamiz.'}
          </p>
          <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold text-brand-100">
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> Yetkazib berish
            </span>
            <span className="inline-flex items-center gap-1">
              <ChefHat className="h-3.5 w-3.5" /> Yangi tayyorlanadi
            </span>
          </div>
        </div>
      </div>

      {(!isStaff || isDineIn) && (
        <button
          onClick={onOpenCallWaiter}
          className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left active:scale-[0.99] transition-all"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Bell className="h-4 w-4" /> Ofitsiantni chaqirish
          </span>
          <span className="text-[11px] font-semibold text-amber-700">
            {selectedRoom ? selectedRoom.name : isStaff ? 'Xona tanlash' : 'Zaldamisiz?'}
          </span>
        </button>
      )}

      {/* Active order tracker */}
      {activeOrder && (
        <div className="rounded-3xl border border-stone-800 bg-gradient-to-r from-stone-900 to-stone-800 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-black">Buyurtma #{activeOrder.orderNumber}</span>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusColor[activeOrder.status]}`}
            >
              {orderStatusLabel[activeOrder.status]}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-stone-300">
            <span>
              {activeOrder.items.length} taom ·{' '}
              <span className="font-black text-white">{money(activeOrder.totalAmount)}</span>
            </span>
            <button
              onClick={() => onShowReceipt(activeOrder)}
              className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white active:scale-95 transition-all"
            >
              <ReceiptText className="h-3.5 w-3.5" /> Chek
            </button>
          </div>

          {activeOrder.delivery && (
            <div className="mt-2 flex items-start gap-1.5 rounded-2xl bg-black/20 px-3 py-2 text-[11px] text-stone-300">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{activeOrder.delivery.address}</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm focus-within:border-brand-400">
        <Search className="h-4 w-4 text-stone-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Taom qidirish..."
          className="w-full bg-transparent text-sm font-semibold text-stone-800 outline-none placeholder:text-stone-400"
        />
      </div>

      {/* Categories */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
        <button
          onClick={() => {
            setSelectedCatId(null);
            tg.selection();
          }}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition-all active:scale-95 ${
            selectedCatId === null
              ? 'bg-stone-900 text-white shadow-md'
              : 'border border-stone-200/80 bg-white text-stone-700 hover:bg-stone-100'
          }`}
        >
          Barchasi
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCatId(c.id);
              tg.selection();
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition-all active:scale-95 ${
              selectedCatId === c.id
                ? 'bg-stone-900 text-white shadow-md'
                : 'border border-stone-200/80 bg-white text-stone-700 hover:bg-stone-100'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Products */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-4 py-14 text-center">
          <Utensils className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 text-sm font-bold text-stone-600">Taom topilmadi</p>
          <p className="mt-1 text-xs text-stone-400">Boshqa kategoriya yoki nom bilan urinib ko‘ring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => {
            const cartItem = cart.find((i) => i.product.id === product.id);
            const inCartQty = cartItem?.quantity || 0;

            return (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm transition-all hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  {product.thumbnailUrl || product.imageUrl ? (
                    <img
                      src={product.thumbnailUrl || product.imageUrl || ''}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-stone-100">
                      <Utensils className="h-9 w-9 text-brand-300" />
                    </div>
                  )}
                  {inCartQty > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-black text-white shadow-md">
                      {inCartQty}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h4 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-stone-900">
                    {product.name}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-stone-500">1 {qty(1, product.unit)}</p>
                  <p className="mt-1 text-sm font-black text-brand-700">{money(product.price)}</p>

                  <div className="mt-auto pt-2">
                    {editingNoteFor === product.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          placeholder="Piyozsiz..."
                          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-amber-50/40 px-2 py-1.5 text-[11px] outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => saveNote(product.id)}
                          className="rounded-lg bg-amber-500 p-1.5 text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : inCartQty > 0 ? (
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => handleMinus(product)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-800 active:scale-95"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteFor(product.id);
                            setTempNote(cartItem?.note || '');
                          }}
                          className={`flex h-8 items-center gap-1 rounded-xl px-2 text-[10px] font-bold active:scale-95 ${
                            cartItem?.note
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-stone-50 text-stone-400'
                          }`}
                          title="Izoh"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          {cartItem?.note ? 'Izoh' : 'Izoh'}
                        </button>
                        <button
                          onClick={() => handleAdd(product)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm active:scale-95"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdd(product)}
                        className="flex w-full items-center justify-center gap-1 rounded-xl bg-brand-50 py-2 text-xs font-extrabold text-brand-700 active:scale-95 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" /> Qo‘shish
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating cart */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-lg animate-in slide-in-from-bottom-5 duration-200">
          <button
            onClick={() => {
              tg.haptic('medium');
              onOpenCart();
            }}
            className="flex w-full items-center justify-between rounded-3xl bg-brand-600 p-4 text-white shadow-2xl shadow-brand-600/40 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-sm font-black">
                {totalCartCount}
              </div>
              <div className="text-left">
                <span className="block text-[11px] font-medium text-brand-100">Jami hisob:</span>
                <span className="block text-base font-black">{money(totalCartSum)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-white/20 px-3.5 py-2 text-sm font-bold">
              <ShoppingBag className="h-4 w-4" />
              <span>Savat</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
