import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChefHat,
  Crown,
  DoorOpen,
  Loader2,
  Lock,
  LogOut,
  ReceiptText,
  Truck,
  UserRound,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { api } from './lib/api';
import { tg } from './lib/telegram';
import type {
  CartItem,
  Category,
  Customer,
  OrderDto,
  Product,
  PublicConfig,
  Room,
  ServiceFeeConfig,
  StaffUser,
} from './lib/types';
import { CustomerMenu } from './components/CustomerMenu';
import { CartModal } from './components/CartModal';
import { CallWaiterModal } from './components/CallWaiterModal';
import { KitchenScreen } from './components/KitchenScreen';
import { WaiterScreen } from './components/WaiterScreen';
import { DeliveryScreen } from './components/DeliveryScreen';
import { OwnerScreen } from './components/OwnerScreen';
import { CashierScreen } from './components/CashierScreen';
import { StaffLoginModal } from './components/StaffLoginModal';
import { RegistrationScreen } from './components/RegistrationScreen';
import { ReceiptModal } from './components/ReceiptModal';

const STAFF_KEY = 'ikki_dost_staff';
const LAST_ORDER_KEY = 'ikki_dost_last_order';

type Tab = 'customer' | 'waiter' | 'kitchen' | 'delivery' | 'cashier' | 'owner';

function readStaff(): StaffUser | null {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  } catch {
    return null;
  }
}

function saveStaff(user: StaffUser | null) {
  try {
    if (user) localStorage.setItem(STAFF_KEY, JSON.stringify(user));
    else localStorage.removeItem(STAFF_KEY);
  } catch {
    // storage unavailable
  }
}

function defaultTab(role: StaffUser['role']): Tab {
  if (role === 'DELIVERY') return 'delivery';
  if (role === 'CHEF') return 'kitchen';
  if (role === 'CASHIER') return 'cashier';
  if (role === 'WAITER') return 'waiter';
  // The owner lands on the normal customer screen and opens the owner panel
  // only by pressing the "Egasi" tab.
  return 'customer';
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [serviceFeeConfig, setServiceFeeConfig] = useState<ServiceFeeConfig | null>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerLoaded, setCustomerLoaded] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'DELIVERY'>('DELIVERY');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderDto | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderDto | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);

  const [staffUser, setStaffUser] = useState<StaffUser | null>(() => readStaff());
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = readStaff();
    return saved ? defaultTab(saved.role) : 'customer';
  });

  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bootRan = useRef(false);

  const telegramAvailable = Boolean(tg.app?.initData);

  const loadMenu = async () => {
    const [menuRes, roomsRes, cfg] = await Promise.all([
      api.getMenu(),
      api.getRooms(),
      api.getConfig().catch(() => null),
    ]);
    setCategories(menuRes.categories);
    setProducts(menuRes.products);
    setServiceFeeConfig(menuRes.serviceFee);
    setRooms(roomsRes);
    if (cfg) setConfig(cfg);
  };

  const refreshCustomer = async () => {
    if (!tg.app?.initData) {
      setCustomerLoaded(true);
      return;
    }
    const res = await api.getMe();
    setCustomer(res.customer);
    setCustomerLoaded(true);
  };

  // Boot: data, customer, Telegram staff auto-login.
  useEffect(() => {
    if (bootRan.current) return;
    bootRan.current = true;
    tg.init();

    const boot = async () => {
      try {
        await Promise.all([loadMenu(), refreshCustomer()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ma’lumotlarni yuklab bo‘lmadi');
      }

      // Passwordless staff login when the Mini App runs inside Telegram.
      if (tg.app?.initData) {
        try {
          const res = await api.telegramLogin();
          const user: StaffUser = {
            ...res.user,
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          };
          setStaffUser(user);
          saveStaff(user);
          setActiveTab(defaultTab(user.role));
        } catch {
          // TELEGRAM_NOT_LINKED is expected for ordinary customers.
        }
      }

      // Restore the last customer order (delivery tracking).
      if (tg.app?.initData) {
        try {
          const savedId = localStorage.getItem(LAST_ORDER_KEY);
          if (savedId) {
            const order = await api.getOrder(savedId);
            setActiveOrder(order);
          }
        } catch {
          localStorage.removeItem(LAST_ORDER_KEY);
        }
      }

      setBooting(false);
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the active customer order until it is finished.
  useEffect(() => {
    if (!activeOrder || !tg.app?.initData) return;
    if (activeOrder.status === 'COMPLETED' || activeOrder.status === 'CANCELLED') return;
    const timer = setInterval(async () => {
      try {
        const fresh = await api.getOrder(activeOrder.id);
        setActiveOrder(fresh);
      } catch {
        // keep the last known state on transient errors
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  const staffMode =
    staffUser?.role === 'OWNER' || staffUser?.role === 'WAITER' || staffUser?.role === 'CASHIER';

  const tabs = useMemo(() => {
    if (!staffUser) return [];
    const list: Array<{ id: Tab; label: string; icon: React.ElementType }> = [];
    const role = staffUser.role;
    if (role === 'OWNER' || role === 'WAITER' || role === 'CASHIER') {
      list.push({ id: 'waiter', label: 'Xonalar', icon: DoorOpen });
    }
    if (role === 'OWNER' || role === 'CHEF') {
      list.push({ id: 'kitchen', label: 'Oshxona', icon: ChefHat });
    }
    if (role === 'OWNER' || role === 'WAITER' || role === 'CASHIER' || role === 'DELIVERY') {
      list.push({ id: 'delivery', label: 'Yetkazish', icon: Truck });
    }
    if (role === 'OWNER' || role === 'CASHIER') {
      list.push({ id: 'cashier', label: 'Kassa', icon: Wallet });
    }
    if (role === 'OWNER') {
      list.push({ id: 'owner', label: 'Egasi', icon: Crown });
    }
    list.unshift({ id: 'customer', label: 'Menyu', icon: UtensilsCrossed });
    return list;
  }, [staffUser?.role]);

  const handleLoginSuccess = (user: StaffUser) => {
    setStaffUser(user);
    saveStaff(user);
    setActiveTab(defaultTab(user.role));
  };

  const handleLogout = async () => {
    if (staffUser?.refreshToken) {
      api.logout(staffUser.refreshToken).catch(() => undefined);
    }
    setStaffUser(null);
    saveStaff(null);
    setActiveTab('customer');
  };

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
        if (newQty <= 0) return prev.filter((i) => i.product.id !== productId);
        return prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i));
      }
      return prev;
    });
  };

  const handleUpdateCartNote = (productId: string, note: string) => {
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, note } : i)));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleOrderSuccess = (order: OrderDto) => {
    setActiveOrder(order);
    setReceiptOrder(order);
    if (customer && order.type === 'DELIVERY') {
      try {
        localStorage.setItem(LAST_ORDER_KEY, order.id);
      } catch {
        // ignore storage errors
      }
    }
  };

  const openRegistration = () => {
    if (!telegramAvailable) {
      tg.alert('Buyurtma berish uchun Mini App’ni Telegram orqali oching.');
      return;
    }
    setActiveTab('customer');
  };

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50 text-stone-500">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-600 text-2xl text-white shadow-lg shadow-brand-600/30">
          🫖
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      </div>
    );
  }

  const registrationNeeded =
    activeTab === 'customer' &&
    !staffMode &&
    telegramAvailable &&
    customerLoaded &&
    (!customer || !customer.phoneVerified);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-6 pt-4">
      {/* Brand header */}
      <header className="mb-3 flex items-center justify-between border-b border-stone-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-lg font-black text-white shadow-md shadow-brand-600/30">
            🫖
          </div>
          <div>
            <h1 className="text-base font-black leading-tight text-stone-900">Ikki Do‘st</h1>
            <p className="text-[11px] font-semibold text-brand-700">Choyxonasi</p>
          </div>
        </div>

        {staffUser ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 rounded-2xl bg-stone-900 px-2.5 py-1.5 text-white">
              <UserRound className="h-3.5 w-3.5 text-stone-300" />
              <div className="leading-tight">
                <p className="max-w-[110px] truncate text-[11px] font-black">
                  {staffUser.fullName}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">
                  {staffUser.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-rose-600"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsStaffLoginOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 transition-all hover:bg-stone-200 active:scale-95"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Xodimlar</span>
          </button>
        )}
      </header>

      {/* Staff tabs */}
      {staffUser && tabs.length > 0 && (
        <nav className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto rounded-2xl bg-stone-200/70 p-1.5 text-xs font-bold">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  tg.selection();
                  setActiveTab(tab.id);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 transition-all ${
                  active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}

      {error && (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {!telegramAvailable && activeTab === 'customer' && (
        <div className="mb-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-800">
          Buyurtma berish uchun Mini App’ni Telegram orqali oching. Brauzerda faqat menyuni
          ko‘rish mumkin.
        </div>
      )}

      <main>
        {activeTab === 'customer' &&
          (registrationNeeded ? (
            <RegistrationScreen
              config={config}
              customer={customer}
              telegramName={
                tg.user
                  ? { firstName: tg.user.first_name, lastName: tg.user.last_name }
                  : null
              }
              onRegistered={(c) => {
                setCustomer(c);
                refreshCustomer().catch(() => undefined);
              }}
              onRefresh={refreshCustomer}
            />
          ) : (
            <CustomerMenu
              categories={categories}
              products={products}
              customer={customer}
              isStaff={Boolean(staffUser) && staffMode}
              orderType={orderType}
              selectedRoom={selectedRoom}
              cart={cart}
              onUpdateCartQty={handleUpdateCartQty}
              onUpdateCartNote={handleUpdateCartNote}
              onOpenCart={() => setIsCartOpen(true)}
              onOpenCallWaiter={() => setIsCallWaiterOpen(true)}
              onShowReceipt={setReceiptOrder}
              activeOrder={activeOrder}
            />
          ))}

        {activeTab === 'waiter' && staffUser && (
          <WaiterScreen
            token={staffUser.accessToken}
            onSelectRoomForOrder={(room) => {
              setSelectedRoom(room);
              setOrderType('DINE_IN');
              setActiveTab('customer');
            }}
            onShowReceipt={setReceiptOrder}
          />
        )}

        {activeTab === 'kitchen' && staffUser && <KitchenScreen token={staffUser.accessToken} />}

        {activeTab === 'delivery' && staffUser && (
          <DeliveryScreen token={staffUser.accessToken} userId={staffUser.id} />
        )}

        {activeTab === 'cashier' && staffUser && (
          <CashierScreen token={staffUser.accessToken} />
        )}

        {activeTab === 'owner' && staffUser && (
          <OwnerScreen
            token={staffUser.accessToken}
            onMenuChanged={() => {
              loadMenu().catch(() => undefined);
            }}
          />
        )}
      </main>

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQty={handleUpdateCartQty}
        onUpdateNote={handleUpdateCartNote}
        onRemove={handleRemoveFromCart}
        onClear={() => setCart([])}
        orderType={orderType}
        selectedRoom={selectedRoom}
        serviceFeeConfig={serviceFeeConfig}
        mode={staffMode ? 'staff' : 'customer'}
        token={staffUser?.accessToken}
        customer={customer}
        onOrderSuccess={handleOrderSuccess}
        onRequireVerification={openRegistration}
      />

      <CallWaiterModal
        isOpen={isCallWaiterOpen}
        rooms={rooms}
        room={selectedRoom}
        onSelectRoom={setSelectedRoom}
        onClose={() => setIsCallWaiterOpen(false)}
      />

      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => setIsStaffLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        telegramAvailable={telegramAvailable}
      />

      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />

      {/* Customer receipt shortcut when an order is active */}
      {customer && activeOrder && !staffUser && (
        <button
          onClick={() => setReceiptOrder(activeOrder)}
          className="fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-white shadow-xl active:scale-95 transition-all"
          title="Elektron chek"
        >
          <ReceiptText className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
