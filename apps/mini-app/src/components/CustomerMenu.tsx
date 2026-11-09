import React, { useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  FileEdit,
  Minus,
  Plus,
  ShoppingBag,
  Utensils,
} from 'lucide-react';
import { money, qty, statusColor, orderStatusLabel } from '../lib/format';
import { tg } from '../lib/telegram';
import type { CartItem, Category, OrderDto, Product, Room } from '../lib/types';

interface Props {
  categories: Category[];
  products: Product[];
  rooms: Room[];
  selectedRoom: Room | null;
  onSelectRoom: (room: Room | null) => void;
  orderType: 'DINE_IN' | 'DELIVERY';
  onSelectOrderType: (type: 'DINE_IN' | 'DELIVERY') => void;
  cart: CartItem[];
  onUpdateCartQty: (productId: string, delta: number) => void;
  onUpdateCartNote: (productId: string, note: string) => void;
  onOpenCart: () => void;
  onOpenCallWaiter: () => void;
  activeOrder: OrderDto | null;
}

export const CustomerMenu: React.FC<Props> = ({
  categories,
  products,
  rooms,
  selectedRoom,
  onSelectRoom,
  orderType,
  onSelectOrderType,
  cart,
  onUpdateCartQty,
  onUpdateCartNote,
  onOpenCart,
  onOpenCallWaiter,
  activeOrder,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);

  const filteredProducts = selectedCatId
    ? products.filter((p) => p.categoryId === selectedCatId)
    : products;

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

  return (
    <div className="space-y-4 pb-28">
      {/* Top Bar: Room Selector & Call Waiter */}
      <div className="rounded-3xl bg-white p-3.5 shadow-sm border border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Order Type & Room selector */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowRoomDropdown(!showRoomDropdown)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-stone-100 px-3.5 py-2.5 text-xs font-bold text-stone-800 hover:bg-stone-200/80 active:scale-[0.99] transition-all"
            >
              <span className="truncate">
                {orderType === 'DINE_IN'
                  ? selectedRoom
                    ? `🏠 ${selectedRoom.name}`
                    : '🏠 Xonani tanlang'
                  : '🛵 Yetkazib berish (Uyga)'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" />
            </button>

            {/* Dropdown Menu */}
            {showRoomDropdown && (
              <div className="absolute left-0 top-full z-30 mt-1.5 w-full rounded-2xl bg-white p-1.5 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-1.5 text-[11px] font-bold text-stone-400 uppercase">Xonalar (Choyxonada):</div>
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelectOrderType('DINE_IN');
                      onSelectRoom(r);
                      setShowRoomDropdown(false);
                      tg.selection();
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                      orderType === 'DINE_IN' && selectedRoom?.id === r.id
                        ? 'bg-brand-50 text-brand-700'
                        : 'hover:bg-stone-100 text-stone-800'
                    }`}
                  >
                    <span>🏠 {r.name}</span>
                    {r.isOccupied && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Band</span>
                    )}
                  </button>
                ))}
                <div className="my-1 border-t border-stone-100" />
                <button
                  onClick={() => {
                    onSelectOrderType('DELIVERY');
                    onSelectRoom(null);
                    setShowRoomDropdown(false);
                    tg.selection();
                  }}
                  className={`w-full text-left rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                    orderType === 'DELIVERY'
                      ? 'bg-sky-50 text-sky-700'
                      : 'hover:bg-stone-100 text-stone-800'
                  }`}
                >
                  <span>🛵 Yetkazib berish (Uyga buyurtma)</span>
                </button>
              </div>
            )}
          </div>

          {/* Call Waiter Button (Dine-in only) */}
          {orderType === 'DINE_IN' && (
            <button
              onClick={onOpenCallWaiter}
              className="flex items-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-extrabold px-3.5 py-2.5 text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Bell className="h-4 w-4" />
              <span>Ofitsiant</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Order Tracker (if any) */}
      {activeOrder && (
        <div className="rounded-3xl bg-gradient-to-r from-stone-900 to-stone-800 text-white p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-extrabold text-sm">Buyurtmangiz #{activeOrder.orderNumber}</span>
            </div>
            <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full border ${statusColor[activeOrder.status]}`}>
              {orderStatusLabel[activeOrder.status]}
            </span>
          </div>
          <div className="text-xs text-stone-300">
            Jami: <span className="font-bold text-white">{money(activeOrder.totalAmount)}</span> · {activeOrder.items.length} taom
          </div>
        </div>
      )}

      {/* Category Pills (Horizontal scrolling) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => {
            setSelectedCatId(null);
            tg.selection();
          }}
          className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all active:scale-95 ${
            selectedCatId === null
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
              : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-stone-100'
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
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all active:scale-95 ${
              selectedCatId === c.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-stone-100'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filteredProducts.map((product) => {
          const cartItem = cart.find((i) => i.product.id === product.id);
          const inCartQty = cartItem?.quantity || 0;

          return (
            <div
              key={product.id}
              className="rounded-3xl bg-white border border-stone-200/80 p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex gap-3">
                {/* Product Thumbnail or Fallback */}
                <div className="h-20 w-20 shrink-0 rounded-2xl bg-stone-100 flex items-center justify-center overflow-hidden border border-stone-200/60">
                  {product.thumbnailUrl || product.imageUrl ? (
                    <img
                      src={product.thumbnailUrl || product.imageUrl || ''}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Utensils className="h-8 w-8 text-stone-300" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-stone-900 text-sm leading-snug">{product.name}</h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    1 {qty(1, product.unit)}
                  </p>
                  <p className="text-sm font-black text-brand-700 mt-1">
                    {money(product.price)}
                  </p>
                </div>
              </div>

              {/* Note / Stepper Controls */}
              <div className="mt-3 pt-2.5 border-t border-stone-100 flex flex-col gap-2">
                {/* Note Editor */}
                {editingNoteFor === product.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tempNote}
                      onChange={(e) => setTempNote(e.target.value)}
                      placeholder="Izoh (masalan: Piyozsiz)"
                      className="flex-1 rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-1.5 text-xs text-stone-800 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => saveNote(product.id)}
                      className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    {cartItem && cartItem.note ? (
                      <button
                        onClick={() => {
                          setEditingNoteFor(product.id);
                          setTempNote(cartItem.note || '');
                        }}
                        className="flex items-center gap-1 rounded-lg bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold text-amber-900"
                      >
                        <FileEdit className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{cartItem.note}</span>
                      </button>
                    ) : inCartQty > 0 ? (
                      <button
                        onClick={() => {
                          setEditingNoteFor(product.id);
                          setTempNote('');
                        }}
                        className="flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-brand-600"
                      >
                        <FileEdit className="h-3 w-3" />
                        <span>Izoh yozish (povarga)</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {/* Stepper / Add Button */}
                    {inCartQty > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMinus(product)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 active:scale-95 transition-all"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-xs font-black text-stone-900">
                          {inCartQty}
                        </span>
                        <button
                          onClick={() => handleAdd(product)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white active:scale-95 transition-all shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdd(product)}
                        className="flex items-center gap-1.5 rounded-2xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-extrabold px-3 py-1.5 text-xs active:scale-95 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Qo‘shish</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-40 max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-200">
          <button
            onClick={() => {
              tg.haptic('medium');
              onOpenCart();
            }}
            className="flex w-full items-center justify-between rounded-3xl bg-brand-600 p-4 text-white shadow-2xl shadow-brand-600/40 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-black text-sm">
                {totalCartCount}
              </div>
              <div className="text-left">
                <span className="block text-xs font-medium text-brand-100">Jami hisob:</span>
                <span className="block font-black text-base">{money(totalCartSum)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold bg-white/20 px-3.5 py-2 rounded-2xl">
              <ShoppingBag className="h-4 w-4" />
              <span>Savat</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
