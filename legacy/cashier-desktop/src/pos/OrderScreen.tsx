import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CreditCard,
  Lock,
  Minus,
  Phone,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  DeliveryStatus,
  OrderDto,
  PaymentDto,
  PaymentMethodDto,
  ProductDto,
  RoomDto,
} from '@ikki-dost/shared-types';
import { computeServiceFee, lineTotalUzs } from '@ikki-dost/utils';
import { api, assetUrl } from '../lib/api';
import {
  deliveryStatusLabel,
  formatQty,
  formatTime,
  formatUzs,
  isMassUnit,
  orderStatusLabel,
  quantityForApi,
  uuid,
} from '../lib/format';
import { Badge, Button, Field, Input, Modal, Spinner, Textarea, cn } from '../ui';
import { Keypad } from './Keypad';
import { PaymentDialog, type PayInput } from './PaymentDialog';
import { ReceiptModal, type ReceiptData } from './Receipt';

export type OrderTarget = { kind: 'room'; roomId: string } | { kind: 'saboy'; orderId: string | null };

interface DraftLine {
  productId: string;
  qty: string;
}

const NEXT_STATUS: Partial<Record<DeliveryStatus, { to: DeliveryStatus; label: string }>> = {
  PENDING: { to: 'CONFIRMED', label: 'Tasdiqlash' },
  CONFIRMED: { to: 'PREPARING', label: 'Tayyorlanmoqda' },
  PREPARING: { to: 'READY', label: 'Tayyor' },
  READY: { to: 'OUT_FOR_DELIVERY', label: 'Yo‘lga chiqdi' },
  OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Yetkazildi' },
};

const isOpenOrder = (o: OrderDto) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function startOfDayIso(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export function OrderScreen({
  target,
  rooms,
  methods,
  onBack,
  onTargetChange,
  notify,
}: {
  target: OrderTarget;
  rooms: RoomDto[];
  methods: PaymentMethodDto[];
  onBack: () => void;
  onTargetChange: (t: OrderTarget) => void;
  notify: (message: string) => void;
}) {
  const qc = useQueryClient();
  const isRoom = target.kind === 'room';
  const room = isRoom ? rooms.find((r) => r.id === target.roomId) : undefined;
  const sessionId = room?.activeSession?.id ?? null;
  const saboyId = target.kind === 'saboy' ? target.orderId : null;

  // ---------- catalogue ----------
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => api.products() });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });
  const feeQuery = useQuery({ queryKey: ['service-fee'], queryFn: () => api.serviceFeeConfig() });
  const products = useMemo(() => (productsQuery.data ?? []).filter((p) => p.status === 'ACTIVE'), [productsQuery.data]);
  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => products.some((p) => p.categoryId === c.id)),
    [categoriesQuery.data, products],
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) =>
      term ? p.name.toLowerCase().includes(term) : categoryId ? p.categoryId === categoryId : true,
    );
  }, [products, categoryId, search]);

  // ---------- bill ----------
  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.roomSession(sessionId!),
    enabled: !!sessionId,
  });
  const saboyQuery = useQuery({
    queryKey: ['order', saboyId],
    queryFn: () => api.order(saboyId!),
    enabled: !!saboyId,
  });
  const saboy = saboyQuery.data;
  const saboyPaymentsQuery = useQuery({
    queryKey: ['order-payments', saboyId, saboy?.createdAt],
    queryFn: () => api.payments({ from: startOfDayIso(saboy!.createdAt) }),
    enabled: !!saboy,
  });

  const session = sessionId ? sessionQuery.data : undefined;
  const billOrders: OrderDto[] = isRoom
    ? (session?.orders ?? []).slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    : saboy
      ? [saboy]
      : [];
  const billPayments: PaymentDto[] = isRoom
    ? session?.payments ?? []
    : (saboyPaymentsQuery.data ?? []).filter((p) => p.orderId === saboyId);
  const total = isRoom ? session?.totalAmount ?? 0 : saboy?.totalAmount ?? 0;
  const paid = isRoom ? session?.paidAmount ?? 0 : saboy?.paidAmount ?? 0;
  const outstanding = isRoom ? session?.outstandingAmount ?? 0 : saboy?.outstandingAmount ?? 0;
  const appendTo = [...billOrders].reverse().find(isOpenOrder) ?? null;
  const hasBill = billOrders.length > 0;
  const loadingBill = (isRoom && !!sessionId && sessionQuery.isLoading) || (!!saboyId && saboyQuery.isLoading);

  // ---------- draft ----------
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [qtyEdit, setQtyEdit] = useState<{ productId: string; value: string } | null>(null);
  const targetKey = target.kind === 'room' ? `r:${target.roomId}` : `s:${target.orderId ?? 'new'}`;
  useEffect(() => {
    setLines([]);
    setNote('');
    setQtyEdit(null);
    setCustomer({ name: '', phone: '', address: '' });
  }, [targetKey]);
  // A brand-new bill charges the service fee; extra orders on an open bill default to 0 people.
  useEffect(() => {
    setPeople(hasBill ? 0 : 1);
  }, [targetKey, hasBill]);

  const needsNewOrder = !appendTo;
  const draftLines = lines
    .map((l) => ({ ...l, product: byId.get(l.productId) }))
    .filter((l): l is DraftLine & { product: ProductDto } => Boolean(l.product) && Number(l.qty) > 0);
  const draftItems = draftLines.reduce((s, l) => s + lineTotalUzs(l.product.price, Number(l.qty)), 0);
  const orderType = isRoom ? 'DINE_IN' : 'DELIVERY';
  const draftFee =
    needsNewOrder && feeQuery.data ? computeServiceFee(feeQuery.data, orderType, people).amount : 0;
  const draftTotal = draftLines.length ? draftItems + draftFee : 0;

  const setQty = (productId: string, qty: string) =>
    setLines((ls) => {
      if (!(Number(qty) > 0)) return ls.filter((l) => l.productId !== productId);
      return ls.some((l) => l.productId === productId)
        ? ls.map((l) => (l.productId === productId ? { ...l, qty } : l))
        : [...ls, { productId, qty }];
    });
  const currentQty = (productId: string) => Number(lines.find((l) => l.productId === productId)?.qty ?? 0);

  const tapProduct = (p: ProductDto) => {
    if (isMassUnit(p.unit)) {
      const cur = lines.find((l) => l.productId === p.id)?.qty ?? '';
      setQtyEdit({ productId: p.id, value: cur });
      return;
    }
    setQty(p.id, quantityForApi(currentQty(p.id) + 1));
  };
  const step = (p: ProductDto, delta: number) => {
    const d = isMassUnit(p.unit) ? delta * 0.1 : delta;
    setQty(p.id, quantityForApi(Math.max(0, currentQty(p.id) + d)));
  };

  // ---------- mutations ----------
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['rooms'] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['session'] });
    void qc.invalidateQueries({ queryKey: ['order'] });
    void qc.invalidateQueries({ queryKey: ['order-payments'] });
    void qc.invalidateQueries({ queryKey: ['payments-today'] });
  };

  const sendMutation = useMutation({
    mutationFn: async (): Promise<OrderDto> => {
      const items = draftLines.map((l) => ({ productId: l.productId, quantity: quantityForApi(Number(l.qty)) }));
      if (appendTo) return api.addOrderItems(appendTo.id, { items });
      if (isRoom) {
        return api.createOrder({ type: 'DINE_IN', roomId: target.roomId, numberOfPeople: people, note: note.trim() || null, items });
      }
      return api.createOrder({
        type: 'DELIVERY',
        numberOfPeople: people,
        note: note.trim() || null,
        items,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        address: customer.address.trim(),
      });
    },
    onSuccess: (order) => {
      setLines([]);
      setNote('');
      notify(`#${order.orderNumber} oshxonaga yuborildi`);
      refresh();
      if (target.kind === 'saboy' && !target.orderId) onTargetChange({ kind: 'saboy', orderId: order.id });
    },
    onError: (e) => notify(errorText(e, 'Buyurtmani yuborib bo‘lmadi')),
  });

  const saboyInvalid =
    target.kind === 'saboy' &&
    !target.orderId &&
    (customer.name.trim().length < 1 || customer.phone.trim().length < 4 || customer.address.trim().length < 3);
  const canSend = draftLines.length > 0 && !saboyInvalid && !sendMutation.isPending;

  const [payOpen, setPayOpen] = useState(false);
  const payMutation = useMutation({
    mutationFn: async (input: PayInput) => {
      const body = { amount: input.amount, methodId: input.methodId, note: null, idempotencyKey: uuid() };
      const payment = isRoom ? await api.payRoomSession(sessionId!, body) : await api.payOrder(saboyId!, body);
      if (input.closeAfter && isRoom && sessionId) await api.closeRoomSession(sessionId, {});
      return { payment, closed: input.closeAfter };
    },
    onSuccess: ({ payment, closed }) => {
      setPayOpen(false);
      refresh();
      notify(`To‘lov qabul qilindi: ${formatUzs(payment.amount)}${closed ? ' · xona yopildi' : ''}`);
      if (closed) onBack();
    },
    onError: (e) => {
      refresh();
      notify(errorText(e, 'To‘lov amalga oshmadi'));
    },
  });

  const openPayment = async () => {
    if (draftLines.length > 0) {
      try {
        await sendMutation.mutateAsync();
      } catch {
        return;
      }
    }
    setPayOpen(true);
  };

  const [closeReason, setCloseReason] = useState<string | null>(null);
  const closeMutation = useMutation({
    mutationFn: (reason?: string) => api.closeRoomSession(sessionId!, reason ? { overrideReason: reason } : {}),
    onSuccess: () => {
      setCloseReason(null);
      refresh();
      notify(`${room?.name ?? 'Xona'} yopildi`);
      onBack();
    },
    onError: (e) => notify(errorText(e, 'Xonani yopib bo‘lmadi')),
  });
  const pressClose = () => {
    if (draftLines.length > 0) return notify('Avval yangi mahsulotlarni yuboring yoki o‘chiring');
    if (outstanding > 0) setCloseReason('');
    else closeMutation.mutate(undefined);
  };

  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.cancelOrder(saboyId!, { reason }),
    onSuccess: () => {
      setCancelReason(null);
      refresh();
      notify('Saboy bekor qilindi');
      onBack();
    },
    onError: (e) => notify(errorText(e, 'Bekor qilib bo‘lmadi')),
  });

  const statusMutation = useMutation({
    mutationFn: (status: DeliveryStatus) => api.updateDeliveryStatus(saboy!.delivery!.id, { status }),
    onSuccess: () => refresh(),
    onError: (e) => notify(errorText(e, 'Holatni o‘zgartirib bo‘lmadi')),
  });

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const showReceipt = () =>
    setReceipt({
      heading: isRoom ? room?.name ?? 'Xona' : `Saboy #${saboy?.orderNumber ?? ''}`,
      subheading: isRoom ? `${billOrders.length} buyurtma` : saboy?.delivery?.customerName,
      details: !isRoom && saboy?.delivery ? `${saboy.delivery.customerPhone} · ${saboy.delivery.address}` : undefined,
      orders: billOrders,
      total,
      paid,
      outstanding,
      payments: billPayments,
    });

  // ---------- view ----------
  const title = isRoom ? room?.name ?? 'Xona' : saboy ? `Saboy #${saboy.orderNumber}` : 'Yangi saboy';
  const editProduct = qtyEdit ? byId.get(qtyEdit.productId) : undefined;
  const nextStatus = saboy?.delivery ? NEXT_STATUS[saboy.delivery.status] : undefined;

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_420px]">
      {/* ===== Menu ===== */}
      <section className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2.5">
          <div className="relative w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Taom qidirish…" className="h-11 pl-9" />
          </div>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
            <CategoryChip active={!categoryId && !search} onClick={() => { setCategoryId(null); setSearch(''); }}>
              Hammasi
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c.id} active={categoryId === c.id && !search} onClick={() => { setCategoryId(c.id); setSearch(''); }}>
                {c.name}
              </CategoryChip>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {productsQuery.isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {visible.map((p) => {
                const inDraft = currentQty(p.id);
                const img = assetUrl(p.thumbnailUrl ?? p.imageUrl);
                return (
                  <button
                    key={p.id}
                    onClick={() => tapProduct(p)}
                    className={cn(
                      'relative flex h-32 flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 transition active:scale-[0.97]',
                      inDraft > 0 ? 'ring-2 ring-primary' : 'ring-line hover:ring-primary/40',
                    )}
                  >
                    {img ? (
                      <img src={img} alt="" className="h-14 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-14 w-full items-center justify-center bg-primary-50 text-primary">
                        <UtensilsCrossed size={20} />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col justify-between px-2.5 py-1.5">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{p.name}</p>
                      <p className="text-xs font-bold text-primary">
                        {formatUzs(p.price)}
                        {isMassUnit(p.unit) && <span className="font-normal text-ink-soft"> / {p.unit === 'KG' ? 'kg' : 'l'}</span>}
                      </p>
                    </div>
                    {inDraft > 0 && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                        {formatQty(String(inDraft), p.unit)}
                      </span>
                    )}
                  </button>
                );
              })}
              {visible.length === 0 && <p className="col-span-full py-16 text-center text-sm text-ink-soft">Mahsulot topilmadi</p>}
            </div>
          )}
        </div>
      </section>

      {/* ===== Ticket ===== */}
      <aside className="flex min-h-0 flex-col border-l border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper ring-1 ring-line active:scale-95" title="Orqaga">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight">{title}</p>
            <p className="truncate text-xs text-ink-soft">
              {isRoom
                ? session
                  ? `Ochilgan ${formatTime(session.openedAt)} · ${billOrders.length} buyurtma`
                  : 'Bo‘sh xona'
                : saboy?.delivery
                  ? `${saboy.delivery.customerName} · ${saboy.delivery.customerPhone}`
                  : 'Telefon orqali buyurtma'}
            </p>
          </div>
          {saboy?.delivery && <Badge tone="blue">{deliveryStatusLabel[saboy.delivery.status]}</Badge>}
        </div>

        {target.kind === 'saboy' && !target.orderId && (
          <div className="grid grid-cols-2 gap-2 border-b border-line px-3 py-2.5">
            <Input placeholder="Mijoz ismi" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-11" />
            <Input placeholder="Telefon" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="h-11" />
            <Input placeholder="Manzil" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="col-span-2 h-11" />
          </div>
        )}
        {saboy?.delivery && (
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs text-ink-soft">
            <Phone size={13} /> <span className="min-w-0 flex-1 truncate">{saboy.delivery.address}</span>
            {nextStatus && saboy.status !== 'CANCELLED' && (
              <Button size="sm" variant="secondary" loading={statusMutation.isPending} onClick={() => statusMutation.mutate(nextStatus.to)}>
                {nextStatus.label}
              </Button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingBill && <div className="flex justify-center py-8"><Spinner /></div>}
          {billOrders.map((o) => (
            <div key={o.id} className="border-b border-line/70 px-3 py-2">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-faint">
                <span className="font-semibold text-ink-soft">#{o.orderNumber}</span>
                <span>{formatTime(o.createdAt)}</span>
                <span>· {orderStatusLabel[o.status]}</span>
                {o.serviceFeeAmount > 0 && <span className="ml-auto">Xizmat: {formatUzs(o.serviceFeeAmount)}</span>}
              </div>
              {o.items.map((i) => (
                <div key={i.id} className={cn('flex items-center gap-2 py-0.5 text-sm', i.status === 'CANCELLED' && 'text-ink-faint line-through')}>
                  <span className="min-w-0 flex-1 truncate">{i.productName}</span>
                  <span className="text-xs text-ink-soft">{formatQty(i.quantity, i.productUnit)}</span>
                  <span className="w-24 text-right">{formatUzs(i.lineTotal)}</span>
                </div>
              ))}
            </div>
          ))}

          {draftLines.length > 0 && (
            <div className="bg-primary-50/60 px-3 py-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary">Yangi taomlar (hali yuborilmagan)</p>
              {draftLines.map((l) => (
                <div key={l.productId} className="flex items-center gap-1.5 py-1">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.product.name}</span>
                  <IconButton onClick={() => step(l.product, -1)}><Minus size={16} /></IconButton>
                  <button
                    onClick={() => setQtyEdit({ productId: l.productId, value: l.qty })}
                    className="h-10 min-w-[72px] rounded-lg bg-white px-2 text-sm font-bold ring-1 ring-line"
                  >
                    {formatQty(l.qty, l.product.unit)}
                  </button>
                  <IconButton onClick={() => step(l.product, 1)}><Plus size={16} /></IconButton>
                  <span className="w-24 whitespace-nowrap text-right text-sm font-semibold">{formatUzs(lineTotalUzs(l.product.price, Number(l.qty)))}</span>
                  <IconButton onClick={() => setQty(l.productId, '0')} danger><Trash2 size={15} /></IconButton>
                </div>
              ))}
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Oshpazga izoh (ixtiyoriy)" className="mt-1.5 h-10" />
            </div>
          )}

          {!loadingBill && !hasBill && draftLines.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-ink-soft">Chapdan taomni bosing</div>
          )}
        </div>

        {/* totals + actions */}
        <div className="border-t border-line bg-paper/60 px-3 py-2.5">
          {needsNewOrder && draftLines.length > 0 && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-ink-soft">Kishi soni</span>
              <div className="flex items-center gap-1.5">
                <IconButton onClick={() => setPeople((n) => Math.max(0, n - 1))}><Minus size={16} /></IconButton>
                <span className="w-10 text-center text-lg font-bold">{people}</span>
                <IconButton onClick={() => setPeople((n) => Math.min(500, n + 1))}><Plus size={16} /></IconButton>
              </div>
            </div>
          )}
          {draftLines.length > 0 && (
            <SumRow label={draftFee > 0 ? `Yangi (xizmat ${formatUzs(draftFee)})` : 'Yangi'} value={formatUzs(draftTotal)} />
          )}
          <SumRow label="Hisob" value={formatUzs(total)} />
          <SumRow label="To‘langan" value={formatUzs(paid)} tone="green" />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-base font-semibold">Qarz</span>
            <span className={cn('text-2xl font-bold', outstanding > 0 ? 'text-red-600' : 'text-emerald-700')}>{formatUzs(outstanding)}</span>
          </div>

          <Button size="lg" className="mt-2.5 h-14 w-full text-base" disabled={!canSend} loading={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
            <Send size={18} /> Oshxonaga yuborish{draftLines.length > 0 ? ` · ${formatUzs(draftTotal)}` : ''}
          </Button>
          {saboyInvalid && draftLines.length > 0 && (
            <p className="mt-1 text-center text-xs text-red-600">Mijoz ismi, telefoni va manzilini kiriting</p>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button
              size="lg"
              variant="success"
              className="h-14"
              disabled={(outstanding <= 0 && draftLines.length === 0) || saboyInvalid}
              onClick={() => void openPayment()}
            >
              <CreditCard size={18} /> To‘lov
            </Button>
            <Button size="lg" variant="secondary" className="h-14" disabled={!hasBill} onClick={showReceipt}>
              <Printer size={18} /> Chek
            </Button>
            {isRoom ? (
              <Button size="lg" variant="secondary" className="h-14" disabled={!sessionId} loading={closeMutation.isPending} onClick={pressClose}>
                <Lock size={18} /> Yopish
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                className="h-14 text-red-600"
                disabled={!saboy || saboy.status === 'CANCELLED' || saboy.status === 'COMPLETED' || saboy.paidAmount > 0}
                onClick={() => setCancelReason('')}
              >
                <Ban size={18} /> Bekor
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* ===== Dialogs ===== */}
      <Modal open={!!qtyEdit} onClose={() => setQtyEdit(null)} title={editProduct ? `${editProduct.name} — miqdor` : 'Miqdor'}>
        {qtyEdit && editProduct && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between rounded-xl bg-paper px-4 py-3 ring-1 ring-line">
              <span className="text-3xl font-bold">
                {qtyEdit.value || '0'} <span className="text-base font-normal text-ink-soft">{formatQty('1', editProduct.unit).replace(/^1\s?/, '')}</span>
              </span>
              <span className="text-lg font-semibold text-primary">
                {Number(qtyEdit.value) > 0 ? formatUzs(lineTotalUzs(editProduct.price, Number(qtyEdit.value))) : ''}
              </span>
            </div>
            <Keypad
              value={qtyEdit.value}
              decimals={isMassUnit(editProduct.unit) ? 3 : 0}
              maxLength={8}
              onChange={(v) => setQtyEdit({ ...qtyEdit, value: v })}
              onEnter={() => {
                setQty(qtyEdit.productId, Number(qtyEdit.value) > 0 ? quantityForApi(Number(qtyEdit.value)) : '0');
                setQtyEdit(null);
              }}
            />
            <Button
              size="lg"
              className="h-14 w-full"
              onClick={() => {
                setQty(qtyEdit.productId, Number(qtyEdit.value) > 0 ? quantityForApi(Number(qtyEdit.value)) : '0');
                setQtyEdit(null);
              }}
            >
              Tayyor
            </Button>
          </div>
        )}
      </Modal>

      <PaymentDialog
        open={payOpen}
        title={`To‘lov — ${title}`}
        outstanding={outstanding}
        methods={methods}
        canCloseAfter={isRoom}
        loading={payMutation.isPending}
        onClose={() => setPayOpen(false)}
        onPay={(input) => payMutation.mutate(input)}
      />

      <Modal open={closeReason !== null} onClose={() => setCloseReason(null)} title="Qarz bilan yopish">
        <p className="text-sm text-ink-soft">
          Qarz {formatUzs(outstanding)} qoladi. Sabab audit jurnaliga yoziladi.
        </p>
        <div className="mt-3">
          <Field label="Sabab">
            <Textarea value={closeReason ?? ''} onChange={(e) => setCloseReason(e.target.value)} placeholder="Masalan: mijoz ertaga to‘laydi" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCloseReason(null)}>Bekor</Button>
          <Button
            variant="danger"
            disabled={(closeReason ?? '').trim().length < 3}
            loading={closeMutation.isPending}
            onClick={() => closeMutation.mutate((closeReason ?? '').trim())}
          >
            Qarz bilan yopish
          </Button>
        </div>
      </Modal>

      <Modal open={cancelReason !== null} onClose={() => setCancelReason(null)} title="Saboyni bekor qilish">
        <Field label="Sabab">
          <Textarea value={cancelReason ?? ''} onChange={(e) => setCancelReason(e.target.value)} placeholder="Masalan: mijoz bekor qildi" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelReason(null)}>Yo‘q</Button>
          <Button
            variant="danger"
            disabled={(cancelReason ?? '').trim().length < 2}
            loading={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate((cancelReason ?? '').trim())}
          >
            Bekor qilish
          </Button>
        </div>
      </Modal>

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition active:scale-95',
        active ? 'bg-primary text-white' : 'bg-paper text-ink ring-1 ring-line hover:bg-primary-50',
      )}
    >
      {children}
    </button>
  );
}

function IconButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-line active:scale-95',
        danger ? 'bg-red-50 text-red-600' : 'bg-white text-ink',
      )}
    >
      {children}
    </button>
  );
}

function SumRow({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={cn('font-semibold', tone === 'green' && 'text-emerald-700')}>{value}</span>
    </div>
  );
}
