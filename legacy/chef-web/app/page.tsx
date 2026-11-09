'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  ChefHat,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  LogOut,
  RefreshCw,
  Truck,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { OrderDto, OrderItemDto, OrderItemStatus } from '@ikki-dost/shared-types';

/** Statuses the API accepts from the kitchen (see itemStatusSchema). */
type KitchenItemStatus = Extract<OrderItemStatus, 'PREPARING' | 'READY' | 'SERVED'>;
import { api, useAuth } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { currentPushState, enablePush, pushSupported, type PushState } from '@/lib/push';
import { clockTime, itemStatusLabel, playChime, timeAgo, unitLabel } from '@/lib/format';

const filters = [
  { key: 'ALL', label: 'Barchasi' },
  { key: 'PENDING', label: 'Yangi' },
  { key: 'PREPARING', label: 'Tayyorlanmoqda' },
  { key: 'READY', label: 'Tayyor' },
] as const;

type FilterKey = (typeof filters)[number]['key'];

function isActiveItem(item: OrderItemDto) {
  return item.status === 'PENDING' || item.status === 'PREPARING';
}

export default function KitchenPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const hydrated = useAuth.persist?.hasHydrated?.() ?? true;

  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [pushState, setPushState] = useState<PushState>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const knownOrders = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  // Auth guard.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'CHEF' && user.role !== 'OWNER') router.replace('/login');
  }, [hydrated, user, router]);

  const ordersQuery = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => api.kitchenOrders(),
    enabled: !!user,
    // Socket events drive updates; this is the safety-net poll.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const onNewOrder = useCallback(() => {
    if (ordersQuery.data) playChime();
  }, [ordersQuery.data]);

  const { connected } = useRealtime(!!user, onNewOrder);

  // Detect newly seen orders from the poll/socket refetch and chime once.
  useEffect(() => {
    if (!ordersQuery.data) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      knownOrders.current = new Set(ordersQuery.data.map((o) => o.id));
      return;
    }
    const fresh = ordersQuery.data.filter((o) => !knownOrders.current.has(o.id));
    if (fresh.length > 0) {
      knownOrders.current = new Set(ordersQuery.data.map((o) => o.id));
      playChime();
    }
  }, [ordersQuery.data]);

  useEffect(() => {
    if (!pushSupported()) {
      setPushState('unsupported');
      return;
    }
    void currentPushState().then(setPushState).catch(() => setPushState('default'));
  }, []);

  const statusMutation = useMutation({
    mutationFn: ({ orderId, itemId, status }: { orderId: string; itemId: string; status: KitchenItemStatus }) =>
      api.setItemStatus(orderId, itemId, { status }),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Amalni bajarish imkonsiz');
    },
  });

  const orders = ordersQuery.data ?? [];

  const visible = useMemo(() => {
    if (filter === 'ALL') return orders;
    return orders.filter((o) =>
      o.items.some((i) =>
        filter === 'PENDING' ? i.status === 'PENDING' : filter === 'PREPARING' ? i.status === 'PREPARING' : i.status === 'READY',
      ),
    );
  }, [orders, filter]);

  const counts = useMemo(() => {
    const c = { PENDING: 0, PREPARING: 0, READY: 0 };
    for (const o of orders) {
      for (const i of o.items) {
        if (i.status === 'PENDING') c.PENDING++;
        else if (i.status === 'PREPARING') c.PREPARING++;
        else if (i.status === 'READY') c.READY++;
      }
    }
    return c;
  }, [orders]);

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      setPushState(await enablePush());
    } catch {
      setPushState('default');
    } finally {
      setPushBusy(false);
    }
  }

  function logout() {
    clear();
    router.replace('/login');
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-soft">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-safe">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-paper/95 backdrop-blur pt-safe">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-card">
            <ChefHat size={22} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight">Oshxona</h1>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              {connected ? (
                <>
                  <Wifi size={12} className="text-emerald-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff size={12} className="text-amber-600" />
                  <span>Qayta ulanmoqda…</span>
                </>
              )}
              <span>·</span>
              <span className="truncate">{user.fullName}</span>
            </div>
          </div>

          {pushState !== 'subscribed' && pushState !== 'unsupported' && (
            <button
              onClick={handleEnablePush}
              disabled={pushBusy || pushState === 'denied'}
              title={pushState === 'denied' ? 'Bildirishnoma bloklangan' : 'Bildirishnomalarni yoqish'}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-medium shadow-card ring-1 ring-black/5 disabled:opacity-50"
            >
              {pushBusy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
              <span className="hidden xs:inline">Yoqish</span>
            </button>
          )}
          {pushState === 'denied' && (
            <div className="flex h-11 items-center rounded-xl bg-white px-2.5 text-amber-600 shadow-card ring-1 ring-black/5" title="Bildirishnoma brauzer sozlamalarida bloklangan">
              <BellOff size={17} />
            </div>
          )}

          <button
            onClick={() => void ordersQuery.refetch()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-card ring-1 ring-black/5 active:scale-95"
            title="Yangilash"
          >
            <RefreshCw size={17} className={ordersQuery.isFetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={logout}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink-soft shadow-card ring-1 ring-black/5 active:scale-95"
            title="Chiqish"
          >
            <LogOut size={17} />
          </button>
        </div>

        <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3">
          {filters.map((f) => {
            const active = filter === f.key;
            const count = f.key === 'ALL' ? orders.length : counts[f.key];
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  active ? 'bg-primary text-white shadow-card' : 'bg-white text-ink-soft ring-1 ring-black/5'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold ${
                    active ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {actionError && (
        <div className="mx-auto mt-3 max-w-3xl px-4">
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
        </div>
      )}

      <section className="mx-auto max-w-3xl px-4 py-4">
        {ordersQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-soft">
            <Loader2 className="animate-spin" />
            <p className="text-sm">Buyurtmalar yuklanmoqda…</p>
          </div>
        ) : ordersQuery.isError ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-black/5">
            <p className="text-sm text-red-600">Ma’lumotlarni yuklab bo‘lmadi.</p>
            <button
              onClick={() => void ordersQuery.refetch()}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Qayta urinish
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busyKey={statusMutation.isPending ? `${statusMutation.variables?.itemId}` : null}
                onStatus={(itemId, status) => statusMutation.mutate({ orderId: order.id, itemId, status })}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({ filter }: { filter: FilterKey }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-ink-soft">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <CheckCircle2 size={28} className="text-emerald-600" />
      </div>
      <p className="text-base font-medium text-ink">
        {filter === 'ALL' ? 'Hozircha buyurtma yo‘q' : 'Bu bo‘limda buyurtma yo‘q'}
      </p>
      <p className="max-w-xs text-sm">Yangi buyurtmalar avtomatik paydo bo‘ladi — ekranni yopmasdan kuting.</p>
    </div>
  );
}

function OrderCard({
  order,
  busyKey,
  onStatus,
}: {
  order: OrderDto;
  busyKey: string | null;
  onStatus: (itemId: string, status: KitchenItemStatus) => void;
}) {
  const activeItems = order.items.filter(isActiveItem);
  const readyCount = order.items.filter((i) => i.status === 'READY').length;
  const totalItems = order.items.filter((i) => i.status !== 'CANCELLED').length;

  const accent =
    activeItems.length === 0
      ? 'border-l-emerald-500'
      : activeItems.some((i) => i.status === 'PREPARING')
        ? 'border-l-amber-500'
        : 'border-l-primary';

  return (
    <article className={`animate-slide-in overflow-hidden rounded-2xl border-l-4 bg-white shadow-card ring-1 ring-black/5 ${accent}`}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 font-mono text-sm font-bold text-primary-700">
          #{order.orderNumber}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex items-center gap-1 text-sm font-semibold">
              {order.type === 'DELIVERY' ? <Truck size={14} /> : <UtensilsCrossed size={14} />}
              {order.type === 'DELIVERY' ? 'Yetkazib berish' : order.roomName || 'Xona'}
            </span>
            {order.numberOfPeople > 0 && (
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">{order.numberOfPeople} kishi</span>
            )}
            {order.delivery && (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-600">
                {order.delivery.customerName}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
            <Clock size={12} />
            <span>{timeAgo(order.createdAt)}</span>
            <span>·</span>
            <span>{clockTime(order.createdAt)}</span>
            <span>·</span>
            <span>{order.createdByName}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-ink-soft">
            {readyCount}/{totalItems} tayyor
          </div>
          {activeItems.length === 0 && (
            <div className="mt-1 flex items-center justify-end gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 size={13} /> Tayyor
            </div>
          )}
        </div>
      </div>

      {order.note && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Izoh: </span>
          {order.note}
        </div>
      )}

      <ul className="mt-3 divide-y divide-black/5">
        {order.items
          .filter((i) => i.status !== 'CANCELLED')
          .map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-medium leading-snug">{item.productName}</span>
                  <span className="shrink-0 text-sm font-semibold text-primary-700">
                    ×{Number(item.quantity)}
                    {unitLabel[item.productUnit] ? ` ${unitLabel[item.productUnit]}` : ''}
                  </span>
                </div>
                {item.note && <p className="mt-0.5 text-xs text-amber-700">“{item.note}”</p>}
                <div className="mt-1">
                  <ItemBadge status={item.status} />
                </div>
              </div>

              {item.status === 'PENDING' && (
                <button
                  onClick={() => onStatus(item.id, 'PREPARING')}
                  disabled={busyKey === item.id}
                  className="flex h-11 min-w-[104px] items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-3 text-sm font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
                >
                  {busyKey === item.id ? <Loader2 size={16} className="animate-spin" /> : <Flame size={16} />}
                  Boshlash
                </button>
              )}
              {item.status === 'PREPARING' && (
                <button
                  onClick={() => onStatus(item.id, 'READY')}
                  disabled={busyKey === item.id}
                  className="flex h-11 min-w-[104px] items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
                >
                  {busyKey === item.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Tayyor
                </button>
              )}
              {item.status === 'READY' && (
                <div className="flex h-11 min-w-[104px] items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={16} />
                  Tayyor
                </div>
              )}
            </li>
          ))}
      </ul>

      {order.delivery && order.delivery.address && (
        <div className="border-t border-black/5 px-4 py-2.5 text-xs text-ink-soft">
          <span className="font-medium text-ink">Manzil: </span>
          {order.delivery.address}
          {order.delivery.customerPhone ? ` · ${order.delivery.customerPhone}` : ''}
        </div>
      )}
    </article>
  );
}

function ItemBadge({ status }: { status: OrderItemStatus }) {
  const styles: Record<OrderItemStatus, string> = {
    PENDING: 'bg-neutral-100 text-neutral-600',
    PREPARING: 'bg-amber-100 text-amber-700',
    READY: 'bg-emerald-100 text-emerald-700',
    SERVED: 'bg-primary-50 text-primary-700',
    CANCELLED: 'bg-red-50 text-red-600',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}>{itemStatusLabel[status]}</span>;
}
