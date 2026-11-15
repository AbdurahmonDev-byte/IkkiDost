import React, { useMemo, useState } from 'react';
import {
  Bell,
  ArrowUpRight,
  Check,
  ChefHat,
  FileEdit,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from 'lucide-react';
import { money, orderStatusLabel, qty, statusColor } from '../lib/format';
import { menuImageFor } from '../lib/menuImages';
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

  const featuredProduct = useMemo(() => {
    const active = products.filter((product) => product.status === 'ACTIVE');
    const mainCategory = categories.find((category) => category.name.toLowerCase().includes('asosiy'));
    return active.find((product) => product.categoryId === mainCategory?.id && menuImageFor(product))
      ?? active.find((product) => menuImageFor(product))
      ?? active[0];
  }, [categories, products]);

  const featuredImage = featuredProduct ? menuImageFor(featuredProduct) : null;

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
    <div className="customer-menu space-y-5 pb-32 text-white">
      <section className="relative -mx-4 overflow-hidden bg-[#090b0c] px-4 pb-6 pt-1 animate-rise">
        <div className="flex items-center justify-between px-1 pb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#caa96b]">IKKI DO‘ST · CHOYXONASI</p>
            <h1 className="mt-1 text-[19px] font-semibold text-[#f4f0e8]">
              {customer?.firstName ? `Yoqimli ishtaha, ${customer.firstName}` : 'Yoqimli ishtaha!'}
            </h1>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#caa96b]">
            <Bell className="h-4 w-4" />
          </span>
        </div>

        <div className="flex items-center gap-5 border-b border-white/10 px-1 pb-3 text-[11px] font-semibold">
          <span className="border-b border-[#d1ad6b] pb-3 text-[#f2d9a4]">Menyu</span>
          <span className="pb-3 text-white/40">Tavsiya</span>
          <span className="ml-auto flex items-center gap-1 pb-3 text-[10px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ochiq
          </span>
        </div>

        {featuredProduct && (
          <div className="relative flex min-h-[410px] flex-col items-center pt-5 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">
              {isDineIn ? selectedRoom?.name ?? 'Choyxonada' : 'Tavsiya'}
            </p>
            <div className="relative mt-3 flex w-full flex-1 items-center justify-center">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-left text-[8px] uppercase leading-relaxed tracking-[0.16em] text-white/25">
                YANGI<br />TAYYORLANGAN
              </span>
              <div className="relative h-[min(68vw,290px)] w-[min(68vw,290px)] overflow-hidden rounded-full border border-white/10 bg-[#151819] shadow-[0_18px_70px_-20px_rgba(0,0,0,0.9)]">
                {featuredImage ? (
                  <img
                    src={featuredImage}
                    alt={featuredProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#171a1b]">
                    <Utensils className="h-12 w-12 text-[#caa96b]/50" />
                  </div>
                )}
              </div>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-right text-[8px] uppercase leading-relaxed tracking-[0.16em] text-white/25">
                SIFATLI<br />MASALLIQLAR
              </span>
            </div>
            <div className="mt-3 max-w-[300px]">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#caa96b]">
                {featuredProduct.categoryName ?? 'Oshpaz tavsiyasi'}
              </p>
              <h2 className="mt-1 text-[19px] font-semibold text-[#f4f0e8]">{featuredProduct.name}</h2>
              <p className="mt-1 text-[11px] text-white/45">{money(featuredProduct.price)} · {qty(1, featuredProduct.unit)}</p>
            </div>
            <button
              onClick={() => handleAdd(featuredProduct)}
              className="tap mt-3 inline-flex items-center gap-2 rounded-full bg-[#d2b273] px-5 py-2.5 text-[11px] font-bold text-[#15120d] hover:bg-[#e1c78f]"
            >
              <Plus className="h-3.5 w-3.5" /> Buyurtmaga qo‘shish
            </button>
            <div className="mt-4 flex items-center gap-1.5" aria-label="Tavsiya qilingan taom">
              <span className="h-1.5 w-5 rounded-full bg-[#d2b273]" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#1a1d1e]">
              {featuredImage ? (
                <img src={featuredImage} alt="Tavsiya" className="h-full w-full object-cover" />
              ) : <ChefHat className="m-3 h-6 w-6 text-[#caa96b]" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white/85">Ikki Do‘st tanlovi</p>
              <p className="mt-0.5 truncate text-[9px] text-white/40">
                {isDineIn ? 'Xonangizga xizmat ko‘rsatamiz' : 'Yangi tayyorlanadi, manzilingizga yetkaziladi'}
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[#caa96b]" />
        </div>
      </section>

      {(!isStaff || isDineIn) && (
        <button
          onClick={onOpenCallWaiter}
          className="tap flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#141718] p-3.5 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d2b273]/10 text-[#d2b273]">
            <Bell className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black leading-tight text-white">
              Ofitsiantni chaqirish
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-white/45">
              Xona tanlang yoki xizmat so‘rang
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[#d2b273]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#e2c98e]">
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
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#141718] px-4 py-3 focus-within:border-[#d2b273]/60">
        <Search className="h-4 w-4 shrink-0 text-[#d2b273]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Taom qidirish..."
          className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
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
              ? 'bg-[#d2b273] text-[#15120d]'
              : 'border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
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
                ? 'bg-[#d2b273] text-[#15120d]'
                : 'border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold tracking-wide text-white/90">Barcha taomlar</h2>
        <span className="text-[10px] font-medium text-white/40">{filteredProducts.length} ta</span>
      </div>

      {/* Products */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-[#141718] px-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5">
            <Utensils className="h-7 w-7 text-[#d2b273]" />
          </div>
          <p className="mt-3 text-sm font-black text-white/85">Taom topilmadi</p>
          <p className="mt-1 text-xs text-white/40">Boshqa kategoriya yoki nom bilan urinib ko‘ring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => {
            const cartItem = cart.find((i) => i.product.id === product.id);
            const inCartQty = cartItem?.quantity || 0;
            const imageUrl = menuImageFor(product);

            return (
              <div
                key={product.id}
                className="tap flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141718]"
              >
                <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#202425]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#1a1e1f]">
                      <Utensils className="h-9 w-9 text-[#d2b273]/55" />
                    </div>
                  )}
                  {inCartQty > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-1.5 text-[11px] font-black text-white shadow-md">
                      {inCartQty}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h4 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-white/90">
                    {product.name}
                  </h4>
                  <p className="mt-0.5 text-[10.5px] font-medium text-white/40">
                    1 {qty(1, product.unit)}
                  </p>
                  <p className="mt-1 text-sm font-black text-[#dfc184]">{money(product.price)}</p>

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
                          className="tap flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
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
                              : 'bg-white/5 text-white/45'
                          }`}
                          title="Izoh"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          Izoh
                        </button>
                        <button
                          onClick={() => handleAdd(product)}
                          className="tap flex h-8 w-8 items-center justify-center rounded-xl bg-[#d2b273] text-[#15120d] shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdd(product)}
                        className="tap flex w-full items-center justify-center gap-1 rounded-xl bg-[#d2b273] py-2 text-xs font-extrabold text-[#15120d] hover:bg-[#e1c78f]"
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
