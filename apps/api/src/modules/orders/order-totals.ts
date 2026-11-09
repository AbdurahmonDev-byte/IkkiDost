import type { Prisma, OrderStatus } from '@prisma/client';

/**
 * Recomputes an order's cached totals from its items + payments (single source
 * of truth: item rows and payment rows). Must be called inside a transaction.
 */
export async function recomputeOrderTotals(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId, status: { not: 'CANCELLED' } } });
  const itemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const payments = await tx.payment.aggregate({
    where: { orderId, reversedAt: null },
    _sum: { amount: true },
  });
  const paidAmount = payments._sum.amount ?? 0;
  await tx.order.update({
    where: { id: orderId },
    data: { itemsTotal, totalAmount: itemsTotal + order.serviceFeeAmount, paidAmount },
  });
}

/** Recomputes a room session's cached totals from non-cancelled orders + live payments. */
export async function recomputeSessionTotals(tx: Prisma.TransactionClient, sessionId: string) {
  const orders = await tx.order.aggregate({
    where: { roomSessionId: sessionId, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
  });
  const sessionOrderIds = await tx.order.findMany({ where: { roomSessionId: sessionId }, select: { id: true } });
  const ids = sessionOrderIds.map((o) => idOf(o));
  const payments = await tx.payment.aggregate({
    where: { reversedAt: null, OR: [{ roomSessionId: sessionId }, { orderId: { in: ids } }] },
    _sum: { amount: true },
  });
  await tx.roomSession.update({
    where: { id: sessionId },
    data: { totalAmount: orders._sum.totalAmount ?? 0, paidAmount: payments._sum.amount ?? 0 },
  });
}

function idOf(o: { id: string }) {
  return o.id;
}

/** Derives the order status from its items' statuses. */
export function deriveOrderStatus(itemStatuses: string[], current: OrderStatus): OrderStatus {
  if (current === 'CANCELLED' || current === 'COMPLETED') return current;
  const active = itemStatuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return current;
  const served = active.filter((s) => s === 'SERVED').length;
  const ready = active.filter((s) => s === 'READY').length;
  const preparing = active.filter((s) => s === 'PREPARING').length;
  const pending = active.filter((s) => s === 'PENDING').length;

  if (served === active.length) return 'SERVED';
  if (served + ready === active.length) return 'READY';
  if (ready > 0 || served > 0) return 'PARTIALLY_READY';
  if (preparing > 0) return 'PREPARING';
  if (pending === active.length) return current === 'PENDING' ? current : 'CONFIRMED';
  return current;
}
