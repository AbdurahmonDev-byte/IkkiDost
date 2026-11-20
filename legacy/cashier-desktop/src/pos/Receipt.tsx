import { Printer } from 'lucide-react';
import type { OrderDto, PaymentDto } from '@ikki-dost/shared-types';
import { formatDateTime, formatQty, formatTime, formatUzs } from '../lib/format';
import { Button, Modal, cn } from '../ui';

export interface ReceiptData {
  heading: string;
  subheading?: string;
  details?: string;
  orders: OrderDto[];
  total: number;
  paid: number;
  outstanding: number;
  payments: PaymentDto[];
}

/** 80 mm customer check; printing hides everything except `#receipt-print`. */
export function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const items = data.orders.flatMap((o) =>
    o.items
      .filter((i) => i.status !== 'CANCELLED')
      .map((i) => ({ id: i.id, name: i.productName, qty: formatQty(i.quantity, i.productUnit), total: i.lineTotal })),
  );
  const itemsTotal = data.orders.reduce((s, o) => s + o.itemsTotal, 0);
  const fee = data.orders.reduce((s, o) => s + o.serviceFeeAmount, 0);
  const payments = data.payments.filter((p) => !p.reversedAt);

  return (
    <Modal open onClose={onClose} title="Chek" wide>
      <div className="mx-auto max-w-md">
        <div id="receipt-print" className="rounded-xl border border-dashed border-line bg-white p-5 font-mono text-[12px] text-ink">
          <div className="text-center">
            <p className="text-base font-bold tracking-wide">IKKI DO‘ST CHOYXONASI</p>
            <p className="text-[10px] text-ink-soft">Hisob-kitob cheki</p>
            <p className="mt-1 text-[10px]">{formatDateTime(new Date().toISOString())}</p>
          </div>
          <Divider />
          <div className="flex justify-between text-[11px]">
            <span>{data.heading}</span>
            <span>{data.subheading}</span>
          </div>
          {data.details && <p className="mt-0.5 text-[10px] text-ink-soft">{data.details}</p>}
          <Divider />
          <div className="space-y-1">
            {items.map((i) => (
              <div key={i.id} className="flex gap-2 text-[11px]">
                <span className="min-w-0 flex-1">{i.name}</span>
                <span className="w-14 text-right text-ink-soft">{i.qty}</span>
                <span className="w-20 text-right">{formatUzs(i.total)}</span>
              </div>
            ))}
          </div>
          <Divider />
          <Row label="Mahsulotlar" value={formatUzs(itemsTotal)} />
          <Row label="Xizmat haqi" value={formatUzs(fee)} />
          <div className="my-1 border-t border-dashed border-ink/30" />
          <Row label="JAMI" value={formatUzs(data.total)} bold />
          <Row label="To‘langan" value={formatUzs(data.paid)} />
          <Row label="Qarz" value={formatUzs(data.outstanding)} bold />
          {payments.length > 0 && (
            <>
              <Divider />
              <p className="text-[10px] font-bold">TO‘LOVLAR</p>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-[10px]">
                  <span>
                    {p.methodName} · {formatTime(p.createdAt)}
                  </span>
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

function Divider() {
  return <div className="my-2 border-t border-dashed border-ink/30" />;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between text-[11px]', bold && 'text-sm font-bold')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
