import React, { useEffect, useState } from 'react';

import {
  Lock,
  LogOut,
} from 'lucide-react';
import { api } from './lib/api';
import { tg } from './lib/telegram';
import type { CartItem, Category, OrderDto, Product, Room, ServiceFeeConfig, StaffUser } from './lib/types';
import { CustomerMenu } from './components/CustomerMenu';
import { CartModal } from './components/CartModal';
import { CallWaiterModal } from './components/CallWaiterModal';
import { KitchenScreen } from './components/KitchenScreen';
import { WaiterScreen } from './components/WaiterScreen';
import { OwnerScreen } from './components/OwnerScreen';
import { StaffLoginModal } from './components/StaffLoginModal';

export const App: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [serviceFeeConfig, setServiceFeeConfig] = useState<ServiceFeeConfig | null>(null);

  const [orderType, setOrderType] = useState<'DINE_IN' | 'DELIVERY'>('DINE_IN');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderDto | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);

  // Staff mode state
  const [staffUser, setStaffUser] = useState<StaffUser | null>(() => {
    try {
      const saved = localStorage.getItem('ikki_dost_staff');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'customer' | 'kitchen' | 'waiter' | 'owner'>('customer');

  // Initialize Telegram & load data
  useEffect(() => {
    tg.init();

    const loadData = async () => {
      try {
        const [menuRes, roomsRes] = await Promise.all([api.getMenu(), api.getRooms()]);
        setCategories(menuRes.categories);
        setProducts(menuRes.products);
        setServiceFeeConfig(menuRes.serviceFee);
        setRooms(roomsRes);

        // Check for room start_param from Telegram QR / deep link (e.g. room_1, room_2)
        const param = tg.startParam || new URLSearchParams(window.location.search).get('room');
        if (param && roomsRes.length > 0) {
          const match = roomsRes.find(
            (r) =>
              r.id.toLowerCase() === param.toLowerCase() ||
              r.name.toLowerCase().replace(/\s+/g, '_') === param.toLowerCase() ||
              r.name.toLowerCase().includes(param.toLowerCase()),
          );
          if (match) {
            setSelectedRoom(match);
            setOrderType('DINE_IN');
          }
        }
      } catch (err) {
        console.error('Failed to load menu data', err);
      }
    };

    loadData();
  }, []);

  // Follow the latest self-service order until it is finished.
  useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === 'COMPLETED' || activeOrder.status === 'CANCELLED') return;
    const timer = setInterval(async () => {
      try {
        const fresh = await api.getOrder(activeOrder.id);
        setActiveOrder(fresh);
      } catch {
        // keep the last known state on transient network errors
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  // Sync staffUser with localStorage
  const handleLoginSuccess = (user: StaffUser) => {
    setStaffUser(user);
    localStorage.setItem('ikki_dost_staff', JSON.stringify(user));
    if (user.role === 'CHEF') setActiveTab('kitchen');
    else if (user.role === 'WAITER') setActiveTab('waiter');
    else if (user.role === 'OWNER') setActiveTab('owner');
  };

  const handleLogout = () => {
    setStaffUser(null);
    localStorage.removeItem('ikki_dost_staff');
    setActiveTab('customer');
  };

  // Cart operations
  const handleUpdateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === productId);
      if (!existing && delta > 0) {
        const product = products.find((p) => p.id === productId);
        if (!product) return prev;
        return [...prev, { product, quantity: delta }];
      }
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return prev.filter((i) => i.product.id !== productId);
        }
        return prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i));
      }
      return prev;
    });
  };

  const handleUpdateCartNote = (productId: string, note: string) => {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, note } : i)),
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleClearCart = () => setCart([]);

  return (
    <div className="min-h-screen bg-stone-50 max-w-xl mx-auto px-4 py-4">
      {/* Top Brand Bar */}
      <header className="flex items-center justify-between pb-3 border-b border-stone-200/80 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/30 font-black">
            🫖
          </div>
          <div>
            <h1 className="font-black text-stone-900 text-base leading-tight">Ikki Do‘st</h1>
            <p className="text-[11px] font-semibold text-brand-700">Choyxonasi</p>
          </div>
        </div>

        {/* Staff Switcher or Login Button */}
        {staffUser ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold bg-stone-200 text-stone-800 px-2 py-1 rounded-xl">
              {staffUser.fullName.split(' ')[0]} ({staffUser.role})
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition-colors"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsStaffLoginOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 text-xs font-bold active:scale-95 transition-all"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Xodimlar</span>
          </button>
        )}
      </header>

      {/* Staff Role Navigation Tabs (when staff is logged in) */}
      {staffUser && (
        <nav className="flex gap-1.5 bg-stone-200/70 p-1.5 rounded-2xl mb-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'customer'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Mijoz menyusi
          </button>

          {(staffUser.role === 'CHEF' || staffUser.role === 'OWNER') && (
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                activeTab === 'kitchen'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              👨‍🍳 Oshxona
            </button>
          )}

          {(staffUser.role === 'WAITER' || staffUser.role === 'OWNER') && (
            <button
              onClick={() => setActiveTab('waiter')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                activeTab === 'waiter'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🤵 Ofitsiant
            </button>
          )}

          {staffUser.role === 'OWNER' && (
            <button
              onClick={() => setActiveTab('owner')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                activeTab === 'owner'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              👑 Egasi
            </button>
          )}
        </nav>
      )}

      {/* Main Views */}
      <main>
        {activeTab === 'customer' && (
          <CustomerMenu
            categories={categories}
            products={products}
            rooms={rooms}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            orderType={orderType}
            onSelectOrderType={setOrderType}
            cart={cart}
            onUpdateCartQty={handleUpdateCartQty}
            onUpdateCartNote={handleUpdateCartNote}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenCallWaiter={() => setIsCallWaiterOpen(true)}
            activeOrder={activeOrder}
          />
        )}

        {activeTab === 'kitchen' && staffUser && (
          <KitchenScreen token={staffUser.accessToken} />
        )}

        {activeTab === 'waiter' && (
          <WaiterScreen
            onSelectRoomForOrder={(room) => {
              setSelectedRoom(room);
              setOrderType('DINE_IN');
              setActiveTab('customer');
            }}
          />
        )}

        {activeTab === 'owner' && staffUser && (
          <OwnerScreen token={staffUser.accessToken} />
        )}
      </main>

      {/* Modals */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQty={handleUpdateCartQty}
        onUpdateNote={handleUpdateCartNote}
        onRemove={handleRemoveFromCart}
        onClear={handleClearCart}
        orderType={orderType}
        selectedRoom={selectedRoom}
        serviceFeeConfig={serviceFeeConfig}
        onOrderSuccess={(order) => {
          setActiveOrder(order);
        }}
      />

      <CallWaiterModal
        isOpen={isCallWaiterOpen}
        onClose={() => setIsCallWaiterOpen(false)}
        room={selectedRoom}
      />

      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => setIsStaffLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};
