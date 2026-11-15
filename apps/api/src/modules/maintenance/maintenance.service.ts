import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface ClearedSalesHistory {
  orders: number;
  orderItems: number;
  payments: number;
  paymentReversals: number;
  deliveries: number;
  roomSessions: number;
  notifications: number;
  auditLogs: number;
}

/** Entities whose audit trail belongs to the sales history that gets wiped. */
const SALES_AUDIT_ENTITIES = ['Order', 'Payment', 'Delivery', 'RoomSession'];

@Injectable()
export class MaintenanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Deletes every sales record (orders, items, payments, deliveries, room
   * sessions, order notifications and their audit trail) so test data can be
   * cleared before go-live. Menu, staff, rooms, customers and expenses are
   * intentionally preserved.
   *
   * Everything runs in one transaction and is FK-safe: children first, then
   * orders, then the room sessions they belonged to.
   */
  async clearSalesHistory(actor: { id: string; fullName: string }) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const paymentReversals = await tx.paymentReversal.deleteMany({});
      const payments = await tx.payment.deleteMany({});
      const deliveries = await tx.delivery.deleteMany({});
      await tx.orderStatusHistory.deleteMany({});
      const orderItems = await tx.orderItem.deleteMany({});
      const orders = await tx.order.deleteMany({});
      const roomSessions = await tx.roomSession.deleteMany({});
      const notifications = await tx.notification.deleteMany({});
      const auditLogs = await tx.auditLog.deleteMany({
        where: { entity: { in: SALES_AUDIT_ENTITIES } },
      });

      await this.audit.log(
        {
          actorId: actor.id,
          actorName: actor.fullName,
          action: 'SALES_HISTORY_CLEARED',
          entity: 'Maintenance',
          details: {
            orders: orders.count,
            orderItems: orderItems.count,
            payments: payments.count,
            deliveries: deliveries.count,
            roomSessions: roomSessions.count,
          },
        },
        tx,
      );

      return {
        orders: orders.count,
        orderItems: orderItems.count,
        payments: payments.count,
        paymentReversals: paymentReversals.count,
        deliveries: deliveries.count,
        roomSessions: roomSessions.count,
        notifications: notifications.count,
        auditLogs: auditLogs.count,
      } satisfies ClearedSalesHistory;
    });

    return { status: 'ok' as const, deleted };
  }
}
