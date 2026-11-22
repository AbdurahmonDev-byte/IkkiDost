import { money, qty } from './format.js';
import type { OrderDto, RoomSessionDetailDto } from './types.js';

/** Escape text for Telegram HTML parse mode. */
export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(left: string, right: string, width = 38): string {
  const l = left.length > width - right.length - 1 ? left.slice(0, width - right.length - 4) + '…' : left;
  const gap = Math.max(1, width - l.length - right.length);
  return l + ' '.repeat(gap) + right;
}

function line(ch = '-', width = 38): string {
  return ch.repeat(width);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 80mm-style plain-text receipt for one order. */
export function orderReceipt(order: OrderDto, opts?: { roomName?: string }): string {
  const rows: string[] = [
    '        IKKI DO‘ST',
    '   choyxonasi · sotuv cheki',
    line(),
    `Buyurtma #${order.orderNumber}  ${formatDateTime(order.createdAt)}`,
    order.type === 'DELIVERY'
      ? `Yetkazish · ${order.delivery?.customerName ?? ''}`
      : `Xona · ${opts?.roomName ?? order.roomName ?? ''}`,
    `Xodim: ${order.createdByName}`,
  ];
  if (order.delivery) rows.push(`Tel: ${order.delivery.customerPhone}`, `${order.delivery.address}`);
  rows.push(line());
  for (const item of order.items) {
    if (item.status === 'CANCELLED') continue;
    rows.push(row(`${item.productName} ×${qty(item.quantity, item.productUnit)}`, money(item.lineTotal)));
  }
  rows.push(line());
  rows.push(row('Taomlar:', money(order.itemsTotal)));
  if (order.serviceFeeAmount > 0) rows.push(row(`Xizmat haqi (${order.numberOfPeople} kishi):`, money(order.serviceFeeAmount)));
  rows.push(row('JAMI:', money(order.totalAmount)));
  rows.push(line());
  rows.push('Rahmat! Yana kutib qolamiz.');
  return rows.join('\n');
}

/** Session-level receipt (all orders in a room visit). */
export function sessionReceipt(detail: RoomSessionDetailDto, roomName: string): string {
  const rows: string[] = [
    '        IKKI DO‘ST',
    '   choyxonasi · umumiy hisob',
    line(),
    `${roomName} · ${formatDateTime(detail.openedAt)}`,
    line(),
  ];
  for (const order of detail.orders) {
    if (order.status === 'CANCELLED') continue;
    rows.push(`#${order.orderNumber}`);
    for (const item of order.items) {
      if (item.status === 'CANCELLED') continue;
      rows.push(row(`  ${item.productName} ×${qty(item.quantity, item.productUnit)}`, money(item.lineTotal)));
    }
    if (order.serviceFeeAmount > 0) rows.push(row(`  xizmat haqi (${order.numberOfPeople})`, money(order.serviceFeeAmount)));
  }
  rows.push(line());
  rows.push(row('JAMI:', money(detail.totalAmount)));
  rows.push(row('To‘langan:', money(detail.paidAmount)));
  rows.push(row('Qoldiq:', money(detail.outstandingAmount)));
  rows.push(line());
  rows.push('Rahmat! Yana kutib qolamiz.');
  return rows.join('\n');
}

/** Wrap a receipt in an HTML <pre> block for Telegram. */
export function receiptMessage(receipt: string): string {
  return `<pre>${esc(receipt)}</pre>`;
}
