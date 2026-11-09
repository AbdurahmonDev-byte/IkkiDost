'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus, Search, Trash2 } from 'lucide-react';
import type { OrderDto, OrderStatus } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { toast } from '@/components/toast';
import {
  formatDateTime,
  formatQty,
  formatUzs,
  itemStatusLabel,
  orderStatusLabel,
  orderTypeLabel,
  timeAgo,
} from '@/lib/format';

const statusTone: Record<OrderStatus, Parameters<typeof Badge>[0]['tone']> = {
  PENDING: 'amber',
  CONFIRMED: 'blue',
  PREPARING: 'amber',
  PARTIALLY_READY: 'blue',
  READY: 'green',
  SERVED: 'green',
  COMPLETED: 'neutral',
  CANCELLED: 'red',
};

export default function OrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['orders', { status, type, activeOnly }],
    queryFn: () =>
      api.orders({
        status: status || undefined,
        type: type || undefined,
        active: activeOnly ? undefined : undefined,
      }),
    refetchInterval: 20_000,
  });

  const orders = ordersQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (activeOnly && (o.status === 'COMPLETED' || o.status === 'CANCELLED')) return false;
      if (!q) return true;
      return (
        String(o.orderNumber).includes(q) ||
        (o.roomName ?? '').toLowerCase().includes(q) ||
        (o.delivery?.customerName ?? '').toLowerCase().includes(q) ||
        (o.delivery?.customerPhone ?? '').includes(q)
      );
    });
  }, [orders, search, activeOnly]);

  return (
    <div>
      <PageHeader
        title="Buyurtmalar"
        subtitle="Zal va yetkazib berish buyurtmalari"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Yangi buyurtma
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-2 border-b border-line/70 px-4 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buyurtma raqami, xona yoki mijoz…"
              className="pl-9"
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Barcha turlar</option>
            <option value="DINE_IN">Zalda</option>
            <option value="DELIVERY">Yetkazib berish</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[160px]">
            <option value="">Barcha holatlar</option>
            {(Object.keys(orderStatusLabel) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel[s]}
              </option>
            ))}
          </Select>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-paper px-3 text-sm">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="accent-primary" />
            Faqat faollar
          </label>
        </div>

        {ordersQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Buyurtma topilmadi" hint="Filtrni o‘zgartirib ko‘ring yoki yangi buyurtma yarating." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Turi / joy</Th>
                <Th>Mahsulot</Th>
                <Th className="text-right">Jami</Th>
                <Th className="text-right">To‘langan</Th>
                <Th className="text-right">Qarz</Th>
                <Th>Holat</Th>
                <Th>Vaqt</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-paper/60">
                  <Td className="font-mono font-semibold">#{o.orderNumber}</Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium">{orderTypeLabel[o.type]}</span>
                      <span className="text-xs text-ink-soft">
                        {o.type === 'DINE_IN' ? o.roomName : o.delivery?.customerName}
                        {o.numberOfPeople > 0 ? ` · ${o.numberOfPeople} kishi` : ''}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-ink-soft">{o.items.filter((i) => i.status !== 'CANCELLED').length} ta</Td>
                  <Td className="text-right font-semibold">{formatUzs(o.totalAmount)}</Td>
                  <Td className="text-right text-emerald-700">{formatUzs(o.paidAmount)}</Td>
                  <Td className={`text-right ${o.outstandingAmount > 0 ? 'font-semibold text-red-600' : 'text-ink-soft'}`}>
                    {formatUzs(o.outstandingAmount)}
                  </Td>
                  <Td>
                    <Badge tone={statusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-soft" title={formatDateTime(o.createdAt)}>
                      {timeAgo(o.createdAt)}
                    </span>
                  </Td>
                  <Td>
                    <button
                      onClick={() => setDetailId(o.id)}
                      className="rounded-lg p-1.5 text-ink-soft hover:bg-black/5"
                      title="Batafsil"
                    >
                      <Eye size={16} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <OrderDetailModal id={detailId} onClose={() => setDetailId(null)} />
      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ['orders'] });
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />
    </div>
  );
}

function OrderDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.order(id!),
    enabled: !!id,
  });

  const historyQuery = useQuery({
    queryKey: ['order-history', id],
    queryFn: () => api.orderHistory(id!),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelOrder(id!, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('Buyurtma bekor qilindi');
      setCancelOpen(false);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['order', id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order-history', id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Bekor qilib bo‘lmadi'),
  });

  if (!id) return null;

  const canCancel = order && order.status !== 'COMPLETED' && order.status !== 'CANCELLED';

  return (
    <Modal open={!!id} onClose={onClose} title={order ? `Buyurtma #${order.orderNumber}` : 'Buyurtma'} wide>
      {isLoading || !order ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="Turi" value={orderTypeLabel[order.type]} />
            <Info label="Joy" value={order.type === 'DINE_IN' ? order.roomName ?? '—' : order.delivery?.customerName ?? '—'} />
            <Info label="Holat" value={orderStatusLabel[order.status]} />
            <Info label="Kishi" value={String(order.numberOfPeople)} />
            <Info label="Jami" value={formatUzs(order.totalAmount)} />
            <Info label="To‘langan" value={formatUzs(order.paidAmount)} />
            <Info label="Qarz" value={formatUzs(order.outstandingAmount)} />
            <Info label="Xizmat haqi" value={formatUzs(order.serviceFeeAmount)} />
          </div>

          {order.delivery && (
            <div className="rounded-xl bg-paper px-4 py-3 text-sm">
              <p className="font-medium">{order.delivery.customerName} · {order.delivery.customerPhone}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{order.delivery.address}</p>
              <p className="mt-1 text-xs text-ink-soft">Yetkazish holati: {order.delivery.status}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Mahsulotlar</p>
            <div className="divide-y divide-line/60 rounded-xl ring-1 ring-line/70">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.productName}</p>
                    <p className="text-[11px] text-ink-faint">
                      {formatQty(i.quantity, i.productUnit)} × {formatUzs(i.unitPrice)} · {itemStatusLabel[i.status]}
                    </p>
                  </div>
                  <span className="font-semibold">{formatUzs(i.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Tarix</p>
            <div className="space-y-1.5">
              {(historyQuery.data ?? []).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                  <span className="font-medium text-ink">{h.actorName}</span>
                  <span>{h.fromStatus ? `${orderStatusLabel[h.fromStatus as OrderStatus]} → ` : ''}{orderStatusLabel[h.toStatus as OrderStatus]}</span>
                  {h.note && <span className="text-ink-faint">“{h.note}”</span>}
                  <span className="ml-auto text-ink-faint">{formatDateTime(h.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>

          {canCancel && (
            <div className="flex justify-end border-t border-line pt-3">
              <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                <Trash2 size={14} /> Bekor qilish
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Buyurtmani bekor qilish">
        <Field label="Sabab (majburiy)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: mijoz buyurtmani bekor qildi" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            Yopish
          </Button>
          <Button
            variant="danger"
            loading={cancelMutation.isPending}
            disabled={reason.trim().length < 2}
            onClick={() => cancelMutation.mutate()}
          >
            Bekor qilish
          </Button>
        </div>
      </Modal>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function CreateOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [roomId, setRoomId] = useState('');
  const [people, setPeople] = useState(2);
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});

  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms(), enabled: open });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => api.products(), enabled: open });
  const productList = (productsQuery.data ?? []).filter((p) => p.status === 'ACTIVE');

  const createMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity: String(quantity) }));
      return api.createOrder({
        type: 'DINE_IN' as const,
        roomId,
        numberOfPeople: people,
        note: note.trim() || null,
        items,
      });
    },
    onSuccess: (order) => {
      toast.success(`Buyurtma #${order.orderNumber} yaratildi`);
      setCart({});
      setNote('');
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Buyurtma yaratilmadi'),
  });

  const selectedCount = Object.values(cart).filter((q) => q > 0).length;

  return (
    <Modal open={open} onClose={onClose} title="Yangi zal buyurtmasi" wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Xona">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Tanlang…</option>
              {(roomsQuery.data ?? [])
                .filter((r) => r.isActive)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.activeSession ? ' (ochiq)' : ''}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Kishilar soni">
            <Input type="number" min={0} max={500} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Mahsulotlar</p>
          {productsQuery.isLoading ? (
            <Spinner />
          ) : (
            <div className="max-h-64 divide-y divide-line/60 overflow-y-auto rounded-xl ring-1 ring-line/70">
              {productList.map((p) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-ink-faint">{formatUzs(p.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-lg bg-paper text-sm font-bold"
                        onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, qty - 1) }))}
                      >
                        −
                      </button>
                      <input
                        value={qty || ''}
                        onChange={(e) => setCart((c) => ({ ...c, [p.id]: Math.max(0, Number(e.target.value) || 0) }))}
                        className="h-7 w-12 rounded-lg border border-line text-center text-sm"
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        className="h-7 w-7 rounded-lg bg-paper text-sm font-bold"
                        onClick={() => setCart((c) => ({ ...c, [p.id]: qty + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Izoh (ixtiyoriy)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: stol yoniga…" />
        </Field>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <p className="text-xs text-ink-soft">{selectedCount} ta mahsulot tanlandi</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!roomId || selectedCount === 0}
              onClick={() => createMutation.mutate()}
            >
              Yaratish
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
