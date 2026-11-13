import React from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
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
    <div className="receipt-overlay fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="receipt-no-print flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">Elektron chek</h3>
              <p className="text-[11px] text-stone-500">Buyurtma #{order.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-stone-100 p-3 sm:p-4">
          <div className="receipt-print mx-auto max-w-[320px] bg-white p-5 font-mono text-[11px] leading-relaxed text-stone-900 shadow-sm">
            <div className="text-center">
              <p className="text-base font-black tracking-wide">IKKI DO‘ST</p>
              <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Choyxonasi</p>
              <p className="mt-1 text-[10px] text-stone-500">Toshkent · +998 90 000 00 00</p>
            </div>

            <div className="my-3 border-t border-dashed border-stone-300" />

            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Chek:</span>
                <span className="font-bold">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Sana:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tur:</span>
                <span>{isDelivery ? 'Yetkazib berish' : `Xona: ${order.roomName ?? '—'}`}</span>
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

            <div className="space-y-1">
              {order.items
                .filter((i) => i.status !== 'CANCELLED')
                .map((i) => (
                  <div key={i.id}>
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 flex-1">{i.productName}</span>
                      <span className="shrink-0 font-bold">{money(i.lineTotal)}</span>
                    </div>
                    <div className="text-[10px] text-stone-500">
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

            <p className="text-center text-[10px] text-stone-500">
              Tashrifingiz uchun rahmat!
            </p>
            <p className="mt-1 text-center text-[9px] text-stone-400">
              Bu chek elektron shaklda berilgan.
            </p>
          </div>
        </div>

        <div className="receipt-no-print grid grid-cols-2 gap-2 border-t border-stone-100 p-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-stone-200 bg-white py-3 text-sm font-bold text-stone-700 active:scale-[0.98] transition-all"
          >
            Yopish
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3 text-sm font-bold text-white active:scale-[0.98] transition-all"
          >
            <Printer className="h-4 w-4" /> Chop etish
          </button>
        </div>
      </div>
    </div>
  );
};
