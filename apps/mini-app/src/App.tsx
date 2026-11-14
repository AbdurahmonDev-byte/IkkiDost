import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChefHat,
  Crown,
  DoorOpen,
  Info,
  Loader2,
  Lock,
  LogOut,
  ReceiptText,
  Truck,
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

const roleLabel: Record<StaffUser['role'], string> = {
  OWNER: 'Ega',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
  DELIVERY: 'Kuryer',
};

const tabHint: Record<Tab, string> = {
  customer: 'Mijoz oynasi: menyu, savat va buyurtma berish.',
  waiter: 'Xonalar va faol buyurtmalar. Yangi buyurtma uchun xonani tanlang.',
  kitchen: 'Navbatdagi taomlar. “Boshlash” va “Tayyor” orqali holatni yangilang.',
  delivery: 'Yetkazishlar. Buyurtmani qabul qiling, yo‘lga chiqing va naqd pulni kiriting.',
  cashier: 'Kuryer topshirgan naqd pulni tekshirib, “To‘lov qilindi” bilan tasdiqlang.',
  owner: 'Xodimlar, menyu va bugungi hisobotlar — hammasi shu yerda.',
};

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
  // only by pressing the "Ega" tab.
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
      list.push({ id: 'owner', label: 'Ega', icon: Crown });
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
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 text-stone-500">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-brand-500 to-brand-700 text-3xl shadow-xl shadow-brand-600/30">
          🫖
          <span className="absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/25" />
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-bold text-stone-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Yuklanmoqda...
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
    <div className="app-shell">
      <div className="mx-auto min-h-screen max-w-xl px-4 pb-10 pt-3">
        {/* Brand header */}
        <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-stone-200/50 bg-[#fdf9f2]/85 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl shadow-lg shadow-brand-600/30">
                <span>🫖</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#fdf9f2] bg-emerald-500" />
              </div>
              <div>
                <h1 className="text-[17px] font-black leading-tight tracking-tight text-stone-900">
                  Ikki Do‘st
                </h1>
                <p className="text-[9.5px] font-black uppercase tracking-[0.18em] text-brand-600">
                  Choyxonasi
                </p>
              </div>
            </div>

            {staffUser ? (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-2 rounded-2xl border border-stone-200/70 bg-white/90 py-1.5 pl-1.5 pr-3 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-stone-800 to-stone-950 text-[11px] font-black text-white">
                    {staffUser.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <p className="max-w-[96px] truncate text-[11px] font-black text-stone-900">
                      {staffUser.fullName}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-brand-600">
                      {roleLabel[staffUser.role]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="tap rounded-xl p-2 text-stone-400 transition-colors hover:bg-white hover:text-rose-600"
                  title="Chiqish"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsStaffLoginOpen(true)}
                className="tap flex items-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-bold text-stone-700 shadow-sm hover:bg-white"
              >
                <Lock className="h-3.5 w-3.5 text-brand-600" />
                <span>Xodimlar</span>
              </button>
            )}
          </div>
        </header>

        {/* Staff tabs */}
        {staffUser && tabs.length > 0 && (
          <div className="mb-4 space-y-2">
            <nav className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
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
                    className={`tap flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold ${
                      active
                        ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25'
                        : 'border border-stone-200/70 bg-white/80 text-stone-600 shadow-sm hover:bg-white hover:text-stone-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="flex items-start gap-2 rounded-2xl border border-brand-200/60 bg-brand-50/70 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-brand-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span>
                {staffUser.role === 'OWNER' && activeTab === 'customer'
                  ? 'Ega rejimidasiz. “Ega” tabidan xodimlar, menyu va hisobotlarni boshqaring.'
                  : tabHint[activeTab]}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
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
          className="tap fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xl shadow-brand-700/30"
          title="Elektron chek"
        >
          <ReceiptText className="h-5 w-5" />
        </button>
      )}
      </div>
    </div>
  );
};
