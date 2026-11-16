import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  BarChart3,
  CheckCircle2,
  ChefHat,
  DoorOpen,
  Loader2,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { money, orderStatusLabel, qty } from '../lib/format';
import { menuImageFor } from '../lib/menuImages';
import { tg } from '../lib/telegram';
import type { Category, DeliveryDto, MeasurementUnit, OrderDto, PaymentDto, PaymentMethod, Product, Room } from '../lib/types';
import { StaffHeader } from './StaffHeader';
import { OptimoDashboard, type OptimoStats } from './OptimoDashboard';

type CashierView = 'overview' | 'orders' | 'rooms' | 'menu' | 'payments' | 'handover';
type PaymentTarget = { id: string; label: string; outstanding: number; sessionId?: string };

interface Props {
  token: string;
  onShowReceipt: (order: OrderDto) => void;
  onStartOrder?: () => void;
  onMenuChanged?: () => void;
}

type DashboardData = OptimoStats;

const views: Array<{ id: CashierView; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: 'Umumiy', icon: BarChart3 },
  { id: 'orders', label: 'Buyurtmalar', icon: ReceiptText },
  { id: 'rooms', label: 'Xonalar', icon: DoorOpen },
  { id: 'menu', label: 'Taomlar', icon: ChefHat },
  { id: 'payments', label: 'To‘lovlar', icon: Wallet },
  { id: 'handover', label: 'Naqd topshirish', icon: Banknote },
];

const units: Array<{ value: MeasurementUnit; label: string }> = [
  { value: 'PIECE', label: 'Dona' },
  { value: 'PORTION', label: 'Porsiya' },
  { value: 'KG', label: 'Kilogramm' },
  { value: 'LITER', label: 'Litr' },
  { value: 'OTHER', label: 'Boshqa' },
];

export const CashierScreen: React.FC<Props> = ({ token, onShowReceipt, onStartOrder, onMenuChanged }) => {
  const [view, setView] = useState<CashierView>('overview');
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', categoryId: '', unit: 'PORTION' as MeasurementUnit, price: '', costPrice: '' });
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const [summary, orderRows, roomRows, categoriesRows, productRows, deliveryRows, methodRows, paymentRows] = await Promise.all([
        api.getDashboard(token),
        api.getOrders(token),
        api.getStaffRooms(token),
        api.getCategories(token),
        api.getProducts(token, true),
        api.getDeliveries(token),
        api.getPaymentMethods(token),
        api.getPayments(token, from, now.toISOString()),
      ]);
      setDashboard(summary);
      setOrders(orderRows);
      setRooms(roomRows);
      setCategories(categoriesRows);
      setProducts(productRows);
      setNewProduct((current) => ({ ...current, categoryId: current.categoryId || categoriesRows[0]?.id || '' }));
      setDeliveries(deliveryRows);
      setMethods(methodRows.filter((method) => method.isActive));
      setPayments(paymentRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ma’lumotlarni yuklab bo‘lmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
    const timer = setInterval(() => void fetchAll(true), 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!paymentTarget) return;
    setPaymentAmount(String(paymentTarget.outstanding));
    setPaymentMethodId(methods.find((method) => method.kind === 'CASH')?.id ?? methods[0]?.id ?? '');
  }, [paymentTarget, methods]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)),
    [orders],
  );
  const pendingDeliveries = deliveries.filter(
    (delivery) => delivery.status === 'DELIVERED' && (delivery.cashCollectedAmount ?? 0) > 0 && !delivery.cashHandedOverAt,
  );
  const pendingCash = pendingDeliveries.reduce((sum, delivery) => sum + (delivery.cashCollectedAmount ?? 0), 0);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? null : current), 3000);
  };

  const createRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomName.trim()) return;
    setBusy('room-create');
    setError(null);
    try {
      await api.createRoom(token, roomName.trim());
      setRoomName('');
      await fetchAll(true);
      tg.hapticSuccess();
      flash('Xona qo‘shildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xona qo‘shilmadi');
    } finally {
      setBusy(null);
    }
  };

  const saveRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingRoom?.name.trim()) return;
    setBusy(`room-${editingRoom.id}`);
    setError(null);
    try {
      await api.updateRoom(token, editingRoom.id, { name: editingRoom.name.trim() });
      setEditingRoom(null);
      await fetchAll(true);
      flash('Xona yangilandi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xona yangilanmadi');
    } finally {
      setBusy(null);
    }
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProduct || !editingProduct.name.trim() || !editingProduct.categoryId || editingProduct.price <= 0) return;
    setBusy(`product-${editingProduct.id}`);
    setError(null);
    try {
      const updated = await api.updateProduct(token, editingProduct.id, {
        name: editingProduct.name.trim(),
        categoryId: editingProduct.categoryId,
        unit: editingProduct.unit,
        price: editingProduct.price,
        costPrice: editingProduct.costPrice,
        status: editingProduct.status,
      });
      setProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
      setEditingProduct(null);
      onMenuChanged?.();
      tg.hapticSuccess();
      flash('Taom yangilandi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Taomni tahrirlab bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(newProduct.price);
    const costPrice = Number(newProduct.costPrice || 0);
    if (!newProduct.name.trim() || !newProduct.categoryId || !Number.isInteger(price) || price <= 0 || !Number.isInteger(costPrice) || costPrice < 0) return;
    setBusy('product-create');
    setError(null);
    try {
      await api.createProduct(token, {
        name: newProduct.name.trim(),
        categoryId: newProduct.categoryId,
        unit: newProduct.unit,
        price,
        costPrice,
      });
      setNewProduct((current) => ({ ...current, name: '', price: '', costPrice: '' }));
      setAddingProduct(false);
      await fetchAll(true);
      onMenuChanged?.();
      tg.hapticSuccess();
      flash('Taom qo‘shildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Taom qo‘shilmadi');
    } finally {
      setBusy(null);
    }
  };

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentTarget || !paymentMethodId) return;
    const amount = Number(paymentAmount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > paymentTarget.outstanding) {
      setError('To‘lov summasini tekshiring');
      return;
    }
    setBusy('payment');
    setError(null);
    try {
      const input = { amount, methodId: paymentMethodId, idempotencyKey: crypto.randomUUID() };
      if (paymentTarget.sessionId) await api.payRoomSession(token, paymentTarget.sessionId, input);
      else await api.payOrder(token, paymentTarget.id, input);
      setPaymentTarget(null);
      await fetchAll(true);
      tg.hapticSuccess();
      flash(`To‘lov qabul qilindi: ${money(amount)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To‘lov amalga oshmadi');
    } finally {
      setBusy(null);
    }
  };

  const confirmHandover = async (delivery: DeliveryDto) => {
    setBusy(`handover-${delivery.id}`);
    setError(null);
    try {
      await api.handoverDeliveryCash(token, delivery.id);
      await fetchAll(true);
      tg.hapticSuccess();
      flash('Kuryer puli qabul qilindi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To‘lovni tasdiqlab bo‘lmadi');
    } finally {
      setBusy(null);
    }
  };

  const roomOutstanding = rooms.reduce((sum, room) => sum + (room.activeSession?.outstandingAmount ?? 0), 0);
  const deliveryOutstanding = orders
    .filter((order) => order.type === 'DELIVERY' && order.status !== 'CANCELLED')
    .reduce((sum, order) => sum + order.outstandingAmount, 0);

  return (
    <div className="space-y-4 pb-24">
      <StaffHeader
        icon={Wallet}
        title="Kassir paneli"
        subtitle="Choyxona savdosi, xonalar va to‘lovlar"
        tone="emerald"
        onRefresh={() => void fetchAll()}
        loading={loading}
      />

      {onStartOrder && (
        <button
          type="button"
          onClick={onStartOrder}
          className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 py-3 text-xs font-black text-white shadow-lg shadow-brand-600/25"
        >
          <Plus className="h-4 w-4" /> Yangi buyurtma olish
        </button>
      )}

      <nav className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`tap flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold ${
              view === id ? 'bg-stone-900 dark:bg-stone-100 dark:text-stone-900 text-white' : 'border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            {id === 'handover' && pendingDeliveries.length > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">{pendingDeliveries.length}</span>
            )}
          </button>
        ))}
      </nav>

      {error && <div className="rounded-xl border border-rose-200 dark:border-rose-400/25 bg-rose-50 dark:bg-rose-400/10 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 px-3 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">{notice}</div>}

      {loading && !dashboard ? (
        <div className="surface flex items-center justify-center gap-2 py-16 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" /><span className="text-xs font-semibold">Yuklanmoqda...</span>
        </div>
      ) : (
        <>
          {view === 'overview' && (
            <div className="space-y-4">
              {dashboard && <OptimoDashboard stats={dashboard} title="Kassir — Asosiy hisobot" />}

              <div className="surface divide-y divide-stone-100 dark:divide-stone-800">
                <OverviewRow label="Faol xonalar" value={`${rooms.filter((room) => room.activeSession).length} / ${rooms.length}`} />
                <OverviewRow label="Faol buyurtmalar" value={String(activeOrders.length)} />
                <OverviewRow label="Ochiq qarz (zal + yetkazish)" value={money(roomOutstanding + deliveryOutstanding)} />
                <OverviewRow label="Kuryerdan olinadigan naqd" value={money(pendingCash)} />
              </div>
              <div className="flex items-center justify-between px-1">
                <h3 className="section-kicker">Oxirgi buyurtmalar</h3>
                <button className="tap text-[10px] font-bold text-brand-700 dark:text-brand-200" onClick={() => setView('orders')}>Barchasi</button>
              </div>
              {orders.slice(0, 4).map((order) => (
                <OrderCard key={order.id} order={order} rooms={rooms} onPay={setPaymentTarget} onReceipt={onShowReceipt} />
              ))}
            </div>
          )}

          {view === 'orders' && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="section-kicker">Barcha buyurtmalar</h3>
                <span className="text-[10px] font-bold text-stone-500">{orders.length} ta</span>
              </div>
              {orders.length === 0 ? <Empty text="Buyurtmalar topilmadi" /> : orders.map((order) => (
                <OrderCard key={order.id} order={order} rooms={rooms} onPay={setPaymentTarget} onReceipt={onShowReceipt} />
              ))}
            </section>
          )}

          {view === 'rooms' && (
            <section className="space-y-3">
              <form onSubmit={createRoom} className="surface flex gap-2 p-3">
                <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Yangi xona nomi" className="field min-w-0 flex-1" />
                <button disabled={!roomName.trim() || busy === 'room-create'} className="btn-primary shrink-0 px-3 disabled:opacity-50">
                  {busy === 'room-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Qo‘shish
                </button>
              </form>
              {rooms.map((room) => (
                <div key={room.id} className="surface p-3.5">
                  <div className="flex items-start gap-3">
                    <span className={`icon-tile ${room.activeSession ? 'bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'}`}><DoorOpen className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-stone-900 dark:text-stone-100">{room.name}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-stone-500">{room.activeSession ? `${room.activeSession.orderCount} buyurtma · qarz ${money(room.activeSession.outstandingAmount)}` : 'Bo‘sh xona'}</p>
                    </div>
                    <button onClick={() => setEditingRoom(room)} className="tap rounded-lg bg-stone-100 dark:bg-stone-800 p-2 text-stone-600 dark:text-stone-300" title="Xonani tahrirlash"><Pencil className="h-4 w-4" /></button>
                  </div>
                  {room.activeSession && room.activeSession.outstandingAmount > 0 && (
                    <button
                      onClick={() => setPaymentTarget({ id: room.activeSession!.id, sessionId: room.activeSession!.id, label: room.name, outstanding: room.activeSession!.outstandingAmount })}
                      className="btn-primary mt-3 w-full py-2.5 text-xs"
                    ><Banknote className="h-4 w-4" /> To‘lov qabul qilish</button>
                  )}
                </div>
              ))}
            </section>
          )}

          {view === 'menu' && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="section-kicker">Taomlar va narxlar</h3>
                <button onClick={() => setAddingProduct(true)} className="tap flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-stone-100 dark:text-stone-900 px-2.5 py-2 text-[10px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> Taom qo‘shish</button>
              </div>
              {products.map((product) => (
                <div key={product.id} className="surface flex items-center gap-3 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
                    {menuImageFor(product) ? <img src={menuImageFor(product)!} alt={product.name} className="h-full w-full object-cover" /> : <ChefHat className="m-3 h-6 w-6 text-stone-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-stone-900 dark:text-stone-100">{product.name}</p>
                    <p className="mt-1 text-[10px] font-semibold text-stone-500 dark:text-stone-400">Narx {money(product.price)} · tannarx {money(product.costPrice ?? 0)} · foyda {money(product.price - (product.costPrice ?? 0))}</p>
                    <p className="text-[9px] text-stone-500">{product.categoryName ?? categories.find((category) => category.id === product.categoryId)?.name ?? ''} · {qty('1', product.unit)}</p>
                  </div>
                  <button onClick={() => setEditingProduct(product)} className="tap flex items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-400/10 px-2.5 py-2 text-[10px] font-bold text-sky-800 dark:text-sky-300"><Pencil className="h-3.5 w-3.5" /> Tahrir</button>
                </div>
              ))}
            </section>
          )}

          {view === 'payments' && (
            <section className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Metric label="Bugun qabul qilindi" value={money(payments.filter((payment) => !payment.reversedAt).reduce((sum, payment) => sum + payment.amount, 0))} tone="emerald" />
                <Metric label="To‘lovlar soni" value={String(payments.filter((payment) => !payment.reversedAt).length)} />
              </div>
              <h3 className="section-kicker px-1">Bugungi to‘lovlar</h3>
              {payments.length === 0 ? <Empty text="Bugun to‘lov bo‘lmagan" /> : payments.map((payment) => (
                <div key={payment.id} className="surface flex items-center gap-3 p-3">
                  <span className="icon-tile bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"><Banknote className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-stone-900 dark:text-stone-100">{money(payment.amount)} · {payment.methodName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-stone-500">{new Date(payment.createdAt).toLocaleString('uz-UZ')} · {payment.receivedByName}</p>
                  </div>
                  {payment.orderId && (
                    <button
                      onClick={async () => {
                        try { onShowReceipt(await api.getStaffOrder(token, payment.orderId!)); }
                        catch (err) { setError(err instanceof Error ? err.message : 'Chek ochilmadi'); }
                      }}
                      className="tap rounded-lg bg-stone-100 dark:bg-stone-800 p-2 text-stone-700 dark:text-stone-300"
                      title="Chekni chiqarish"
                    ><Printer className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </section>
          )}

          {view === 'handover' && (
            <section className="space-y-3">
              <div className="surface flex items-center justify-between p-4">
                <div><p className="text-[10px] font-bold uppercase text-stone-500">Kutilayotgan naqd</p><p className="mt-1 text-lg font-black text-emerald-700 dark:text-emerald-300">{money(pendingCash)}</p></div>
                <Banknote className="h-6 w-6 text-emerald-600" />
              </div>
              {pendingDeliveries.length === 0 ? <Empty text="Kuryerdan topshiriladigan pul yo‘q" /> : pendingDeliveries.map((delivery) => (
                <div key={delivery.id} className="surface overflow-hidden ring-1 ring-emerald-200/70 dark:ring-emerald-400/25">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-100 dark:border-emerald-400/25 bg-emerald-50/70 dark:bg-emerald-400/10 px-3.5 py-3">
                    <div><p className="text-xs font-black text-stone-900 dark:text-stone-100">Buyurtma #{delivery.orderNumber}</p><p className="text-[10px] text-stone-500 dark:text-stone-400">{delivery.customerName}</p></div>
                    <p className="font-black text-emerald-700 dark:text-emerald-300">{money(delivery.cashCollectedAmount ?? 0)}</p>
                  </div>
                  <div className="space-y-2 p-3.5">
                    <p className="text-[10px] text-stone-500 dark:text-stone-400">Kuryer: {delivery.assignedToName || '—'} · qoldiq {money(delivery.outstandingAmount)}</p>
                    <button onClick={() => void confirmHandover(delivery)} disabled={busy === `handover-${delivery.id}`} className="btn-primary w-full py-2.5 text-xs">
                      {busy === `handover-${delivery.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} To‘lov qilindi
                    </button>
                  </div>
                </div>
              ))}
              {deliveries.some((delivery) => delivery.cashHandedOverAt) && (
                <>
                  <h3 className="section-kicker px-1 pt-2">Yaqinda qabul qilingan</h3>
                  {deliveries.filter((delivery) => delivery.cashHandedOverAt).slice(0, 5).map((delivery) => (
                    <div key={delivery.id} className="surface flex items-center justify-between p-3 text-xs">
                      <span className="font-bold">#{delivery.orderNumber} · {delivery.customerName}</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-300">{money(delivery.cashCollectedAmount ?? 0)}</span>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}
        </>
      )}

      {editingRoom && (
        <EditOverlay title="Xonani tahrirlash" onClose={() => setEditingRoom(null)}>
          <form onSubmit={saveRoom} className="space-y-3">
            <input autoFocus value={editingRoom.name} onChange={(event) => setEditingRoom({ ...editingRoom, name: event.target.value })} className="field" />
            <OverlayActions onClose={() => setEditingRoom(null)} loading={busy === `room-${editingRoom.id}`} disabled={!editingRoom.name.trim()} />
          </form>
        </EditOverlay>
      )}

      {editingProduct && (
        <EditOverlay title="Taomni tahrirlash" onClose={() => setEditingProduct(null)}>
          <form onSubmit={saveProduct} className="space-y-2.5">
            <input value={editingProduct.name} onChange={(event) => setEditingProduct({ ...editingProduct, name: event.target.value })} placeholder="Taom nomi" className="field" />
            <select value={editingProduct.categoryId} onChange={(event) => setEditingProduct({ ...editingProduct, categoryId: event.target.value })} className="field">
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={editingProduct.unit} onChange={(event) => setEditingProduct({ ...editingProduct, unit: event.target.value as MeasurementUnit })} className="field">
              {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400">Sotuv narxi<input type="number" min="1" inputMode="numeric" value={editingProduct.price} onChange={(event) => setEditingProduct({ ...editingProduct, price: Number(event.target.value) })} className="field mt-1" /></label>
              <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400">Tannarx<input type="number" min="0" inputMode="numeric" value={editingProduct.costPrice ?? 0} onChange={(event) => setEditingProduct({ ...editingProduct, costPrice: Number(event.target.value) })} className="field mt-1" /></label>
            </div>
            <select value={editingProduct.status} onChange={(event) => setEditingProduct({ ...editingProduct, status: event.target.value as Product['status'] })} className="field">
              <option value="ACTIVE">Faol</option><option value="DISABLED">O‘chirilgan</option><option value="ARCHIVED">Arxivlangan</option>
            </select>
            <OverlayActions onClose={() => setEditingProduct(null)} loading={busy === `product-${editingProduct.id}`} disabled={!editingProduct.name.trim() || !editingProduct.categoryId || editingProduct.price <= 0} />
          </form>
        </EditOverlay>
      )}

      {addingProduct && (
        <EditOverlay title="Yangi taom qo‘shish" onClose={() => setAddingProduct(false)}>
          <form onSubmit={createProduct} className="space-y-2.5">
            <input autoFocus value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} placeholder="Taom nomi" className="field" />
            <select value={newProduct.categoryId} onChange={(event) => setNewProduct({ ...newProduct, categoryId: event.target.value })} className="field">
              <option value="">Kategoriya tanlang</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={newProduct.unit} onChange={(event) => setNewProduct({ ...newProduct, unit: event.target.value as MeasurementUnit })} className="field">
              {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400">Sotuv narxi<input type="number" min="1" inputMode="numeric" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} className="field mt-1" /></label>
              <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400">Bozor tannarxi<input type="number" min="0" inputMode="numeric" value={newProduct.costPrice} onChange={(event) => setNewProduct({ ...newProduct, costPrice: event.target.value })} className="field mt-1" /></label>
            </div>
            <OverlayActions
              onClose={() => setAddingProduct(false)}
              loading={busy === 'product-create'}
              disabled={!newProduct.name.trim() || !newProduct.categoryId || !(Number(newProduct.price) > 0) || Number(newProduct.costPrice || 0) < 0}
              submitLabel="Taom qo‘shish"
            />
          </form>
        </EditOverlay>
      )}

      {paymentTarget && (
        <EditOverlay title="To‘lov qabul qilish" onClose={() => setPaymentTarget(null)}>
          <form onSubmit={pay} className="space-y-3">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 p-3"><p className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">{paymentTarget.label}</p><p className="text-lg font-black">{money(paymentTarget.outstanding)}</p></div>
            <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400">Summa<input type="number" min="1" max={paymentTarget.outstanding} inputMode="numeric" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="field mt-1" /></label>
            <select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)} className="field">
              {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">{[0.5, 1].map((factor) => <button key={factor} type="button" onClick={() => setPaymentAmount(String(Math.round(paymentTarget.outstanding * factor)))} className="tap rounded-lg bg-stone-100 dark:bg-stone-800 px-3 py-2 text-[10px] font-bold">{factor === 1 ? 'To‘liq' : 'Yarmi'}</button>)}</div>
            <OverlayActions onClose={() => setPaymentTarget(null)} loading={busy === 'payment'} disabled={!paymentMethodId || Number(paymentAmount) <= 0 || Number(paymentAmount) > paymentTarget.outstanding} submitLabel="To‘lovni saqlash" />
          </form>
        </EditOverlay>
      )}
    </div>
  );
};

function Metric({ label, value, tone = 'stone' }: { label: string; value: string; tone?: 'stone' | 'emerald' | 'blue' | 'rose' }) {
  const tones = { stone: 'text-stone-900 dark:text-stone-100', emerald: 'text-emerald-700 dark:text-emerald-300', blue: 'text-sky-700 dark:text-sky-300', rose: 'text-rose-700 dark:text-rose-300' };
  return <div className="surface min-w-0 p-3"><p className="truncate text-[9px] font-bold uppercase text-stone-500">{label}</p><p className={`mt-1 truncate text-sm font-black ${tones[tone]}`}>{value}</p></div>;
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 px-3.5 py-3 text-xs"><span className="text-stone-500 dark:text-stone-400">{label}</span><span className="font-black text-stone-900 dark:text-stone-100">{value}</span></div>;
}

function OrderCard({ order, rooms, onPay, onReceipt }: { order: OrderDto; rooms: Room[]; onPay: (target: PaymentTarget) => void; onReceipt: (order: OrderDto) => void }) {
  const room = order.roomId ? rooms.find((item) => item.id === order.roomId) : undefined;
  const outstanding = order.type === 'DINE_IN' && room?.activeSession ? room.activeSession.outstandingAmount : order.outstandingAmount;
  const label = order.type === 'DINE_IN' ? room?.name ?? order.roomName ?? 'Zal buyurtmasi' : order.delivery?.customerName ?? 'Yetkazish';
  return (
    <div className="surface p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><p className="text-xs font-black text-stone-900 dark:text-stone-100">#{order.orderNumber} · {label}</p><span className="chip bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">{order.type === 'DINE_IN' ? 'Zal' : 'Yetkazish'}</span></div>
          <p className="mt-1 text-[10px] text-stone-500 dark:text-stone-400">{orderStatusLabel[order.status]} · {order.items.filter((item) => item.status !== 'CANCELLED').length} ta taom · {new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <p className="shrink-0 text-xs font-black text-stone-900 dark:text-stone-100">{money(order.totalAmount)}</p>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-2.5">
        <span className={`text-[10px] font-bold ${outstanding > 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-300'}`}>{outstanding > 0 ? `Qarz ${money(outstanding)}` : 'To‘langan'}</span>
        <div className="flex gap-1.5">
          {outstanding > 0 && order.status !== 'CANCELLED' && <button onClick={() => onPay({ id: order.id, sessionId: order.type === 'DINE_IN' ? room?.activeSession?.id : undefined, label, outstanding })} className="tap rounded-lg bg-emerald-50 dark:bg-emerald-400/10 px-2.5 py-2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300"><Banknote className="mr-1 inline h-3.5 w-3.5" />To‘lov</button>}
          <button onClick={() => onReceipt(order)} className="tap rounded-lg bg-stone-100 dark:bg-stone-800 px-2.5 py-2 text-[10px] font-bold text-stone-700 dark:text-stone-300" title="Chekni ko‘rish va chiqarish"><Printer className="mr-1 inline h-3.5 w-3.5" />Chek</button>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="surface flex flex-col items-center gap-2 py-10 text-stone-500"><ReceiptText className="h-6 w-6" /><p className="text-xs font-semibold">{text}</p></div>;
}

function EditOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/50 p-3 sm:items-center"><div className="w-full max-w-md rounded-3xl bg-[#fffdfa] dark:bg-[#151311] p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-black text-stone-900 dark:text-stone-100">{title}</h3><button onClick={onClose} className="tap rounded-xl bg-stone-100 dark:bg-stone-800 p-2 text-stone-500 dark:text-stone-400" aria-label="Yopish"><X className="h-4 w-4" /></button></div>{children}</div></div>;
}

function OverlayActions({ onClose, loading, disabled, submitLabel = 'Saqlash' }: { onClose: () => void; loading: boolean; disabled: boolean; submitLabel?: string }) {
  return <div className="grid grid-cols-2 gap-2 border-t border-stone-100 dark:border-stone-800 pt-3"><button type="button" onClick={onClose} className="btn-secondary py-3">Bekor qilish</button><button type="submit" disabled={disabled || loading} className="btn-primary py-3 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{submitLabel}</button></div>;
}