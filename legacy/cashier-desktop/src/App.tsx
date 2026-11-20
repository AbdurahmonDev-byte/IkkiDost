import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Truck,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import type { DeliveryDto, DeliveryStatus, OrderDto, PaymentDto, PaymentMethodDto, RoomSessionSummaryDto } from '@ikki-dost/shared-types';
import { TOKENS_REFRESHED, api, useAuth } from './lib/api';
import { useRealtime } from './lib/realtime';
import {
  deliveryStatusLabel,
  elapsed,
  formatDateTime,
  formatLongDate,
  formatQty,
  formatTime,
  formatUzs,
  isToday,
  orderStatusLabel,
  paymentKindLabel,
  uuid,
} from './lib/format';
import { OrderComposer, type ComposerMode } from './components/OrderComposer';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner, Textarea, cn } from './ui';

type Tab = 'rooms' | 'saboy' | 'delivery' | 'cash';

function startOfDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

interface SessionDetail extends RoomSessionSummaryDto {
  orders: OrderDto[];
  payments: PaymentDto[];
}

export default function App() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  if (!user) return <Login />;

  return (
    <Cashier
      onLogout={() => {
        clear();
      }}
    />
  );
}

function Login() {
  const setSession = useAuth((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ username: username.trim(), password });
      if (res.user.role !== 'CASHIER' && res.user.role !== 'OWNER') {
        setError('Bu dastur faqat kassir va ega uchun');
        return;
      }
      setSession({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70 md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-primary p-8 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Banknote size={22} />
            </div>
            <div>
              <p className="font-bold leading-tight">Ikki Do‘st</p>
              <p className="text-xs text-white/70">kassir dasturi</p>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-snug">Hisob-kitob,<br />to‘lov va chek.</h1>
            <p className="mt-2 text-sm text-white/70">Xona hisoblari, qismli to‘lovlar, qaytarishlar va yetkazish.</p>
          </div>
          <p className="text-[11px] text-white/50">© {new Date().getFullYear()} Ikki Do‘st</p>
        </div>

        <form onSubmit={submit} className="p-8">
          <h2 className="text-xl font-semibold">Kirish</h2>
          <p className="mt-1 text-sm text-ink-soft">Kassir yoki ega hisobi.</p>
          <div className="mt-5 space-y-3">
            <Field label="Login">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required />
            </Field>
            <Field label="Parol">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <Button type="submit" className="w-full" loading={loading}>
              Kirish
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Cashier({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState<Tab>('rooms');
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [addTarget, setAddTarget] = useState<OrderDto | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFor, setPaymentFor] = useState<{ kind: 'session' | 'order'; id: string; outstanding: number; label: string } | null>(null);
  const [receiptFor, setReceiptFor] = useState<{ kind: 'session' | 'order'; id: string } | null>(null);
  const [reverseTarget, setReverseTarget] = useState<PaymentDto | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [closeOverride, setCloseOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const notify = useCallback((m: string) => {
    setNotice(m);
    setTimeout(() => setNotice((cur) => (cur === m ? null : cur)), 4000);
  }, []);

  const onRealtime = useCallback(() => {
    void qc.invalidateQueries();
  }, [qc]);
  const { connected } = useRealtime(onRealtime);

  useEffect(() => {
    window.addEventListener(TOKENS_REFRESHED, onRealtime);
    return () => window.removeEventListener(TOKENS_REFRESHED, onRealtime);
  }, [onRealtime]);

  // The working day rolls over at midnight even if the app stays open.
  const [dayStart, setDayStart] = useState(() => startOfDay().toISOString());
  useEffect(() => {
    const id = setInterval(() => {
      const next = startOfDay().toISOString();
      setDayStart((cur) => (cur === next ? cur : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms(), refetchInterval: 15_000 });
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: () => api.orders(), refetchInterval: 15_000 });
  const methodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.paymentMethods() });
  // No upper bound: payments made after the app was opened must show up too.
  const paymentsQuery = useQuery({
    queryKey: ['payments-today', dayStart],
    queryFn: () => api.payments({ from: dayStart }),
    refetchInterval: 20_000,
  });
  const deliveriesQuery = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api.deliveries(),
    refetchInterval: 20_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['session', selectedSession],
    queryFn: () => api.roomSession(selectedSession!) as Promise<SessionDetail>,
    enabled: !!selectedSession,
  });
  const orderQuery = useQuery({
    queryKey: ['order', selectedOrder],
    queryFn: () => api.order(selectedOrder!),
    enabled: !!selectedOrder,
  });
  // Payments of the selected saboy/delivery order, including earlier days.
  const orderCreatedAt = orderQuery.data?.createdAt;
  const orderPaymentsQuery = useQuery({
    queryKey: ['order-payments', selectedOrder, orderCreatedAt],
    queryFn: () => api.payments({ from: startOfDay(new Date(orderCreatedAt!)).toISOString() }),
    enabled: !!selectedOrder && !!orderCreatedAt,
  });

  const methods = methodsQuery.data ?? [];
  const cashPending = (deliveriesQuery.data ?? [])
    .filter((d) => d.status === 'DELIVERED' && (d.cashCollectedAmount ?? 0) > 0 && !d.cashHandedOverAt)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const todayTotals = useMemo(() => {
    const totals = { cash: 0, card: 0, other: 0, count: 0 };
    for (const p of paymentsQuery.data ?? []) {
      if (p.reversedAt) continue;
      totals.count += 1;
      if (p.methodKind === 'CASH') totals.cash += p.amount;
      else if (p.methodKind === 'CARD') totals.card += p.amount;
      else totals.other += p.amount;
    }
    return totals;
  }, [paymentsQuery.data]);
  const roomBills = (roomsQuery.data ?? []).filter((r) => r.activeSession && r.isActive);
  const deliveryBills = (ordersQuery.data ?? [])
    .filter((o) => o.type === 'DELIVERY' && o.outstandingAmount > 0 && o.status !== 'CANCELLED')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const saboyOrders = (ordersQuery.data ?? [])
    .filter(
      (o) =>
        o.type === 'DELIVERY' &&
        o.status !== 'CANCELLED' &&
        (isToday(o.createdAt) || o.outstandingAmount > 0),
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const invalidateAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['rooms'] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['session'] });
    void qc.invalidateQueries({ queryKey: ['order'] });
    void qc.invalidateQueries({ queryKey: ['payments-today'] });
    void qc.invalidateQueries({ queryKey: ['order-payments'] });
    void qc.invalidateQueries({ queryKey: ['deliveries'] });
  }, [qc]);

  const payMutation = useMutation({
    mutationFn: (v: { kind: 'session' | 'order'; id: string; amount: number; methodId: string; note?: string; idempotencyKey: string }) =>
      v.kind === 'session'
        ? api.payRoomSession(v.id, { amount: v.amount, methodId: v.methodId, note: v.note || null, idempotencyKey: v.idempotencyKey })
        : api.payOrder(v.id, { amount: v.amount, methodId: v.methodId, note: v.note || null, idempotencyKey: v.idempotencyKey }),
    onSuccess: (payment) => {
      setPaymentFor(null);
      notify(`To‘lov qabul qilindi: ${formatUzs(payment.amount)}`);
      invalidateAll();
    },
    onError: (e) => notify(e instanceof Error ? e.message : 'To‘lov amalga oshmadi'),
  });

  const reverseMutation = useMutation({
    mutationFn: () => api.reversePayment(reverseTarget!.id, { reason: reverseReason.trim() }),
    onSuccess: () => {
      setReverseTarget(null);
      setReverseReason('');
      notify('To‘lov qaytarildi');
      invalidateAll();
    },
    onError: (e) => notify(e instanceof Error ? e.message : 'Qaytarib bo‘lmadi'),
  });

  const closeMutation = useMutation({
    mutationFn: (v: { sessionId: string; overrideReason?: string }) => api.closeRoomSession(v.sessionId, { overrideReason: v.overrideReason }),
    onSuccess: () => {
      setCloseOverride(false);
      setOverrideReason('');
      setSelectedSession(null);
      notify('Sessiya yopildi');
      invalidateAll();
    },
    onError: (e) => notify(e instanceof Error ? e.message : 'Sessiyani yopib bo‘lmadi'),
  });

  const deliveryMutation = useMutation({
    mutationFn: (v: { id: string; status: DeliveryStatus }) => api.updateDeliveryStatus(v.id, { status: v.status }),
    onSuccess: () => {
      notify('Yetkazish holati yangilandi');
      invalidateAll();
    },
    onError: (e) => notify(e instanceof Error ? e.message : 'Yangilanmadi'),
  });

  const handoverMutation = useMutation({
    mutationFn: (d: DeliveryDto) => api.handoverDeliveryCash(d.id),
    onSuccess: (d) => {
      notify(`To‘lov qilindi: #${d.orderNumber} · ${formatUzs(d.cashCollectedAmount ?? 0)} kassaga qabul qilindi`);
      invalidateAll();
    },
    onError: (e) => notify(e instanceof Error ? e.message : 'Naqdni qabul qilib bo‘lmadi'),
  });

  const session = sessionQuery.data;
  const delivery = orderQuery.data;

  // The session detail already carries every payment of the session.
  const sessionPayments = session?.payments ?? [];

  const deliveryPayments = useMemo(() => {
    if (!delivery) return [];
    return (orderPaymentsQuery.data ?? []).filter((p) => p.orderId === delivery.id);
  }, [delivery, orderPaymentsQuery.data]);
  const deliveryCashPending = delivery?.delivery
    ? cashPending.find((d) => d.id === delivery.delivery!.id) ?? null
    : null;

  const filterRoom = (name: string) => !search.trim() || name.toLowerCase().includes(search.trim().toLowerCase());
  const filteredRooms = roomBills.filter((r) => filterRoom(r.name));
  const matchesSearch = (o: OrderDto) =>
    !search.trim() ||
    (o.delivery?.customerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (o.delivery?.customerPhone ?? '').includes(search);
  const filteredDeliveries = deliveryBills.filter(matchesSearch);
  const filteredSaboy = saboyOrders.filter(matchesSearch);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <Banknote size={18} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Ikki Do‘st — Kassir</p>
          <p className="text-[11px] text-ink-faint">{formatLongDate(new Date())}</p>
        </div>
        <div className="ml-6 hidden items-center gap-4 rounded-xl bg-paper px-3 py-1.5 text-xs lg:flex" title="Bugun qabul qilingan to‘lovlar">
          <span className="text-ink-faint">Bugun:</span>
          <span className="flex items-center gap-1"><Banknote size={13} className="text-emerald-600" /> {formatUzs(todayTotals.cash)}</span>
          <span className="flex items-center gap-1"><CreditCard size={13} className="text-sky-600" /> {formatUzs(todayTotals.card)}</span>
          {todayTotals.other > 0 && <span>Boshqa: {formatUzs(todayTotals.other)}</span>}
          <span className="font-bold text-ink">Jami: {formatUzs(todayTotals.cash + todayTotals.card + todayTotals.other)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-500')} />
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? 'Online' : 'Qayta ulanish'}
          </span>
          <div className="text-right">
            <p className="text-xs font-semibold leading-tight">{user.fullName}</p>
            <p className="text-[10px] text-ink-faint">@{user.username}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} title="Chiqish">
            <LogOut size={15} />
          </Button>
        </div>
      </header>

      {notice && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{notice}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-line bg-paper/60">
          <div className="border-b border-line bg-white/70 p-3">
            <div className="flex gap-1">
              <TabButton active={tab === 'rooms'} onClick={() => setTab('rooms')} icon={<DoorOpen size={14} />} label="Zallar" count={roomBills.length} />
              <TabButton active={tab === 'saboy'} onClick={() => setTab('saboy')} icon={<Phone size={14} />} label="Saboy" count={saboyOrders.length} />
              <TabButton active={tab === 'delivery'} onClick={() => setTab('delivery')} icon={<Truck size={14} />} label="Yetkazish" count={deliveryBills.length} />
              <TabButton active={tab === 'cash'} onClick={() => setTab('cash')} icon={<Banknote size={14} />} label="Kuryer" count={cashPending.length} />
            </div>
            {(tab === 'rooms' || tab === 'saboy') && (
              <Button
                size="sm"
                className="mt-2.5 w-full"
                onClick={() => setComposerMode(tab === 'saboy' ? 'DELIVERY' : 'DINE_IN')}
              >
                <Plus size={14} /> {tab === 'saboy' ? 'Yangi saboy' : 'Yangi buyurtma'}
              </Button>
            )}
            <div className="relative mt-2.5">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Xona yoki mijoz…" className="h-9 pl-8 text-xs" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {roomsQuery.isLoading || ordersQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : tab === 'cash' ? (
              cashPending.length === 0 ? (
                <Empty title="Topshiriladigan naqd yo‘q" hint="Kuryer yetkazib, naqd pulni qayd etganda shu yerda chiqadi." />
              ) : (
                <div className="space-y-2">
                  {cashPending.map((d) => (
                    <div key={d.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-line/70">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">#{d.orderNumber} · {d.customerName}</p>
                        <span className="text-sm font-bold text-emerald-700">{formatUzs(d.cashCollectedAmount ?? 0)}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        Kuryer: {d.assignedToName ?? '—'}
                        {d.cashCollectedAt ? ` · ${formatTime(d.cashCollectedAt)}` : ''}
                      </p>
                      <Button
                        size="sm"
                        variant="success"
                        className="mt-2 w-full"
                        loading={handoverMutation.isPending && handoverMutation.variables?.id === d.id}
                        onClick={() => {
                          if (window.confirm(`Kuryer ${formatUzs(d.cashCollectedAmount ?? 0)} naqd pulni topshirdimi?`)) {
                            handoverMutation.mutate(d);
                          }
                        }}
                      >
                        <CheckCircle2 size={14} /> To‘lov qilindi
                      </Button>
                    </div>
                  ))}
                </div>
              )
            ) : tab === 'rooms' ? (
              filteredRooms.length === 0 ? (
                <Empty title="Faol xona yo‘q" hint="«Yangi buyurtma» tugmasi bilan zalga buyurtma oching." />
              ) : (
                <div className="space-y-2">
                  {filteredRooms.map((r) => {
                    const s = r.activeSession!;
                    const active = selectedSession === s.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedOrder(null);
                          setSelectedSession(s.id);
                        }}
                        className={cn(
                          'w-full rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition',
                          active ? 'ring-2 ring-primary' : 'ring-line/70 hover:ring-primary/40',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{r.name}</p>
                          <Badge tone={s.outstandingAmount > 0 ? 'amber' : 'green'}>
                            {s.outstandingAmount > 0 ? 'Qarz bor' : 'To‘langan'}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-ink-soft">
                          <span>{s.orderCount} buyurtma · {elapsed(s.openedAt)}</span>
                          <span className="font-semibold text-ink">{formatUzs(s.totalAmount)}</span>
                        </div>
                        {s.outstandingAmount > 0 && (
                          <p className="mt-1 text-right text-[11px] font-semibold text-red-600">Qarz: {formatUzs(s.outstandingAmount)}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            ) : tab === 'saboy' ? (
              filteredSaboy.length === 0 ? (
                <Empty
                  title="Saboy yo‘q"
                  hint="Uydan telefon orqali buyurtma qabul qilinganda «Yangi saboy» bilan yozing."
                />
              ) : (
                <div className="space-y-2">
                  {filteredSaboy.map((o) => (
                    <DeliveryCard
                      key={o.id}
                      order={o}
                      active={selectedOrder === o.id}
                      onSelect={() => {
                        setSelectedSession(null);
                        setSelectedOrder(o.id);
                      }}
                    />
                  ))}
                </div>
              )
            ) : filteredDeliveries.length === 0 ? (
              <Empty title="Yetkazish buyurtmasi yo‘q" hint="To‘lanmagan saboylar shu yerda kuryerga beriladi." />
            ) : (
              <div className="space-y-2">
                {filteredDeliveries.map((o) => (
                  <DeliveryCard
                    key={o.id}
                    order={o}
                    active={selectedOrder === o.id}
                    onSelect={() => {
                      setSelectedSession(null);
                      setSelectedOrder(o.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {selectedSession && session ? (
            <SessionView
              session={session}
              payments={sessionPayments}
              userRole={user.role}
              onPay={() => setPaymentFor({ kind: 'session', id: session.id, outstanding: session.outstandingAmount, label: `Sessiya · ${session.orderCount} buyurtma` })}
              onReceipt={() => setReceiptFor({ kind: 'session', id: session.id })}
              onAddItems={(o) => setAddTarget(o)}
              onReverse={(p) => setReverseTarget(p)}
              onClose={() => {
                if (session.outstandingAmount > 0) setCloseOverride(true);
                else closeMutation.mutate({ sessionId: session.id });
              }}
              closing={closeMutation.isPending}
            />
          ) : selectedOrder && delivery ? (
            <DeliveryView
              order={delivery}
              payments={deliveryPayments}
              onPay={() => setPaymentFor({ kind: 'order', id: delivery.id, outstanding: delivery.outstandingAmount, label: `Buyurtma #${delivery.orderNumber}` })}
              onReceipt={() => setReceiptFor({ kind: 'order', id: delivery.id })}
              onAddItems={() => setAddTarget(delivery)}
              onReverse={(p) => setReverseTarget(p)}
              onStatus={(status) => deliveryMutation.mutate({ id: delivery.delivery!.id, status })}
              busy={deliveryMutation.isPending}
              cashPending={deliveryCashPending}
              onHandover={(d) => handoverMutation.mutate(d)}
              handoverBusy={handoverMutation.isPending}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-soft">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-line/70">
                <ReceiptText size={28} className="text-primary" />
              </div>
              <p className="text-base font-semibold text-ink">Hisobni tanlang yoki buyurtma yarating</p>
              <p className="max-w-sm text-sm">
                Chapdan xona yoki saboyni tanlang — hisob, to‘lov va chek shu yerda. Yangi zal buyurtmasi
                «Yangi buyurtma», uydan qilingan qo‘ng‘iroq esa «Yangi saboy» orqali yoziladi.
              </p>
            </div>
          )}
        </main>
      </div>

      <PaymentModal
        target={paymentFor}
        methods={methods}
        onClose={() => setPaymentFor(null)}
        pay={payMutation.mutate}
        loading={payMutation.isPending}
      />

      <Modal open={!!reverseTarget} onClose={() => setReverseTarget(null)} title="To‘lovni qaytarish">
        <p className="text-sm text-ink-soft">
          {reverseTarget ? `${formatUzs(reverseTarget.amount)} · ${reverseTarget.methodName}` : ''} qaytariladi. Sabab audit jurnaliga yoziladi.
        </p>
        <div className="mt-3">
          <Field label="Sabab">
            <Textarea value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="Masalan: xato to‘lov" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReverseTarget(null)}>
            Yopish
          </Button>
          <Button variant="danger" loading={reverseMutation.isPending} disabled={reverseReason.trim().length < 2} onClick={() => reverseMutation.mutate()}>
            Qaytarish
          </Button>
        </div>
      </Modal>

      <Modal open={closeOverride} onClose={() => setCloseOverride(false)} title="Qarz bilan yopish">
        <p className="text-sm text-ink-soft">
          Sessiyada qarz bor. Qarz bilan yopish uchun sabab kiriting — sabab audit jurnaliga yoziladi.
        </p>
        <div className="mt-3">
          <Field label="Sabab (majburiy)">
            <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCloseOverride(false)}>
            Bekor qilish
          </Button>
          <Button
            variant="danger"
            loading={closeMutation.isPending}
            disabled={overrideReason.trim().length < 3 || !selectedSession}
            onClick={() => selectedSession && closeMutation.mutate({ sessionId: selectedSession, overrideReason: overrideReason.trim() })}
          >
            Yopish
          </Button>
        </div>
      </Modal>

      {receiptFor && (
        <ReceiptModal
          target={receiptFor}
          session={session}
          order={delivery}
          sessionPayments={sessionPayments}
          deliveryPayments={deliveryPayments}
          onClose={() => setReceiptFor(null)}
        />
      )}

      {(composerMode || addTarget) && (
        <OrderComposer
          mode={composerMode ?? (addTarget?.type === 'DELIVERY' ? 'DELIVERY' : 'DINE_IN')}
          rooms={roomsQuery.data ?? []}
          targetOrder={addTarget ?? undefined}
          onClose={() => {
            setComposerMode(null);
            setAddTarget(null);
          }}
          onCreated={(order) => {
            const wasAdding = Boolean(addTarget);
            setComposerMode(null);
            setAddTarget(null);
            setSearch('');
            invalidateAll();
            if (wasAdding) {
              notify(`#${order.orderNumber} buyurtmaga mahsulot qo‘shildi`);
              return;
            }
            notify(`Buyurtma #${order.orderNumber} yaratildi`);
            if (order.type === 'DELIVERY') {
              setTab('saboy');
              setSelectedSession(null);
              setSelectedOrder(order.id);
            } else {
              setTab('rooms');
              setSelectedOrder(null);
              setSelectedSession(order.roomSessionId);
            }
          }}
        />
      )}
    </div>
  );
}

function DeliveryCard({ order, active, onSelect }: { order: OrderDto; active: boolean; onSelect: () => void }) {
  const d = order.delivery;
  const status = (d?.status ?? 'PENDING') as DeliveryStatus;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition',
        active ? 'ring-2 ring-primary' : 'ring-line/70 hover:ring-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{d?.customerName ?? 'Mijoz'}</p>
        <Badge tone={order.outstandingAmount > 0 ? 'amber' : 'green'}>#{order.orderNumber}</Badge>
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft">
        <Phone size={10} /> {d?.customerPhone}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-ink-soft">
          {formatTime(order.createdAt)} · {deliveryStatusLabel[status]}
        </span>
        <span className={cn('shrink-0 font-semibold', order.outstandingAmount > 0 ? 'text-red-600' : 'text-emerald-700')}>
          {order.outstandingAmount > 0 ? formatUzs(order.outstandingAmount) : 'To‘langan'}
        </span>
      </div>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold',
        active ? 'bg-primary text-white' : 'bg-white text-ink-soft ring-1 ring-line',
      )}
    >
      {icon} {label}
      <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-white/20' : 'bg-paper')}>{count}</span>
    </button>
  );
}

function SessionView({
  session,
  payments,
  userRole,
  onPay,
  onReceipt,
  onAddItems,
  onReverse,
  onClose,
  closing,
}: {
  session: SessionDetail;
  payments: PaymentDto[];
  userRole: string;
  onPay: () => void;
  onReceipt: () => void;
  onAddItems: (order: OrderDto) => void;
  onReverse: (p: PaymentDto) => void;
  onClose: () => void;
  closing: boolean;
}) {
  return (
    <Card className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Xona hisobi</h2>
          <p className="text-xs text-ink-soft">{session.orderCount} buyurtma · ochilgan {formatDateTime(session.openedAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReceipt}>
            <Printer size={15} /> Chek
          </Button>
          <Button variant="secondary" onClick={onPay} disabled={session.outstandingAmount <= 0}>
            <CreditCard size={15} /> To‘lov
          </Button>
          <Button variant="success" loading={closing} onClick={onClose} disabled={session.outstandingAmount > 0 && userRole !== 'OWNER' && userRole !== 'CASHIER'}>
            <CheckCircle2 size={15} /> Yopish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line bg-paper/40">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-ink-faint">Jami</p>
          <p className="text-lg font-bold">{formatUzs(session.totalAmount)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-ink-faint">To‘langan</p>
          <p className="text-lg font-bold text-emerald-700">{formatUzs(session.paidAmount)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-ink-faint">Qarz</p>
          <p className={cn('text-lg font-bold', session.outstandingAmount > 0 ? 'text-red-600' : 'text-emerald-700')}>
            {formatUzs(session.outstandingAmount)}
          </p>
        </div>
      </div>

      {session.outstandingAmount > 0 && (
        <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
          Qarz mavjud — avval to‘liq to‘lov qiling yoki «Yopish» orqali sabab ko‘rsatib qarz bilan yoping.
        </p>
      )}

      <div className="divide-y divide-line/60">
        {session.orders.map((o) => (
          <div key={o.id} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold">#{o.orderNumber}</span>
              <Badge tone={o.status === 'COMPLETED' ? 'neutral' : 'amber'}>{orderStatusLabel[o.status]}</Badge>
              <span className="text-[11px] text-ink-faint">{formatTime(o.createdAt)} · {o.createdByName}</span>
              {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                <button
                  onClick={() => onAddItems(o)}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50"
                  title="Bu buyurtmaga mahsulot qo‘shish"
                >
                  <Plus size={11} /> Qo‘shish
                </button>
              )}
              <span className={cn('text-sm font-semibold', o.status === 'CANCELLED' || o.status === 'COMPLETED' ? 'ml-auto' : '')}>
                {formatUzs(o.totalAmount)}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {o.items
                .filter((i) => i.status !== 'CANCELLED')
                .map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-xs text-ink-soft">
                    <span className="min-w-0 flex-1 truncate">{i.productName}</span>
                    <span>{formatQty(i.quantity, i.productUnit)}</span>
                    <span className="w-20 text-right">{formatUzs(i.lineTotal)}</span>
                  </li>
                ))}
            </ul>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-ink-faint">
              <span>Mahsulotlar: {formatUzs(o.itemsTotal)}</span>
              <span>Xizmat haqi: {formatUzs(o.serviceFeeAmount)}</span>
              {o.note && <span>Izoh: {o.note}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-5 py-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">To‘lovlar</p>
        {payments.length === 0 ? (
          <p className="text-xs text-ink-soft">Hali to‘lov qilinmagan.</p>
        ) : (
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{formatUzs(p.amount)}</span>
                <span className="text-ink-soft">{p.methodName}</span>
                <span className="text-ink-faint">{formatTime(p.createdAt)}</span>
                {p.reversedAt ? (
                  <Badge tone="red">Qaytarilgan</Badge>
                ) : (
                  <button onClick={() => onReverse(p)} className="ml-auto rounded p-1 text-red-500 hover:bg-red-50" title="Qaytarish">
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const NEXT_STATUS: Partial<Record<DeliveryStatus, { to: DeliveryStatus; label: string }>> = {
  PENDING: { to: 'CONFIRMED', label: 'Tasdiqlash' },
  CONFIRMED: { to: 'PREPARING', label: 'Tayyorlash' },
  PREPARING: { to: 'READY', label: 'Tayyor' },
  READY: { to: 'OUT_FOR_DELIVERY', label: 'Yo‘lga chiqdi' },
  OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Yetkazildi' },
};

function DeliveryView({
  order,
  payments,
  onPay,
  onReceipt,
  onAddItems,
  onReverse,
  onStatus,
  busy,
  cashPending,
  onHandover,
  handoverBusy,
}: {
  order: OrderDto;
  payments: PaymentDto[];
  onPay: () => void;
  onReceipt: () => void;
  onAddItems: () => void;
  onReverse: (p: PaymentDto) => void;
  onStatus: (s: DeliveryStatus) => void;
  busy: boolean;
  cashPending: DeliveryDto | null;
  onHandover: (d: DeliveryDto) => void;
  handoverBusy: boolean;
}) {
  const d = order.delivery!;
  const next = NEXT_STATUS[d.status];
  return (
    <Card className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck size={18} /> Buyurtma #{order.orderNumber}
          </h2>
          <p className="text-xs text-ink-soft">{d.customerName} · {d.customerPhone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <Button variant="secondary" onClick={onAddItems}>
              <Plus size={15} /> Qo‘shish
            </Button>
          )}
          <Button variant="secondary" onClick={onReceipt}>
            <Printer size={15} /> Chek
          </Button>
          <Button variant="secondary" onClick={onPay} disabled={order.outstandingAmount <= 0}>
            <CreditCard size={15} /> To‘lov
          </Button>
          {next && (
            <Button variant="success" loading={busy} onClick={() => onStatus(next.to)}>
              {next.label}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line bg-paper/40">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-ink-faint">Jami</p>
          <p className="text-lg font-bold">{formatUzs(order.totalAmount)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-ink-faint">To‘langan</p>
          <p className="text-lg font-bold text-emerald-700">{formatUzs(order.paidAmount)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-ink-faint">Qarz</p>
          <p className={cn('text-lg font-bold', order.outstandingAmount > 0 ? 'text-red-600' : 'text-emerald-700')}>{formatUzs(order.outstandingAmount)}</p>
        </div>
      </div>

      {cashPending && (
        <div className="flex flex-wrap items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm">
          <Banknote size={16} className="text-emerald-700" />
          <span className="flex-1 text-emerald-900">
            Kuryer {cashPending.assignedToName ?? ''} naqd <b>{formatUzs(cashPending.cashCollectedAmount ?? 0)}</b> oldi — kassaga topshirilmagan.
          </span>
          <Button size="sm" variant="success" loading={handoverBusy} onClick={() => onHandover(cashPending)}>
            <CheckCircle2 size={14} /> To‘lov qilindi
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5 text-xs">
        <Badge tone={d.status === 'DELIVERED' ? 'green' : d.status === 'CANCELLED' ? 'red' : 'amber'}>{deliveryStatusLabel[d.status]}</Badge>
        <span className="flex items-center gap-1 text-ink-soft"><MapPin size={12} /> {d.address}</span>
        {d.status !== 'DELIVERED' && d.status !== 'CANCELLED' && (
          <button onClick={() => onStatus('CANCELLED')} className="ml-auto flex items-center gap-1 text-red-500 hover:underline">
            <XCircle size={12} /> Bekor qilish
          </button>
        )}
      </div>

      <div className="divide-y divide-line/60">
        <div className="px-5 py-3">
          <ul className="space-y-1.5">
            {order.items
              .filter((i) => i.status !== 'CANCELLED')
              .map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.productName}</span>
                  <span className="text-xs text-ink-soft">{formatQty(i.quantity, i.productUnit)}</span>
                  <span className="w-24 text-right font-medium">{formatUzs(i.lineTotal)}</span>
                </li>
              ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-ink-faint">
            <span>Mahsulotlar: {formatUzs(order.itemsTotal)}</span>
            <span>Xizmat haqi: {formatUzs(order.serviceFeeAmount)}</span>
            {order.note && <span>Izoh: {order.note}</span>}
          </div>
        </div>
      </div>

      <div className="border-t border-line px-5 py-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">To‘lovlar</p>
        {payments.length === 0 ? (
          <p className="text-xs text-ink-soft">Hali to‘lov qilinmagan.</p>
        ) : (
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{formatUzs(p.amount)}</span>
                <span className="text-ink-soft">{p.methodName}</span>
                <span className="text-ink-faint">{formatTime(p.createdAt)}</span>
                {p.reversedAt ? (
                  <Badge tone="red">Qaytarilgan</Badge>
                ) : (
                  <button onClick={() => onReverse(p)} className="ml-auto rounded p-1 text-red-500 hover:bg-red-50">
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PaymentModal({
  target,
  methods,
  onClose,
  pay,
  loading,
}: {
  target: { kind: 'session' | 'order'; id: string; outstanding: number; label: string } | null;
  methods: PaymentMethodDto[];
  onClose: () => void;
  pay: (v: { kind: 'session' | 'order'; id: string; amount: number; methodId: string; note?: string; idempotencyKey: string }) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [note, setNote] = useState('');
  const keyRef = useRef('');

  useEffect(() => {
    if (!target) return;
    setAmount(String(target.outstanding));
    setNote('');
    keyRef.current = uuid();
    const preferred = methods.find((m) => m.kind === 'CASH' && m.isActive) ?? methods.find((m) => m.isActive);
    setMethodId(preferred?.id ?? '');
  }, [target, methods]);

  if (!target) return null;
  const numeric = Number(amount);
  const remainingAfter = target.outstanding - (Number.isFinite(numeric) ? numeric : 0);

  return (
    <Modal open onClose={onClose} title="To‘lov qabul qilish">
      <div className="space-y-3">
        <div className="rounded-xl bg-paper px-4 py-3">
          <p className="text-xs text-ink-soft">{target.label}</p>
          <p className="mt-0.5 text-xl font-bold">{formatUzs(target.outstanding)}</p>
          <p className="text-[11px] text-ink-faint">Qolgan qarz</p>
        </div>

        <Field label="Summa (so‘m)" hint={remainingAfter > 0 ? `Qismli to‘lov · qoladi ${formatUzs(remainingAfter)}` : 'To‘liq to‘lov'}>
          <Input type="number" min={1} max={target.outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Tez tanlash</p>
          <div className="flex flex-wrap gap-1.5">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <Button key={f} size="sm" variant="secondary" onClick={() => setAmount(String(Math.round(target.outstanding * f)))}>
                {f === 1 ? 'To‘liq' : `${f * 100}%`}
              </Button>
            ))}
          </div>
        </div>

        <Field label="To‘lov usuli">
          <Select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            {methods.filter((m) => m.isActive).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({paymentKindLabel[m.kind]})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Izoh (ixtiyoriy)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: mijoz kartadan to‘ladi" />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={loading}
            disabled={!methodId || !(numeric > 0) || numeric > target.outstanding}
            onClick={() =>
              pay({ kind: target.kind, id: target.id, amount: numeric, methodId, note: note.trim() || undefined, idempotencyKey: keyRef.current })
            }
          >
            <Banknote size={15} /> Qabul qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptModal({
  target,
  session,
  order,
  sessionPayments,
  deliveryPayments,
  onClose,
}: {
  target: { kind: 'session' | 'order'; id: string };
  session?: SessionDetail;
  order?: OrderDto;
  sessionPayments: PaymentDto[];
  deliveryPayments: PaymentDto[];
  onClose: () => void;
}) {
  const now = new Date();
  const items =
    target.kind === 'session'
      ? (session?.orders ?? []).flatMap((o) =>
          o.items.filter((i) => i.status !== 'CANCELLED').map((i) => ({ name: i.productName, qty: formatQty(i.quantity, i.productUnit), total: i.lineTotal })),
        )
      : (order?.items ?? []).filter((i) => i.status !== 'CANCELLED').map((i) => ({ name: i.productName, qty: formatQty(i.quantity, i.productUnit), total: i.lineTotal }));

  const itemsTotal = target.kind === 'session' ? (session?.orders.reduce((s, o) => s + o.itemsTotal, 0) ?? 0) : (order?.itemsTotal ?? 0);
  const fee = target.kind === 'session' ? (session?.orders.reduce((s, o) => s + o.serviceFeeAmount, 0) ?? 0) : (order?.serviceFeeAmount ?? 0);
  const total = target.kind === 'session' ? (session?.totalAmount ?? 0) : (order?.totalAmount ?? 0);
  const paid = target.kind === 'session' ? (session?.paidAmount ?? 0) : (order?.paidAmount ?? 0);
  const outstanding = target.kind === 'session' ? (session?.outstandingAmount ?? 0) : (order?.outstandingAmount ?? 0);
  const payments = target.kind === 'session' ? sessionPayments : deliveryPayments;

  return (
    <Modal open onClose={onClose} title="Chek" wide>
      <div className="mx-auto max-w-md">
        <div id="receipt-print" className="rounded-xl border border-dashed border-line bg-white p-5 font-mono text-[12px] text-ink">
          <div className="text-center">
            <p className="text-base font-bold tracking-wide">IKKI DO‘ST CHOYXONASI</p>
            <p className="text-[10px] text-ink-soft">Hisob-kitob cheki</p>
            <p className="mt-1 text-[10px]">{formatDateTime(now.toISOString())}</p>
          </div>
          <div className="my-2 border-t border-dashed border-ink/30" />
          <div className="flex justify-between text-[11px]">
            <span>{target.kind === 'session' ? `Xona sessiyasi` : `Buyurtma #${order?.orderNumber}`}</span>
            <span>{target.kind === 'session' ? `${session?.orderCount ?? 0} buyurtma` : order?.delivery?.customerName}</span>
          </div>
          {target.kind === 'order' && order?.delivery && (
            <p className="mt-0.5 text-[10px] text-ink-soft">
              {order.delivery.customerPhone} · {order.delivery.address}
            </p>
          )}
          <div className="my-2 border-t border-dashed border-ink/30" />
          <div className="space-y-1">
            {items.map((i, idx) => (
              <div key={idx} className="flex gap-2 text-[11px]">
                <span className="min-w-0 flex-1">{i.name}</span>
                <span className="w-14 text-right text-ink-soft">{i.qty}</span>
                <span className="w-20 text-right">{formatUzs(i.total)}</span>
              </div>
            ))}
          </div>
          <div className="my-2 border-t border-dashed border-ink/30" />
          <Row label="Mahsulotlar" value={formatUzs(itemsTotal)} />
          <Row label="Xizmat haqi" value={formatUzs(fee)} />
          <div className="my-1 border-t border-dashed border-ink/30" />
          <Row label="JAMI" value={formatUzs(total)} bold />
          <Row label="To‘langan" value={formatUzs(paid)} />
          <Row label="Qarz" value={formatUzs(outstanding)} bold />
          {payments.length > 0 && (
            <>
              <div className="my-2 border-t border-dashed border-ink/30" />
              <p className="text-[10px] font-bold">TO‘LOVLAR</p>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-[10px]">
                  <span>{p.methodName} · {formatTime(p.createdAt)}</span>
                  <span>{formatUzs(p.amount)}</span>
                </div>
              ))}
            </>
          )}
          <div className="my-3 border-t border-dashed border-ink/30" />
          <p className="text-center text-[10px]">Xaridingiz uchun rahmat!</p>
          <p className="text-center text-[9px] text-ink-soft">Ikki Do‘st choyxonasi</p>
        </div>

        <div className="no-print mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Yopish
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={15} /> Chop etish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between text-[11px]', bold && 'text-sm font-bold')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
