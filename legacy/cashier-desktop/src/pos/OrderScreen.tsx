import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronsRight, Delete, MoreHorizontal, Printer, Search, Trash2, UtensilsCrossed, Users } from 'lucide-react';
import type { OrderDto, PaymentDto, PaymentMethodDto, ProductDto, RoomDto } from '@ikki-dost/shared-types';
import { computeServiceFee, lineTotalUzs } from '@ikki-dost/utils';
import { api, assetUrl } from '../lib/api';
import { formatQty, formatUzs, isMassUnit, quantityForApi } from '../lib/format';
import { Button, Field, Modal, Spinner, Textarea, cn } from '../ui';
import { PaymentScreen } from './PaymentScreen';
import { ReceiptModal, printReceipt, type ReceiptData } from './Receipt';

export type OrderTarget =
  | { kind: 'room'; roomId: string; people?: number }
  | { kind: 'saboy'; orderId: string | null };

interface DraftLine {
  productId: string;
  qty: string;
}

const isOpenOrder = (o: OrderDto) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const num = (n: number) => new Intl.NumberFormat('ru-RU').format(n).replace(/ /g, ' ');

function startOfDayIso(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

type KeyMode = 'qty' | 'people';

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
    return products.filter((p) => (term ? p.name.toLowerCase().includes(term) : categoryId ? p.categoryId === categoryId : true));
  }, [products, categoryId, search]);

  // ---------- bill ----------
  const sessionQuery = useQuery({ queryKey: ['session', sessionId], queryFn: () => api.roomSession(sessionId!), enabled: !!sessionId });
  const saboyQuery = useQuery({ queryKey: ['order', saboyId], queryFn: () => api.order(saboyId!), enabled: !!saboyId });
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
  const billPayments: PaymentDto[] = isRoom ? session?.payments ?? [] : (saboyPaymentsQuery.data ?? []).filter((p) => p.orderId === saboyId);
  const total = isRoom ? session?.totalAmount ?? 0 : saboy?.totalAmount ?? 0;
  const paid = isRoom ? session?.paidAmount ?? 0 : saboy?.paidAmount ?? 0;
  const outstanding = isRoom ? session?.outstandingAmount ?? 0 : saboy?.outstandingAmount ?? 0;
  const billFee = billOrders.reduce((s, o) => s + o.serviceFeeAmount, 0);
  const appendTo = [...billOrders].reverse().find(isOpenOrder) ?? null;
  const hasBill = billOrders.length > 0;
  const loadingBill = (isRoom && !!sessionId && sessionQuery.isLoading) || (!!saboyId && saboyQuery.isLoading);
  const savedItems = billOrders.flatMap((o) => o.items.filter((i) => i.status !== 'CANCELLED'));

  // ---------- draft ----------
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [people, setPeople] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<KeyMode>('qty');
  /** First key after selecting a line replaces its quantity instead of appending. */
  const freshKey = useRef(true);
  const targetKey = target.kind === 'room' ? `r:${target.roomId}` : `s:${target.orderId ?? 'new'}`;
  useEffect(() => {
    setLines([]);
    setSelected(null);
    setMode('qty');
  }, [targetKey]);
  useEffect(() => {
    setPeople(hasBill ? 0 : target.kind === 'room' ? target.people ?? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, hasBill]);

  const needsNewOrder = !appendTo;
  const draft = lines
    .map((l) => ({ ...l, product: byId.get(l.productId) }))
    .filter((l): l is DraftLine & { product: ProductDto } => Boolean(l.product));
  const validDraft = draft.filter((l) => Number(l.qty) > 0);
  const draftItems = validDraft.reduce((s, l) => s + lineTotalUzs(l.product.price, Number(l.qty)), 0);
  const draftFee = needsNewOrder && validDraft.length && feeQuery.data ? computeServiceFee(feeQuery.data, isRoom ? 'DINE_IN' : 'DELIVERY', people).amount : 0;
  const grandItems = savedItems.reduce((s, i) => s + i.lineTotal, 0) + draftItems;
  const grandFee = billFee + draftFee;
  const toPay = outstanding + draftItems + draftFee;

  const setQty = (productId: string, qty: string) =>
    setLines((ls) => (ls.some((l) => l.productId === productId) ? ls.map((l) => (l.productId === productId ? { ...l, qty } : l)) : [...ls, { productId, qty }]));
  const removeLine = (productId: string) => {
    setLines((ls) => ls.filter((l) => l.productId !== productId));
    if (selected === productId) setSelected(null);
  };

  const tapProduct = (p: ProductDto) => {
    const cur = lines.find((l) => l.productId === p.id);
    if (cur && !isMassUnit(p.unit)) setQty(p.id, quantityForApi(Number(cur.qty || 0) + 1));
    else if (!cur) setQty(p.id, '1');
    setSelected(p.id);
    setMode('qty');
    freshKey.current = true;
  };

  const pressKey = (k: string) => {
    if (mode === 'people') {
      const cur = freshKey.current ? '' : String(people);
      freshKey.current = false;
      if (k === 'C') return setPeople(0);
      if (k === '⌫') return setPeople(Number(String(people).slice(0, -1)) || 0);
      if (!/^\d$/.test(k)) return;
      return setPeople(Math.min(500, Number(cur + k)));
    }
    if (!selected) return notify('Avval o‘ngdan mahsulot tanlang');
    const line = lines.find((l) => l.productId === selected);
    const product = byId.get(selected);
    if (!line || !product) return;
    const decimals = isMassUnit(product.unit) ? 3 : 0;
    let v = freshKey.current ? '' : line.qty;
    freshKey.current = false;
    if (k === 'C') v = '';
    else if (k === '⌫') v = v.slice(0, -1);
    else if (k === '.') {
      if (decimals === 0 || v.includes('.')) return;
      v = v === '' ? '0.' : `${v}.`;
    } else {
      const dot = v.indexOf('.');
      if (dot >= 0 && v.length - dot > decimals) return;
      v = v === '0' ? k : v + k;
      if (v.length > 7) return;
    }
    setQty(selected, v);
  };

  // ---------- mutations ----------
  const refresh = () => {
    for (const key of ['rooms', 'orders', 'session', 'order', 'order-payments', 'payments-today', 'dashboard']) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<OrderDto | null> => {
      if (validDraft.length === 0) return null;
      const items = validDraft.map((l) => ({ productId: l.productId, quantity: quantityForApi(Number(l.qty)) }));
      if (appendTo) return api.addOrderItems(appendTo.id, { items });
      if (isRoom) return api.createOrder({ type: 'DINE_IN', roomId: target.roomId, numberOfPeople: people, items });
      return api.createOrder({ type: 'DELIVERY', numberOfPeople: people, items });
    },
    onSuccess: (order) => {
      setLines([]);
      setSelected(null);
      refresh();
      if (order && target.kind === 'saboy' && !target.orderId) onTargetChange({ kind: 'saboy', orderId: order.id });
    },
    onError: (e) => notify(errorText(e, 'Saqlab bo‘lmadi')),
  });

  const save = async (): Promise<boolean> => {
    if (lines.some((l) => !(Number(l.qty) > 0))) setLines((ls) => ls.filter((l) => Number(l.qty) > 0));
    if (validDraft.length === 0) return true;
    try {
      await saveMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const goBack = async () => {
    if (await save()) onBack();
  };

  const [paying, setPaying] = useState(false);
  const openPayment = async () => {
    if (!(await save())) return;
    setPaying(true);
  };

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const title = isRoom ? room?.name ?? 'Xona' : saboy ? `Saboy #${saboy.orderNumber}` : 'Yangi saboy';
  const receiptData = (): ReceiptData => ({
    heading: title,
    subheading: isRoom ? `${billOrders.reduce((s, o) => s + o.numberOfPeople, 0) || ''} kishi`.trim() : 'Saboy',
    orders: billOrders,
    total,
    paid,
    outstanding,
    payments: billPayments,
  });

  const [menuOpen, setMenuOpen] = useState(false);
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

  if (paying) {
    return (
      <PaymentScreen
        title={title}
        outstanding={outstanding}
        methods={methods}
        isRoom={isRoom}
        target={isRoom ? { kind: 'session', id: sessionId! } : { kind: 'order', id: saboyId! }}
        onBack={() => setPaying(false)}
        onDone={async ({ fullyPaid, printCheck }) => {
          refresh();
          if (printCheck) {
            try {
              const fresh = isRoom ? await api.roomSession(sessionId!) : await api.order(saboyId!);
              const pays = isRoom ? (fresh as { payments: PaymentDto[] }).payments : (await api.payments({ from: startOfDayIso((fresh as OrderDto).createdAt) })).filter((p) => p.orderId === saboyId);
              await printReceipt({
                ...receiptData(),
                orders: isRoom ? (fresh as { orders: OrderDto[] }).orders : [fresh as OrderDto],
                total: fresh.totalAmount,
                paid: fresh.paidAmount,
                outstanding: fresh.outstandingAmount,
                payments: pays,
              });
            } catch (e) {
              notify(`Chek chiqmadi: ${errorText(e, 'printer xatosi')}`);
            }
          }
          if (fullyPaid && isRoom && sessionId) {
            try {
              await api.closeRoomSession(sessionId, {});
            } catch (e) {
              notify(errorText(e, 'Xonani yopib bo‘lmadi'));
            }
          }
          setPaying(false);
          if (fullyPaid) onBack();
        }}
        notify={notify}
      />
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(520px,46%)_1fr]">
      {/* ===== Left: ticket ===== */}
      <section className="flex min-h-0 flex-col border-r border-line bg-[#eceef2]">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-3">
          <button onClick={() => void goBack()} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-paper" title="Orqaga">
            <ArrowLeft size={22} />
          </button>
          <p className="min-w-0 flex-1 truncate text-lg font-bold">{title}</p>
          <button
            onClick={() => {
              setMode('people');
              freshKey.current = true;
            }}
            className={cn('flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1', mode === 'people' ? 'bg-primary text-white ring-primary' : 'bg-white ring-line')}
            title="Mehmonlar soni"
          >
            <Users size={16} /> {hasBill && !needsNewOrder ? billOrders.reduce((s, o) => s + o.numberOfPeople, 0) : people}
          </button>
        </div>

        {/* table */}
        <div className="grid grid-cols-[1fr_96px_88px_104px_36px] items-center gap-2 border-b border-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft">
          <span>Nom</span><span className="text-right">Narx</span><span className="text-right">Miqdor</span><span className="text-right">Summa</span><span />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingBill && <div className="flex justify-center py-8"><Spinner /></div>}
          {savedItems.map((i) => (
            <div key={i.id} className="grid grid-cols-[1fr_96px_88px_104px_36px] items-center gap-2 border-b border-line/70 bg-white/60 px-3 py-2.5 text-sm">
              <span className="truncate font-semibold">{i.productName}</span>
              <span className="text-right">{num(i.unitPrice)}</span>
              <span className="text-right">{formatQty(i.quantity, i.productUnit)}</span>
              <span className="text-right font-semibold">{num(i.lineTotal)}</span>
              <span />
            </div>
          ))}
          {draft.map((l) => (
            <div
              key={l.productId}
              onClick={() => {
                setSelected(l.productId);
                setMode('qty');
                freshKey.current = true;
              }}
              className={cn(
                'grid cursor-pointer grid-cols-[1fr_96px_88px_104px_36px] items-center gap-2 border-b border-line/70 px-3 py-2.5 text-sm',
                selected === l.productId ? 'bg-white ring-2 ring-inset ring-primary' : 'bg-white',
              )}
            >
              <span className="truncate font-semibold">{l.product.name}</span>
              <span className="text-right">{num(l.product.price)}</span>
              <span className={cn('text-right', !(Number(l.qty) > 0) && 'text-red-600')}>{l.qty || '0'} {formatQty('1', l.product.unit).replace(/^1\s?/, '')}</span>
              <span className="text-right font-semibold">{Number(l.qty) > 0 ? num(lineTotalUzs(l.product.price, Number(l.qty))) : '0'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeLine(l.productId);
                }}
                className="flex h-8 w-8 items-center justify-center rounded text-ink-faint hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!loadingBill && savedItems.length === 0 && draft.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-soft">
              <UtensilsCrossed size={32} />
              <p>Buyurtma bo‘sh</p>
            </div>
          )}
        </div>

        {/* summary bar */}
        <div className="flex shrink-0 items-center gap-2 bg-[#243b31] px-3 py-2.5 text-white">
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="flex h-11 w-16 items-center justify-center rounded-md bg-white text-ink">
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="absolute bottom-12 left-0 z-20 w-60 overflow-hidden rounded-lg bg-white text-sm text-ink shadow-xl ring-1 ring-line">
                {isRoom ? (
                  <button
                    disabled={!sessionId}
                    onClick={() => {
                      setMenuOpen(false);
                      if (validDraft.length) return notify('Avval mahsulotlarni saqlang');
                      if (outstanding > 0) setCloseReason('');
                      else closeMutation.mutate(undefined);
                    }}
                    className="block w-full px-4 py-3 text-left hover:bg-paper disabled:opacity-40"
                  >
                    {outstanding > 0 ? 'Qarz bilan yopish…' : 'Xonani yopish'}
                  </button>
                ) : (
                  <button
                    disabled={!saboy || saboy.paidAmount > 0 || saboy.status === 'COMPLETED'}
                    onClick={() => {
                      setMenuOpen(false);
                      setCancelReason('');
                    }}
                    className="block w-full px-4 py-3 text-left text-red-600 hover:bg-paper disabled:opacity-40"
                  >
                    Saboyni bekor qilish
                  </button>
                )}
                <button
                  disabled={validDraft.length === 0}
                  onClick={() => {
                    setMenuOpen(false);
                    void save();
                  }}
                  className="block w-full px-4 py-3 text-left hover:bg-paper disabled:opacity-40"
                >
                  Saqlash (to‘lovsiz)
                </button>
              </div>
            )}
          </div>
          <button
            disabled={!hasBill}
            onClick={() => setReceipt(receiptData())}
            className="flex h-11 w-16 items-center justify-center rounded-md bg-white text-ink disabled:opacity-40"
            title="Chek"
          >
            <Printer size={20} />
          </button>
          <div className="ml-auto text-right text-sm leading-tight">
            <p>Buyurtma summasi: <b>{num(grandItems)}</b></p>
            <p>Xizmat to‘lovi: <b>{num(grandFee)}</b></p>
            {paid > 0 && <p>To‘langan: <b>{num(paid)}</b></p>}
            <p className="text-base">Jami to‘lov: <b>{num(toPay)}</b></p>
          </div>
        </div>

        {/* keypad */}
        <div className="grid shrink-0 grid-cols-[1.1fr_1fr_1fr_1fr_1.4fr] grid-rows-4 border-t border-line bg-white text-lg" style={{ height: 232 }}>
          <ModeKey active={mode === 'qty'} onClick={() => { setMode('qty'); freshKey.current = true; }}>Miqdor</ModeKey>
          <Key onClick={() => pressKey('1')}>1</Key>
          <Key onClick={() => pressKey('2')}>2</Key>
          <Key onClick={() => pressKey('3')}>3</Key>
          <button
            onClick={() => void openPayment()}
            disabled={(toPay <= 0) || saveMutation.isPending}
            className="row-span-3 flex flex-col items-center justify-center gap-1 bg-primary text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Spinner className="text-white" /> : <ChevronsRight size={30} />}
            <span className="text-lg font-bold">To‘lov</span>
            <span className="text-xs text-white/75">{num(toPay)} so‘m</span>
          </button>
          <ModeKey active={mode === 'people'} onClick={() => { setMode('people'); freshKey.current = true; }}>Mehmon</ModeKey>
          <Key onClick={() => pressKey('4')}>4</Key>
          <Key onClick={() => pressKey('5')}>5</Key>
          <Key onClick={() => pressKey('6')}>6</Key>
          <div className="flex items-center justify-center border-b border-r border-line px-2 text-center text-[11px] leading-tight text-ink-faint">
            {mode === 'qty' ? (selected ? byId.get(selected)?.name ?? '' : 'Mahsulot tanlang') : 'Mehmonlar soni'}
          </div>
          <Key onClick={() => pressKey('7')}>7</Key>
          <Key onClick={() => pressKey('8')}>8</Key>
          <Key onClick={() => pressKey('9')}>9</Key>
          <Key onClick={() => pressKey('⌫')}><Delete size={20} /></Key>
          <Key onClick={() => pressKey('0')}>0</Key>
          <Key onClick={() => pressKey('.')}>.</Key>
          <Key onClick={() => pressKey('C')}>C</Key>
          <button
            onClick={() => void save()}
            disabled={validDraft.length === 0 || saveMutation.isPending}
            className="border-l border-line bg-paper text-sm font-semibold hover:bg-primary-50 disabled:opacity-40"
          >
            Saqlash
          </button>
        </div>
      </section>

      {/* ===== Right: products ===== */}
      <section className="flex min-h-0 flex-col bg-white">
        <div className="space-y-3 px-5 pt-4">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish"
              className="h-12 w-full rounded-lg bg-[#f1f2f5] pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={!categoryId && !search} onClick={() => { setCategoryId(null); setSearch(''); }}>Hammasi</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={categoryId === c.id && !search} onClick={() => { setCategoryId(c.id); setSearch(''); }}>{c.name}</Chip>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {productsQuery.isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
              {visible.map((p) => {
                const img = assetUrl(p.thumbnailUrl ?? p.imageUrl);
                const inDraft = lines.some((l) => l.productId === p.id);
                return (
                  <button key={p.id} onClick={() => tapProduct(p)} className="group text-left active:scale-[0.97]">
                    <div className={cn('relative aspect-square overflow-hidden rounded-lg bg-[#eceef2] ring-1', inDraft ? 'ring-2 ring-primary' : 'ring-line')}>
                      {img ? (
                        <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-ink-faint"><UtensilsCrossed size={34} /></div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
                        <span className="text-base font-bold text-white">{num(p.price)}</span>
                        {isMassUnit(p.unit) && <span className="text-xs text-white/80"> / {p.unit === 'KG' ? 'kg' : 'l'}</span>}
                      </div>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold uppercase leading-tight">{p.name}</p>
                  </button>
                );
              })}
              {visible.length === 0 && <p className="col-span-full py-16 text-center text-sm text-ink-soft">Mahsulot topilmadi</p>}
            </div>
          )}
        </div>
      </section>

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}

      <Modal open={closeReason !== null} onClose={() => setCloseReason(null)} title="Qarz bilan yopish">
        <p className="text-sm text-ink-soft">Qarz {formatUzs(outstanding)} qoladi. Sabab audit jurnaliga yoziladi.</p>
        <div className="mt-3">
          <Field label="Sabab">
            <Textarea value={closeReason ?? ''} onChange={(e) => setCloseReason(e.target.value)} placeholder="Masalan: mijoz ertaga to‘laydi" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCloseReason(null)}>Bekor</Button>
          <Button variant="danger" disabled={(closeReason ?? '').trim().length < 3} loading={closeMutation.isPending} onClick={() => closeMutation.mutate((closeReason ?? '').trim())}>
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
          <Button variant="danger" disabled={(cancelReason ?? '').trim().length < 2} loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate((cancelReason ?? '').trim())}>
            Bekor qilish
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Key({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center border-b border-r border-line font-medium hover:bg-paper active:bg-primary-50">
      {children}
    </button>
  );
}

function ModeKey({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('flex items-center justify-center border-b border-r border-line text-sm font-semibold', active ? 'bg-[#dfe3e9] text-ink' : 'bg-[#f3f4f6] text-ink-soft')}>
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('h-11 shrink-0 rounded-lg px-5 text-sm font-semibold transition', active ? 'bg-[#243b31] text-white' : 'bg-[#f1f2f5] text-ink hover:bg-[#e6e8ec]')}
    >
      {children}
    </button>
  );
}
