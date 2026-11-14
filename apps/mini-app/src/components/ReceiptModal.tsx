import React from 'react';
import { CheckCircle2, Printer, ReceiptText, X } from 'lucide-react';
import { money, orderStatusLabel, qty } from '../lib/format';
import type { OrderDto } from '../lib/types';

interface Props {
  order: OrderDto | null;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ReceiptModal: React.FC<Props> = ({ order, onClose }) => {
  if (!order) return null;

  const isDelivery = order.type === 'DELIVERY';
  const paid = order.paidAmount ?? 0;
  const outstanding = order.outstandingAmount ?? Math.max(0, order.totalAmount - paid);

  return (
    <div className="receipt-overlay fixed inset-0 z-[60] flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] bg-[#fffdfa] shadow-2xl animate-rise sm:rounded-[30px]">
        <div className="receipt-no-print relative overflow-hidden border-b border-stone-100 px-4 py-3.5">
          <div className="pointer-events-none absolute -right-10 -top-16 h-32 w-32 rounded-full bg-emerald-200/50 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="icon-tile bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-600/30">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-black leading-tight text-stone-900">
                  Elektron chek
                </h3>
                <p className="truncate text-[11.5px] font-medium text-stone-500">
                  Buyurtma #{order.orderNumber} · {orderStatusLabel[order.status]}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="tap shrink-0 rounded-2xl border border-stone-200/80 bg-white p-2.5 text-stone-400 shadow-sm hover:text-stone-700"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f6f1e8] p-3 sm:p-4">
          <div className="receipt-print mx-auto max-w-[330px] rounded-sm bg-white p-5 font-mono text-[11px] leading-relaxed text-stone-900 shadow-[0_10px_30px_-18px_rgba(60,40,20,0.6)]">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-lg text-white">
                🫖
              </div>
              <p className="text-base font-black tracking-[0.12em]">IKKI DO‘ST</p>
              <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500">Choyxonasi</p>
              <p className="mt-1 text-[9.5px] text-stone-500">Toshkent · +998 90 000 00 00</p>
            </div>

            <div className="my-3 border-t border-dashed border-stone-300" />

            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Chek:</span>
                <span className="font-bold">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Sana:</span>
                <span className="text-right">{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Tur:</span>
                <span className="text-right">
                  {isDelivery ? 'Yetkazib berish' : `Xona: ${order.roomName ?? '—'}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Holat:</span>
                <span>{orderStatusLabel[order.status]}</span>
              </div>
              {isDelivery && order.delivery && (
                <>
                  <div className="flex justify-between gap-2">
                    <span>Mijoz:</span>
                    <span className="text-right">{order.delivery.customerName}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Telefon:</span>
                    <span className="text-right">{order.delivery.customerPhone}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Manzil:</span>
                    <span className="max-w-[170px] text-right">{order.delivery.address}</span>
                  </div>
                </>
              )}
            </div>

            <div className="my-3 border-t border-dashed border-stone-300" />

            <div className="space-y-1.5">
              {order.items
                .filter((i) => i.status !== 'CANCELLED')
                .map((i) => (
                  <div key={i.id}>
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 flex-1">{i.productName}</span>
                      <span className="shrink-0 font-bold">{money(i.lineTotal)}</span>
                    </div>
                    <div className="text-[9.5px] text-stone-500">
                      {qty(i.quantity, i.productUnit)} × {money(i.unitPrice)}
                      {i.note ? ` · ${i.note}` : ''}
                    </div>
                  </div>
                ))}
            </div>

            <div className="my-3 border-t border-dashed border-stone-300" />

            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Taomlar:</span>
                <span>{money(order.itemsTotal)}</span>
              </div>
              {order.serviceFeeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Xizmat haqi:</span>
                  <span>{money(order.serviceFeeAmount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-stone-300 pt-1 text-sm font-black">
                <span>JAMI:</span>
                <span>{money(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>To‘langan:</span>
                <span>{money(paid)}</span>
              </div>
              {outstanding > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Qarz:</span>
                  <span>{money(outstanding)}</span>
                </div>
              )}
            </div>

            <div className="my-3 border-t border-dashed border-stone-300" />

            <p className="text-center text-[10px] font-bold text-stone-700">
              Tashrifingiz uchun rahmat!
            </p>
            <p className="mt-1 text-center text-[9px] text-stone-400">
              Bu chek elektron shaklda berilgan.
            </p>
          </div>
        </div>

        <div className="receipt-no-print grid grid-cols-2 gap-2 border-t border-stone-100 bg-[#fffdfa] p-4 pb-safe">
          <button onClick={onClose} className="btn-secondary py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Yopish
          </button>
          <button onClick={() => window.print()} className="btn-primary py-3">
            <Printer className="h-4 w-4" /> Chop etish
          </button>
        </div>
      </div>
    </div>
  );
};
