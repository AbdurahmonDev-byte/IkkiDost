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
  X,
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
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#8a4f27] via-brand-600 to-[#5b331b] p-5 text-white shadow-[0_26px_60px_-34px_rgba(91,51,27,0.95)] animate-rise">
        <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-black/15" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-white/15 text-white backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {isDineIn ? 'Choyxonada xizmat' : 'Uydan buyurtma'}
            </span>
            <span className="chip bg-emerald-400/20 text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-soft-pulse" />
              Onlayn
            </span>
          </div>
          <h1 className="mt-3.5 text-[26px] font-black leading-[1.12] tracking-tight">
            {customer?.firstName ? `Salom, ${customer.firstName}!` : 'Ikki Do‘st choyxonasi'}
          </h1>
          <p className="mt-1.5 max-w-[290px] text-[12px] leading-relaxed text-brand-100/90">
            {isDineIn
              ? selectedRoom
                ? `🏠 ${selectedRoom.name} — ofitsiant buyurtmani qabul qiladi.`
                : 'Xonani tanlang yoki ofitsiantni chaqiring.'
              : 'Mazali taomlarni tanlang — iliq holda eshigingizgacha yetkazamiz.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10.5px] font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 backdrop-blur">
              <Truck className="h-3.5 w-3.5 text-brand-100" /> Tez yetkazish
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 backdrop-blur">
              <ChefHat className="h-3.5 w-3.5 text-brand-100" /> Yangi tayyorlanadi
            </span>
          </div>
        </div>
      </div>

      {(!isStaff || isDineIn) && (
        <button
          onClick={onOpenCallWaiter}
          className="surface tap flex w-full items-center gap-3 p-3.5 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Bell className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black leading-tight text-stone-900">
              Ofitsiantni chaqirish
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-stone-500">
              Xona tanlang yoki xizmat so‘rang
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
            {selectedRoom ? selectedRoom.name : isStaff ? 'Xona' : 'Zal'}
          </span>
        </button>
      )}

      {/* Active order tracker */}
      {activeOrder && (
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 p-4 text-white shadow-xl shadow-stone-900/20">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
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
                className="tap inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/20"
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
        </div>
      )}

      {/* Search */}
      <div className="surface flex items-center gap-2.5 px-4 py-3 focus-within:border-brand-300">
        <Search className="h-4 w-4 shrink-0 text-brand-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Taom qidirish..."
          className="w-full bg-transparent text-sm font-semibold text-stone-800 outline-none placeholder:text-stone-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="rounded-full bg-stone-100 p-1 text-stone-500"
            aria-label="Qidiruvni tozalash"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        <button
          onClick={() => {
            setSelectedCatId(null);
            tg.selection();
          }}
          className={`tap shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
            selectedCatId === null
              ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25'
              : 'border border-stone-200/70 bg-white/80 text-stone-600 shadow-sm hover:bg-white'
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
            className={`tap shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${
              selectedCatId === c.id
                ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25'
                : 'border border-stone-200/70 bg-white/80 text-stone-600 shadow-sm hover:bg-white'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="section-kicker">Menyu</h2>
        <span className="text-[10px] font-bold text-stone-400">{filteredProducts.length} ta taom</span>
      </div>

      {/* Products */}
      {filteredProducts.length === 0 ? (
        <div className="surface flex flex-col items-center px-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50">
            <Utensils className="h-7 w-7 text-brand-300" />
          </div>
          <p className="mt-3 text-sm font-black text-stone-700">Taom topilmadi</p>
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
                className="surface tap flex flex-col overflow-hidden"
              >
                <div className="relative aspect-[5/4] w-full overflow-hidden bg-stone-100">
                  {product.thumbnailUrl || product.imageUrl ? (
                    <img
                      src={product.thumbnailUrl || product.imageUrl || ''}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-stone-100">
                      <Utensils className="h-9 w-9 text-brand-300" />
                    </div>
                  )}
                  {inCartQty > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-1.5 text-[11px] font-black text-white shadow-md">
                      {inCartQty}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h4 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-stone-900">
                    {product.name}
                  </h4>
                  <p className="mt-0.5 text-[10.5px] font-medium text-stone-400">
                    1 {qty(1, product.unit)}
                  </p>
                  <p className="mt-1 text-sm font-black text-brand-700">{money(product.price)}</p>

                  <div className="mt-auto pt-2.5">
                    {editingNoteFor === product.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          placeholder="Piyozsiz..."
                          className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-amber-50/40 px-2 py-1.5 text-[11px] font-semibold outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => saveNote(product.id)}
                          className="tap rounded-xl bg-amber-500 p-1.5 text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : inCartQty > 0 ? (
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => handleMinus(product)}
                          className="tap flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-800"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteFor(product.id);
                            setTempNote(cartItem?.note || '');
                          }}
                          className={`tap flex h-8 items-center gap-1 rounded-xl px-2 text-[10px] font-bold ${
                            cartItem?.note
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-stone-50 text-stone-400'
                          }`}
                          title="Izoh"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          Izoh
                        </button>
                        <button
                          onClick={() => handleAdd(product)}
                          className="tap flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdd(product)}
                        className="tap flex w-full items-center justify-center gap-1 rounded-xl bg-brand-50 py-2 text-xs font-extrabold text-brand-700 hover:bg-brand-100"
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
            className="tap flex w-full items-center justify-between rounded-[26px] bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 p-3.5 text-white shadow-2xl shadow-stone-900/40 ring-1 ring-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-black shadow-lg shadow-brand-900/30">
                {totalCartCount}
              </div>
              <div className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  Jami hisob
                </span>
                <span className="block text-base font-black">{money(totalCartSum)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm font-bold backdrop-blur">
              <ShoppingBag className="h-4 w-4" />
              <span>Savat</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
