'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone, Plus, Truck, XCircle } from 'lucide-react';
import type { DeliveryDto, DeliveryStatus } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { deliveryStatusLabel, formatUzs, timeAgo } from '@/lib/format';

const NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const COLUMNS: DeliveryStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function DeliveryPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const deliveriesQuery = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api.deliveries(),
    refetchInterval: 20_000,
  });
  const ordersQuery = useQuery({
    queryKey: ['orders-all'],
    queryFn: () => api.orders(),
    refetchInterval: 20_000,
  });

  const orderById = useMemo(() => {
    const map = new Map<string, (typeof ordersQuery.data extends undefined ? never : NonNullable<typeof ordersQuery.data>)[number]>();
    for (const o of ordersQuery.data ?? []) map.set(o.id, o);
    return map;
  }, [ordersQuery.data]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) => api.updateDeliveryStatus(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deliveries'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Holat yangilandi');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yangilanmadi'),
  });

  const deliveries = deliveriesQuery.data ?? [];
  const loading = deliveriesQuery.isLoading || ordersQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Yetkazib berish"
        subtitle={`${deliveries.filter((d) => d.status !== 'DELIVERED' && d.status !== 'CANCELLED').length} ta faol buyurtma`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Yetkazish buyurtmasi
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : deliveries.length === 0 ? (
        <Card>
          <EmptyState title="Yetkazish buyurtmalari yo‘q" hint="Yangi yetkazish buyurtmasini yarating." />
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const list = deliveries.filter((d) => d.status === col);
            return (
              <div key={col} className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-white/60 p-2 ring-1 ring-line/60">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{deliveryStatusLabel[col]}</p>
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{list.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {list.map((d) => (
                    <DeliveryCard
                      key={d.id}
                      delivery={d}
                      orderNumber={orderById.get(d.orderId)?.orderNumber}
                      total={orderById.get(d.orderId)?.totalAmount}
                      onNext={(status) => statusMutation.mutate({ id: d.id, status })}
                      busy={statusMutation.isPending && statusMutation.variables?.id === d.id}
                    />
                  ))}
                  {list.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-ink-faint">Bo‘sh</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateDeliveryModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function DeliveryCard({
  delivery,
  orderNumber,
  total,
  onNext,
  busy,
}: {
  delivery: DeliveryDto;
  orderNumber?: number;
  total?: number;
  onNext: (status: DeliveryStatus) => void;
  busy: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const next = NEXT[delivery.status];
  const tone =
    delivery.status === 'DELIVERED' ? 'green' : delivery.status === 'CANCELLED' ? 'red' : delivery.status === 'OUT_FOR_DELIVERY' ? 'blue' : 'amber';

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-line/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{delivery.customerName}</p>
          <p className="text-[11px] text-ink-faint">
            {orderNumber ? `#${orderNumber} · ` : ''}
            {timeAgo(delivery.createdAt)}
          </p>
        </div>
        <Badge tone={tone}>{deliveryStatusLabel[delivery.status]}</Badge>
      </div>

      <div className="mt-2 space-y-1 text-xs text-ink-soft">
        <p className="flex items-center gap-1.5">
          <Phone size={12} /> {delivery.customerPhone}
        </p>
        <p className="flex items-start gap-1.5">
          <MapPin size={12} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{delivery.address}</span>
        </p>
        {total != null && <p className="font-semibold text-ink">{formatUzs(total)}</p>}
        {delivery.assignedToName && <p className="text-[11px]">Kuryer: {delivery.assignedToName}</p>}
      </div>

      {(next || delivery.status === 'PENDING' || delivery.status === 'CONFIRMED' || delivery.status === 'PREPARING' || delivery.status === 'READY' || delivery.status === 'OUT_FOR_DELIVERY') && (
        <div className="mt-2.5 flex gap-1.5">
          {next && (
            <Button size="sm" className="flex-1" loading={busy} onClick={() => onNext(next)}>
              {deliveryStatusLabel[next]}
            </Button>
          )}
          {delivery.status !== 'DELIVERED' && (
            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setCancelOpen(true)} title="Bekor qilish">
              <XCircle size={14} />
            </Button>
          )}
        </div>
      )}

      <ConfirmCancel open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => { onNext('CANCELLED'); setCancelOpen(false); }} />
    </div>
  );
}

function ConfirmCancel({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Yetkazishni bekor qilish">
      <p className="text-sm text-ink-soft">Bu buyurtma bekor qilinadi. Davom etasizmi?</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Bekor qilish
        </Button>
      </div>
    </Modal>
  );
}

function CreateDeliveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => api.products(), enabled: open });
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => api.employees(), enabled: open });

  const products = (productsQuery.data ?? []).filter((p) => p.status === 'ACTIVE');
  const couriers = (employeesQuery.data ?? []).filter((e) => e.isActive && (e.role === 'WAITER' || e.role === 'CASHIER'));

  const mutation = useMutation({
    mutationFn: () =>
      api.createOrder({
        type: 'DELIVERY' as const,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        numberOfPeople: people,
        note: note.trim() || null,
        items: Object.entries(cart)
          .filter(([, q]) => q > 0)
          .map(([productId, quantity]) => ({ productId, quantity: String(quantity) })),
      }),
    onSuccess: (order) => {
      toast.success(`Yetkazish #${order.orderNumber} yaratildi`);
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setCart({});
      setNote('');
      void qc.invalidateQueries({ queryKey: ['deliveries'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yaratilmadi'),
  });

  const itemCount = Object.values(cart).filter((q) => q > 0).length;

  return (
    <Modal open={open} onClose={onClose} title="Yangi yetkazish buyurtmasi" wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mijoz ismi">
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ism familiya" />
          </Field>
          <Field label="Telefon">
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+998 90 000 00 00" />
          </Field>
        </div>
        <Field label="Manzil">
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ko‘cha, uy, mo‘ljal" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kishilar soni">
            <Input type="number" min={0} max={500} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
          </Field>
          <Field label="Izoh (ixtiyoriy)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qo‘shimcha izoh" />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Mahsulotlar</p>
          <div className="max-h-56 divide-y divide-line/60 overflow-y-auto rounded-xl ring-1 ring-line/70">
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-ink-faint">{formatUzs(p.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="h-7 w-7 rounded-lg bg-paper font-bold" onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, qty - 1) }))}>
                      −
                    </button>
                    <input
                      value={qty || ''}
                      onChange={(e) => setCart((c) => ({ ...c, [p.id]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="h-7 w-12 rounded-lg border border-line text-center text-sm"
                      inputMode="decimal"
                    />
                    <button type="button" className="h-7 w-7 rounded-lg bg-paper font-bold" onClick={() => setCart((c) => ({ ...c, [p.id]: qty + 1 }))}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">
            {itemCount} ta tanlandi {couriers.length === 0 ? '· Kuryerlar ro‘yxati bo‘sh' : ''}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!customerName.trim() || customerPhone.trim().length < 4 || address.trim().length < 3 || itemCount === 0}
            onClick={() => mutation.mutate()}
          >
            <Truck size={15} /> Yaratish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
