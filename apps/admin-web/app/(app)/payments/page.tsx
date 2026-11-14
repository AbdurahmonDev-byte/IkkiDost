'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Printer, RotateCcw, Wallet } from 'lucide-react';
import type { OrderDto, PaymentDto, PaymentKind, RoomSessionSummaryDto } from '@ikki-dost/shared-types';
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
  StatCard,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { formatDateTime, formatQty, formatUzs, paymentKindLabel, rangeDefault } from '@/lib/format';

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState(rangeDefault());
  const [kind, setKind] = useState('');
  const [reverseTarget, setReverseTarget] = useState<PaymentDto | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<PaymentDto | null>(null);
  const [reason, setReason] = useState('');
  const [methodOpen, setMethodOpen] = useState(false);

  const paymentsQuery = useQuery({
    queryKey: ['payments', range],
    queryFn: () => api.payments({ from: `${range.from}T00:00:00.000Z`, to: `${range.to}T23:59:59.999Z` }),
  });
  const methodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.paymentMethods() });

  const payments = paymentsQuery.data ?? [];
  const filtered = kind ? payments.filter((p) => p.methodKind === kind) : payments;
  const totals = useMemo(() => {
    const valid = filtered.filter((p) => !p.reversedAt);
    const byMethod = new Map<string, number>();
    for (const p of valid) byMethod.set(p.methodName, (byMethod.get(p.methodName) ?? 0) + p.amount);
    return { total: valid.reduce((s, p) => s + p.amount, 0), byMethod: [...byMethod.entries()] };
  }, [filtered]);

  const reverseMutation = useMutation({
    mutationFn: () => api.reversePayment(reverseTarget!.id, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('To‘lov qaytarildi');
      setReverseTarget(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['payments'] });
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Qaytarib bo‘lmadi'),
  });

  return (
    <div>
      <PageHeader
        title="To‘lovlar"
        subtitle="Kirimlar, qaytarishlar va to‘lov usullari"
        actions={
          <Button variant="secondary" onClick={() => setMethodOpen(true)}>
            <Plus size={16} /> To‘lov usuli
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Davr tushumi" value={formatUzs(totals.total)} hint={`${filtered.filter((p) => !p.reversedAt).length} ta to‘lov`} icon={<Wallet size={18} />} />
        <StatCard
          label="Qaytarilgan"
          value={formatUzs(filtered.filter((p) => p.reversedAt).reduce((s, p) => s + p.amount, 0))}
          hint="Qaytarish sabablari auditda"
          icon={<RotateCcw size={18} />}
          tone="red"
        />
        <StatCard
          label="Naqd"
          value={formatUzs(filtered.filter((p) => !p.reversedAt && p.methodKind === 'CASH').reduce((s, p) => s + p.amount, 0))}
          hint="Naqd tushum"
          icon={<CreditCard size={18} />}
          tone="amber"
        />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-end gap-2 border-b border-line/70 px-4 py-3">
          <Field label="Boshlanish">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-auto" />
          </Field>
          <Field label="Tugash">
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-auto" />
          </Field>
          <Field label="Usul">
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto min-w-[140px]">
              <option value="">Barchasi</option>
              {(Object.keys(paymentKindLabel) as PaymentKind[]).map((k) => (
                <option key={k} value={k}>
                  {paymentKindLabel[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {paymentsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="To‘lov topilmadi" hint="Tanlangan davrda to‘lov yo‘q." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vaqt</Th>
                <Th>Summa</Th>
                <Th>Usul</Th>
                <Th>Qabul qilgan</Th>
                <Th>Izoh</Th>
                <Th>Holat</Th>
                <Th>Chek</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-paper/60">
                  <Td className="text-xs text-ink-soft">{formatDateTime(p.createdAt)}</Td>
                  <Td className="font-semibold">{formatUzs(p.amount)}</Td>
                  <Td>{p.methodName}</Td>
                  <Td className="text-ink-soft">{p.receivedByName}</Td>
                  <Td className="max-w-[200px] truncate text-xs text-ink-soft">{p.note || '—'}</Td>
                  <Td>
                    {p.reversedAt ? (
                      <Badge tone="red" className="cursor-help" title={p.reversalReason ?? ''}>
                        Qaytarilgan
                      </Badge>
                    ) : (
                      <Badge tone="green">Amalda</Badge>
                    )}
                  </Td>
                  <Td>
                    <button
                      onClick={() => setReceiptTarget(p)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
                      title="Chekni ko‘rish va chiqarish"
                    >
                      <Printer size={14} /> Chek
                    </button>
                  </Td>
                  <Td>
                    {!p.reversedAt && (
                      <button
                        onClick={() => setReverseTarget(p)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        title="Qaytarish"
                      >
                        <RotateCcw size={15} />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <PaymentReceiptModal payment={receiptTarget} onClose={() => setReceiptTarget(null)} />

      <Card className="mt-4">
        <CardHeader title="To‘lov usullari" subtitle="Kassir va ofitsiantlar foydalanadi" />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {(methodsQuery.data ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-[11px] text-ink-faint">{paymentKindLabel[m.kind]}</p>
              </div>
              <Badge tone={m.isActive ? 'green' : 'neutral'}>{m.isActive ? 'Faol' : 'O‘chirilgan'}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!reverseTarget} onClose={() => setReverseTarget(null)} title="To‘lovni qaytarish">
        <p className="text-sm text-ink-soft">
          {reverseTarget ? `${formatUzs(reverseTarget.amount)} · ${reverseTarget.methodName}` : ''} to‘lovi bekor qilinadi. Sabab audit jurnaliga yoziladi.
        </p>
        <div className="mt-3">
          <Field label="Sabab">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: mijoz qaytardi" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReverseTarget(null)}>
            Yopish
          </Button>
          <Button
            variant="danger"
            loading={reverseMutation.isPending}
            disabled={reason.trim().length < 2}
            onClick={() => reverseMutation.mutate()}
          >
            Qaytarish
          </Button>
        </div>
      </Modal>

      <PaymentMethodModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </div>
  );
}

function PaymentMethodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PaymentKind>('CASH');

  const mutation = useMutation({
    mutationFn: () => api.createPaymentMethod({ name: name.trim(), kind }),
    onSuccess: () => {
      toast.success('To‘lov usuli yaratildi');
      setName('');
      void qc.invalidateQueries({ queryKey: ['payment-methods'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yaratilmadi'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi to‘lov usuli">
      <div className="space-y-3">
        <Field label="Nomi">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Payme" />
        </Field>
        <Field label="Turi">
          <Select value={kind} onChange={(e) => setKind(e.target.value as PaymentKind)}>
            {(Object.keys(paymentKindLabel) as PaymentKind[]).map((k) => (
              <option key={k} value={k}>
                {paymentKindLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button loading={mutation.isPending} disabled={!name.trim()} onClick={() => mutation.mutate()}>
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type ReceiptData =
  | { type: 'order'; order: OrderDto }
  | { type: 'session'; session: RoomSessionSummaryDto & { orders: OrderDto[]; payments: PaymentDto[] } };

function PaymentReceiptModal({ payment, onClose }: { payment: PaymentDto | null; onClose: () => void }) {
  const receiptQuery = useQuery<ReceiptData>({
    queryKey: ['payment-receipt', payment?.id],
    enabled: !!payment,
    queryFn: async () => {
      if (!payment) throw new Error('To‘lov topilmadi');
      if (payment.orderId) return { type: 'order', order: await api.order(payment.orderId) };
      if (payment.roomSessionId) return { type: 'session', session: await api.roomSession(payment.roomSessionId) };
      throw new Error('Chek ma’lumoti topilmadi');
    },
  });

  const orders = receiptQuery.data?.type === 'order'
    ? [receiptQuery.data.order]
    : receiptQuery.data?.session.orders ?? [];
  const total = receiptQuery.data?.type === 'order'
    ? receiptQuery.data.order.totalAmount
    : receiptQuery.data?.session.totalAmount ?? 0;
  const paid = receiptQuery.data?.type === 'order'
    ? receiptQuery.data.order.paidAmount
    : receiptQuery.data?.session.paidAmount ?? 0;
  const roomName = orders[0]?.roomName;

  return (
    <Modal open={!!payment} onClose={onClose} title="To‘lov cheki" wide>
      {receiptQuery.isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : receiptQuery.error ? (
        <EmptyState title="Chekni yuklab bo‘lmadi" hint={receiptQuery.error instanceof Error ? receiptQuery.error.message : 'Xatolik yuz berdi'} />
      ) : payment ? (
        <div className="space-y-3">
          <div className="printable-receipt mx-auto max-w-sm rounded-lg border border-line p-5 text-sm text-ink">
            <header className="border-b border-dashed border-ink/40 pb-3 text-center">
              <p className="text-base font-bold">Ikki Do‘st Choyxonasi</p>
              <p className="mt-1 text-xs">To‘lov cheki</p>
              <p className="mt-1 text-xs">{formatDateTime(payment.createdAt)}</p>
              {roomName && <p className="mt-1 text-xs">Xona: {roomName}</p>}
              {orders.length > 0 && <p className="text-xs">Buyurtma: {orders.map((order) => `#${order.orderNumber}`).join(', ')}</p>}
            </header>

            <div className="space-y-3 py-3">
              {orders.map((order) => (
                <section key={order.id}>
                  {orders.length > 1 && <p className="mb-1 border-b border-dashed border-ink/30 pb-1 text-xs font-semibold">Buyurtma #{order.orderNumber}</p>}
                  {order.items.filter((item) => item.status !== 'CANCELLED').map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 py-0.5 text-xs">
                      <span className="min-w-0">{item.productName} · {formatQty(item.quantity, item.productUnit)} × {formatUzs(item.unitPrice)}</span>
                      <span className="shrink-0">{formatUzs(item.lineTotal)}</span>
                    </div>
                  ))}
                  {order.serviceFeeAmount > 0 && (
                    <div className="mt-1 flex justify-between border-t border-dashed border-ink/30 pt-1 text-xs">
                      <span>Xizmat haqi</span><span>{formatUzs(order.serviceFeeAmount)}</span>
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="space-y-1 border-t border-dashed border-ink/40 pt-2 text-xs">
              <div className="flex justify-between font-bold"><span>Jami</span><span>{formatUzs(total)}</span></div>
              <div className="flex justify-between"><span>To‘langan jami</span><span>{formatUzs(paid)}</span></div>
              <div className="flex justify-between"><span>Qoldiq</span><span>{formatUzs(Math.max(0, total - paid))}</span></div>
              <div className="mt-2 flex justify-between border-t border-dashed border-ink/30 pt-2 font-semibold">
                <span>Ushbu to‘lov · {payment.methodName}</span><span>{formatUzs(payment.amount)}</span>
              </div>
              <p className="pt-1 text-center">Kassir: {payment.receivedByName}</p>
              {payment.reversedAt && <p className="text-center font-semibold">QAYTARILGAN TO‘LOV</p>}
            </div>
          </div>
          <div className="receipt-actions flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Yopish</Button>
            <Button onClick={() => window.print()}><Printer size={15} /> Chek chiqarish</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
