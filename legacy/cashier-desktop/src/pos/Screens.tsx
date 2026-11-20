import { useMemo, useState } from 'react';
import { Banknote, Clock, CreditCard, Phone, Plus, RotateCcw } from 'lucide-react';
import type { OrderDto, PaymentDto, RoomDto } from '@ikki-dost/shared-types';
import { deliveryStatusLabel, elapsed, formatTime, formatUzs, isToday } from '../lib/format';
import { Badge, Button, Field, Modal, Spinner, Textarea, cn } from '../ui';

// ===================== Zal =====================

export function HallScreen({ rooms, loading, onOpen }: { rooms: RoomDto[]; loading: boolean; onOpen: (roomId: string) => void }) {
  const active = rooms.filter((r) => r.isActive);
  const busy = active.filter((r) => r.activeSession).length;
  if (loading) return <Center><Spinner /></Center>;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-3 text-sm text-ink-soft">
        <Legend className="bg-white ring-1 ring-line" label={`Bo‘sh: ${active.length - busy}`} />
        <Legend className="bg-amber-400" label={`Band: ${busy}`} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {active.map((r) => {
          const s = r.activeSession;
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r.id)}
              className={cn(
                'flex h-40 flex-col justify-between rounded-2xl p-4 text-left shadow-sm ring-1 transition active:scale-[0.98]',
                s ? 'bg-amber-50 ring-amber-300 hover:ring-amber-500' : 'bg-white ring-line hover:ring-primary/50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-bold leading-tight">{r.name}</p>
                {s ? <Badge tone={s.outstandingAmount > 0 ? 'amber' : 'green'}>{s.outstandingAmount > 0 ? 'Band' : 'To‘langan'}</Badge> : <Badge tone="green">Bo‘sh</Badge>}
              </div>
              {s ? (
                <div>
                  <p className="text-2xl font-bold">{formatUzs(s.totalAmount)}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
                    <span className="flex items-center gap-1"><Clock size={12} /> {elapsed(s.openedAt)}</span>
                    {s.outstandingAmount > 0 && <span className="font-semibold text-red-600">Qarz {formatUzs(s.outstandingAmount)}</span>}
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Plus size={16} /> Buyurtma ochish</p>
              )}
            </button>
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
          <span className="text-xs text-white/70">Telefon orqali buyurtma</span>
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
              <div className="min-w-0">
                <p className="text-lg font-bold">#{o.orderNumber}</p>
                <p className="truncate text-sm font-semibold">{o.delivery?.customerName}</p>
              </div>
              <Badge tone={o.outstandingAmount > 0 ? 'amber' : 'green'}>{o.outstandingAmount > 0 ? 'To‘lanmagan' : 'To‘langan'}</Badge>
            </div>
            <div>
              <p className="text-xl font-bold">{formatUzs(o.totalAmount)}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-soft">
                <span className="flex items-center gap-1 truncate"><Phone size={12} /> {o.delivery?.customerPhone}</span>
                <span>{o.delivery ? deliveryStatusLabel[o.delivery.status] : ''} · {formatTime(o.createdAt)}</span>
              </div>
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

  if (loading) return <Center><Spinner /></Center>;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Banknote size={18} />} label="Naqd" value={formatUzs(totals.cash)} />
        <Stat icon={<CreditCard size={18} />} label="Karta" value={formatUzs(totals.card)} />
        <Stat label="Boshqa" value={formatUzs(totals.other)} />
        <Stat label={`Jami · ${totals.count} to‘lov`} value={formatUzs(totals.cash + totals.card + totals.other)} strong />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
        {sorted.length === 0 && <p className="px-6 py-14 text-center text-sm text-ink-soft">Bugun hali to‘lov yo‘q</p>}
        {sorted.map((p) => (
          <div key={p.id} className={cn('flex items-center gap-4 border-b border-line/70 px-4 py-3 last:border-0', p.reversedAt && 'opacity-60')}>
            <span className="w-14 text-sm text-ink-soft">{formatTime(p.createdAt)}</span>
            <span className="w-32 text-base font-bold">{formatUzs(p.amount)}</span>
            <span className="w-24 text-sm">{p.methodName}</span>
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

function Stat({ icon, label, value, strong }: { icon?: React.ReactNode; label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-2xl p-4 shadow-sm ring-1', strong ? 'bg-primary text-white ring-primary' : 'bg-white ring-line')}>
      <p className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase', strong ? 'text-white/70' : 'text-ink-soft')}>{icon}{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
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
