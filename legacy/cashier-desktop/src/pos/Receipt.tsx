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
          <Button onClick={() => printReceipt(data)}>
            <Printer size={15} /> Chop etish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Self-contained 80 mm receipt page (plain HTML + inline CSS, no app styles). */
export function receiptHtml(data: ReceiptData): string {
  const items = data.orders.flatMap((o) => o.items.filter((i) => i.status !== 'CANCELLED'));
  const itemsTotal = data.orders.reduce((s, o) => s + o.itemsTotal, 0);
  const fee = data.orders.reduce((s, o) => s + o.serviceFeeAmount, 0);
  const payments = data.payments.filter((p) => !p.reversedAt);
  const row = (l: string, r: string, bold = false) =>
    `<div class="row${bold ? ' b' : ''}"><span>${esc(l)}</span><span>${esc(r)}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Chek</title><style>
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 3mm 4mm; width: 80mm; font-family: Consolas, 'Courier New', monospace; font-size: 12px; color: #000; }
.c { text-align: center; } .h { font-size: 15px; font-weight: bold; } .s { font-size: 11px; }
.hr { border-top: 1px dashed #000; margin: 6px 0; }
.row { display: flex; justify-content: space-between; gap: 6px; } .b { font-weight: bold; font-size: 14px; }
.it { display: flex; gap: 4px; } .it .n { flex: 1; } .it .q { width: 54px; text-align: right; } .it .t { width: 76px; text-align: right; }
</style></head><body>
<div class="c h">IKKI DO‘ST CHOYXONASI</div>
<div class="c s">Hisob-kitob cheki</div>
<div class="c s">${esc(formatDateTime(new Date().toISOString()))}</div>
<div class="hr"></div>
${row(data.heading, data.subheading ?? '')}
${data.details ? `<div class="s">${esc(data.details)}</div>` : ''}
<div class="hr"></div>
${items
  .map(
    (i) =>
      `<div class="it"><span class="n">${esc(i.productName)}</span><span class="q">${esc(formatQty(i.quantity, i.productUnit))}</span><span class="t">${esc(formatUzs(i.lineTotal))}</span></div>`,
  )
  .join('')}
<div class="hr"></div>
${row('Mahsulotlar', formatUzs(itemsTotal))}
${row('Xizmat haqi', formatUzs(fee))}
<div class="hr"></div>
${row('JAMI', formatUzs(data.total), true)}
${row('To‘langan', formatUzs(data.paid))}
${row('Qarz', formatUzs(data.outstanding), true)}
${payments.length ? `<div class="hr"></div>${payments.map((p) => row(`${p.methodName} · ${formatTime(p.createdAt)}`, formatUzs(p.amount))).join('')}` : ''}
<div class="hr"></div>
<div class="c">Xaridingiz uchun rahmat!</div>
<div style="height:8mm"></div>
</body></html>`;
}

/**
 * Prints only the receipt from a hidden iframe. Printing the whole app page
 * made the WebView2 print preview hang on Windows.
 */
export function printReceipt(data: ReceiptData): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    window.print();
    return;
  }
  doc.open();
  doc.write(receiptHtml(data));
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    // Some WebViews never fire afterprint.
    setTimeout(() => frame.isConnected && frame.remove(), 120_000);
  }, 150);
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
