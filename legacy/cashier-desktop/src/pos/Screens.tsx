import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HourChart, TopProducts, WeekChart } from './Charts';
import { Banknote, Clock, CreditCard, Phone, Plus, RotateCcw } from 'lucide-react';
import type { OrderDto, PaymentDto, RoomDto } from '@ikki-dost/shared-types';
import { deliveryStatusLabel, elapsed, formatTime, formatUzs, isToday } from '../lib/format';
import { Badge, Button, Field, Modal, Spinner, Textarea, cn } from '../ui';

// ===================== Xonalar =====================

export function HallScreen({
  rooms,
  loading,
  onOpen,
}: {
  rooms: RoomDto[];
  loading: boolean;
  /** `people` is set when a free room is opened with a chosen guest count. */
  onOpen: (roomId: string, people?: number) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null);
  const active = rooms.filter((r) => r.isActive);
  if (loading) return <Center><Spinner /></Center>;
  return (
    <div className="h-full overflow-y-auto bg-white p-6" onClick={() => setPicker(null)}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-10 gap-y-12">
        {active.map((r) => {
          const s = r.activeSession;
          return (
            <div key={r.id} className="relative flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (s) onOpen(r.id);
                  else setPicker(picker === r.id ? null : r.id);
                }}
                className={cn(
                  'flex h-32 w-32 flex-col items-center justify-center rounded-md text-center shadow-sm transition active:scale-95',
                  s ? 'bg-[#243b31] text-white' : 'bg-[#d5d7dc] text-[#2c3340] hover:bg-[#c9ccd2]',
                )}
              >
                <span className="text-3xl font-bold leading-none">{r.name.replace(/^xona\s*/i, '')}</span>
                {s && (
                  <>
                    <span className="mt-2 max-w-[7rem] truncate text-sm">{s.openedByName ?? ''}</span>
                    <span className="mt-0.5 text-xs text-white/70">{formatUzs(s.totalAmount)}</span>
                  </>
                )}
              </button>
              {picker === r.id && (
                <div
                  className="absolute top-[8.5rem] z-20 w-24 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-line"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="border-b border-line py-2 text-center text-sm font-semibold">Mehmon</p>
                  <div className="max-h-52 overflow-y-auto">
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setPicker(null);
                          onOpen(r.id, n);
                        }}
                        className="block h-10 w-full border-b border-line/60 text-sm hover:bg-primary hover:text-white"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {active.length === 0 && <Center>Xonalar yo‘q — ega Mini App’da qo‘shadi.</Center>}
    </div>
  );
}

// ===================== Saboy =====================

export function SaboyScreen({ orders, loading, onOpen, onNew }: { orders: OrderDto[]; loading: boolean; onOpen: (orderId: string) => void; onNew: () => void }) {
  const list = orders
    .filter((o) => o.type === 'DELIVERY' && o.status !== 'CANCELLED' && (isToday(o.createdAt) || o.outstandingAmount > 0))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  if (loading) return <Center><Spinner /></Center>;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        <button
          onClick={onNew}
          className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
        >
          <Plus size={32} />
          <span className="text-lg font-bold">Yangi saboy</span>
          <span className="text-xs text-white/70">Olib ketish uchun</span>
        </button>
        {list.map((o) => (
          <button
            key={o.id}
            onClick={() => onOpen(o.id)}
            className={cn(
              'flex h-40 flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition active:scale-[0.98]',
              o.outstandingAmount > 0 ? 'ring-amber-300 hover:ring-amber-500' : 'ring-line hover:ring-primary/50',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-bold">#{o.orderNumber}</p>
              <Badge tone={o.outstandingAmount > 0 ? 'amber' : 'green'}>{o.outstandingAmount > 0 ? 'To‘lanmagan' : 'To‘langan'}</Badge>
            </div>
            <div>
              <p className="text-xl font-bold">{formatUzs(o.totalAmount)}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {o.items.filter((i) => i.status !== 'CANCELLED').length} xil mahsulot · {formatTime(o.createdAt)} · {o.createdByName}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===================== Bugun =====================

export function TodayScreen({
  payments,
  loading,
  onReverse,
  reversing,
}: {
  payments: PaymentDto[];
  loading: boolean;
  onReverse: (payment: PaymentDto, reason: string) => void;
  reversing: boolean;
}) {
  const [target, setTarget] = useState<PaymentDto | null>(null);
  const [reason, setReason] = useState('');
  const sorted = useMemo(() => [...payments].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [payments]);
  const totals = useMemo(() => todayTotals(payments), [payments]);
  const dashQuery = useQuery({ queryKey: ['dashboard'], queryFn: () => api.dashboard(), refetchInterval: 30_000 });
  const d = dashQuery.data;

  if (loading) return <Center><Spinner /></Center>;
  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Asosiy raqamlar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Kirim · ${totals.count} to‘lov`} value={formatUzs(totals.cash + totals.card + totals.other)} strong hint="Bugun kassaga tushgan pul" />
        <Stat label="Sof foyda" value={d ? formatUzs(d.todayProfit) : '…'} hint="Kirim − xarajat − taom tannarxi" tone={d && d.todayProfit < 0 ? 'red' : 'green'} />
        <Stat label="Xarajat" value={d ? formatUzs(d.todayExpenses) : '…'} hint={d ? `Taom tannarxi: ${formatUzs(d.todayCostOfGoods)}` : undefined} />
        <Stat label="To‘lanmagan qarz" value={d ? formatUzs(d.unpaidOutstanding) : '…'} hint={d ? `Ochiq xonalar: ${d.activeRooms}` : undefined} tone={d && d.unpaidOutstanding > 0 ? 'red' : undefined} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Banknote size={18} />} label="Naqd" value={formatUzs(totals.cash)} small />
        <Stat icon={<CreditCard size={18} />} label="Karta" value={formatUzs(totals.card)} small />
        <Stat label="Buyurtmalar" value={d ? `${d.todayOrderCount} ta` : '…'} small />
        <Stat label="Xizmat haqi" value={d ? formatUzs(d.serviceFeeRevenueToday) : '…'} small />
      </div>

      {/* Grafiklar */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel title="Oxirgi 7 kun: kirim, xarajat, foyda">
          {d ? <WeekChart data={d.revenueByDay} /> : <Center><Spinner /></Center>}
        </Panel>
        <Panel title="Bugun eng ko‘p sotilgan taomlar">
          {d ? <TopProducts items={d.popularProducts} /> : <Center><Spinner /></Center>}
        </Panel>
      </div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel title="Bugun soatlar bo‘yicha kirim">
          {!d ? <Center><Spinner /></Center> : d.hourlySales.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">Bugun hali to‘lov yo‘q</p>
          ) : <HourChart data={d.hourlySales} />}
        </Panel>
      <div>
      <p className="mb-2 text-sm font-semibold">Bugungi to‘lovlar</p>
      <div className="max-h-[420px] overflow-y-auto rounded-2xl bg-white shadow-sm ring-1 ring-line">
        {sorted.length === 0 && <p className="px-6 py-14 text-center text-sm text-ink-soft">Bugun hali to‘lov yo‘q</p>}
        {sorted.map((p) => (
          <div key={p.id} className={cn('flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0', p.reversedAt && 'opacity-60')}>
            <span className="w-12 text-sm text-ink-soft">{formatTime(p.createdAt)}</span>
            <span className="w-28 whitespace-nowrap text-base font-bold">{formatUzs(p.amount)}</span>
            <span className="w-14 text-sm">{p.methodName}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{p.receivedByName}</span>
            {p.reversedAt ? (
              <Badge tone="red">Qaytarilgan</Badge>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => { setTarget(p); setReason(''); }}>
                <RotateCcw size={14} /> Qaytarish
              </Button>
            )}
          </div>
        ))}
      </div>

      </div>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title="To‘lovni qaytarish">
        <p className="text-sm text-ink-soft">{target ? `${formatUzs(target.amount)} · ${target.methodName}` : ''} qaytariladi. Sabab audit jurnaliga yoziladi.</p>
        <div className="mt-3">
          <Field label="Sabab">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: xato to‘lov" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTarget(null)}>Yopish</Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 2}
            loading={reversing}
            onClick={() => {
              if (target) onReverse(target, reason.trim());
              setTarget(null);
            }}
          >
            Qaytarish
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function todayTotals(payments: PaymentDto[]) {
  const t = { cash: 0, card: 0, other: 0, count: 0 };
  for (const p of payments) {
    if (p.reversedAt) continue;
    t.count += 1;
    if (p.methodKind === 'CASH') t.cash += p.amount;
    else if (p.methodKind === 'CARD') t.card += p.amount;
    else t.other += p.amount;
  }
  return t;
}

function Stat({
  icon,
  label,
  value,
  strong,
  hint,
  tone,
  small,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
  tone?: 'green' | 'red';
  small?: boolean;
}) {
  return (
    <div className={cn('rounded-2xl shadow-sm ring-1', small ? 'p-3' : 'p-4', strong ? 'bg-primary text-white ring-primary' : 'bg-white ring-line')}>
      <p className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase', strong ? 'text-white/70' : 'text-ink-soft')}>{icon}{label}</p>
      <p className={cn('mt-1 font-bold', small ? 'text-lg' : 'text-2xl', tone === 'green' && 'text-emerald-700', tone === 'red' && 'text-red-600')}>{value}</p>
      {hint && <p className={cn('mt-0.5 text-[11px]', strong ? 'text-white/70' : 'text-ink-faint')}>{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-3 w-3 rounded', className)} /> {label}
    </span>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center p-10 text-sm text-ink-soft">{children}</div>;
}
