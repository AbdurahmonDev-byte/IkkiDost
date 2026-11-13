import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryDto } from '@ikki-dost/shared-types';
import { RtEvent } from '@ikki-dost/shared-types';
import type { AssignDeliveryInput, HandoverDeliveryCashInput, UpdateDeliveryStatusInput } from '@ikki-dost/validation';
import type { DeliveryStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { mapDelivery } from '../../common/mappers';

/** Allowed forward transitions for delivery status. */
const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const CLAIMABLE: DeliveryStatus[] = ['CONFIRMED', 'PREPARING', 'READY'];
const ACTIVE: DeliveryStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

type Actor = { id: string; fullName: string; role: Role };

const deliveryInclude = {
  assignedTo: true,
  order: { include: { items: { orderBy: { createdAt: 'asc' as const } } } },
} satisfies Prisma.DeliveryInclude;

@Injectable()
export class DeliveriesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private rt: RealtimeService,
    private notifications: NotificationsService,
    private orders: OrdersService,
    private payments: PaymentsService,
  ) {}

  async findAll(actor: Actor, opts: { status?: string } = {}): Promise<DeliveryDto[]> {
    const where: Prisma.DeliveryWhereInput = {};
    if (opts.status) where.status = opts.status as DeliveryStatus;
    if (actor.role === 'DELIVERY') {
      where.OR = [
        { assignedToId: actor.id },
        { assignedToId: null, status: { in: CLAIMABLE } },
      ];
    }
    const rows = await this.prisma.delivery.findMany({
      where,
      include: deliveryInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => mapDelivery(row));
  }

  async getOne(id: string, actor: Actor): Promise<DeliveryDto> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id }, include: deliveryInclude });
    if (!delivery) throw new NotFoundException('Yetkazish topilmadi');
    this.assertCanView(delivery.assignedToId, delivery.status, actor);
    return mapDelivery(delivery);
  }

  /** Delivery person takes an unassigned ready/preparing delivery. */
  async claim(id: string, actor: Actor): Promise<DeliveryDto> {
    if (actor.role !== 'DELIVERY' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Yetkazishni faqat kuryer yoki egasi qabul qiladi');
    }
    const dto = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({ where: { id } });
      if (!delivery) throw new NotFoundException('Yetkazish topilmadi');
      if (delivery.assignedToId && delivery.assignedToId !== actor.id && actor.role !== 'OWNER') {
        throw new BadRequestException('Bu yetkazish allaqachon boshqa kuryerga biriktirilgan');
      }
      if (!CLAIMABLE.includes(delivery.status)) {
        throw new BadRequestException('Bu yetkazishni hozir qabul qilib bo‘lmaydi');
      }
      await tx.delivery.update({ where: { id }, data: { assignedToId: actor.id } });
      await this.audit.log(
        { actorId: actor.id, actorName: actor.fullName, action: 'DELIVERY_CLAIMED', entity: 'Delivery', entityId: id },
        tx,
      );
      return tx.delivery.findUniqueOrThrow({ where: { id }, include: deliveryInclude });
    });
    const mapped = mapDelivery(dto);
    this.rt.emitToRoles(['OWNER', 'WAITER', 'CASHIER'], RtEvent.DELIVERY_STATUS_CHANGED, mapped);
    return mapped;
  }

  async updateStatus(id: string, input: UpdateDeliveryStatusInput, actor: Actor): Promise<DeliveryDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id },
        include: { order: { include: { customer: true } } },
      });
      if (!delivery) throw new NotFoundException('Yetkazish topilmadi');

      // Delivery staff must claim the delivery before changing its status.
      if (actor.role === 'DELIVERY' && delivery.assignedToId !== actor.id) {
        throw new BadRequestException('Avval yetkazishni qabul qiling');
      }
      // Couriers only control the hand-off; kitchen readiness is set by CHEF.
      if (actor.role === 'DELIVERY' && input.status !== 'OUT_FOR_DELIVERY' && input.status !== 'DELIVERED') {
        throw new ForbiddenException('Kuryer faqat «yo‘lda» va «yetkazildi» holatini o‘rnatadi');
      }
      if (actor.role !== 'OWNER' && actor.role !== 'DELIVERY' && delivery.assignedToId && delivery.assignedToId !== actor.id) {
        throw new BadRequestException('Bu yetkazish sizga biriktirilmagan');
      }

      const allowed = TRANSITIONS[delivery.status];
      if (!allowed.includes(input.status)) {
        throw new BadRequestException(`${delivery.status} holatdan ${input.status} holatga o‘tib bo‘lmaydi`);
      }

      // Cash reconciliation: the courier records what they collected on delivery.
      const outstanding = Math.max(0, delivery.order.totalAmount - delivery.order.paidAmount);
      let cashCollectedAmount: number | undefined;
      let cashCollectedAt: Date | null | undefined;
      if (input.status === 'DELIVERED') {
        const collected = input.cashCollectedAmount ?? (outstanding > 0 ? outstanding : 0);
        if (collected > outstanding) {
          throw new BadRequestException(
            `Naqd summa qarzdorlikdan oshmasligi kerak (qoldiq: ${outstanding} so‘m)`,
          );
        }
        cashCollectedAmount = collected;
        cashCollectedAt = collected > 0 ? new Date() : null;
      }

      await tx.delivery.update({
        where: { id },
        data: { status: input.status, cashCollectedAmount, cashCollectedAt },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          fromStatus: delivery.status,
          toStatus: input.status,
          actorId: actor.id,
          note: 'Yetkazish holati',
        },
      });
      if (input.status === 'DELIVERED') {
        await this.orders.markCompletedIfEligible(tx, delivery.orderId, actor.id);
      }
      const fresh = await tx.delivery.findUniqueOrThrow({ where: { id }, include: deliveryInclude });
      return { delivery: fresh, customerTelegramId: delivery.order.customer?.telegramId ?? null, orderNumber: delivery.order.orderNumber };
    });

    const mapped = mapDelivery(result.delivery);
    this.rt.emitToRoles(['OWNER', 'WAITER', 'CASHIER', 'DELIVERY'], RtEvent.DELIVERY_STATUS_CHANGED, mapped);
    if (result.customerTelegramId && (input.status === 'OUT_FOR_DELIVERY' || input.status === 'DELIVERED')) {
      await this.notifyCustomer(result.customerTelegramId, result.orderNumber, input.status);
    }
    if (input.status === 'OUT_FOR_DELIVERY') {
      await this.notifications.notifyRole('OWNER', {
        type: 'DELIVERY_OUT',
        title: `🛵 Buyurtma #${result.orderNumber} yo‘lda`,
        body: `${mapped.customerName} · ${mapped.address}`,
        data: { orderId: mapped.orderId, deliveryId: id },
      });
    }
    if (input.status === 'DELIVERED' && (mapped.cashCollectedAmount ?? 0) > 0) {
      const cash = mapped.cashCollectedAmount ?? 0;
      await Promise.all([
        this.notifications.notifyRole('CASHIER', {
          type: 'DELIVERY_CASH_PENDING',
          title: `💵 Kuryer pul topshirmoqda (#${result.orderNumber})`,
          body: `${mapped.customerName} · ${cash.toLocaleString('uz-UZ')} so‘m naqd. Kassir tasdiqlashi kerak.`,
          data: { orderId: mapped.orderId, deliveryId: id, cashCollectedAmount: cash },
        }),
        this.notifications.notifyRole('OWNER', {
          type: 'DELIVERY_CASH_PENDING',
          title: `💵 Kuryer pul topshirmoqda (#${result.orderNumber})`,
          body: `${mapped.customerName} · ${cash.toLocaleString('uz-UZ')} so‘m naqd. Kassir tasdiqlashi kerak.`,
          data: { orderId: mapped.orderId, deliveryId: id, cashCollectedAmount: cash },
        }),
      ]);
    }
    return mapped;
  }

  /**
   * Cashier/owner confirms the courier handed over the collected cash.
   * Records the payment (default: active CASH method) and closes the loop.
   */
  async handoverCash(
    id: string,
    input: HandoverDeliveryCashInput,
    actor: { id: string; fullName: string },
  ): Promise<DeliveryDto> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundException('Yetkazish topilmadi');
    if (delivery.status !== 'DELIVERED') {
      throw new BadRequestException('Faqat yetkazilgan buyurtma uchun pul topshiriladi');
    }
    if (delivery.cashHandedOverAt) {
      throw new BadRequestException('Bu yetkazish uchun pul allaqachon qabul qilingan');
    }
    const collected = delivery.cashCollectedAmount ?? 0;
    if (collected <= 0) {
      throw new BadRequestException('Kuryer naqd pul qayd etmagan');
    }

    const outstanding = Math.max(0, delivery.order.totalAmount - delivery.order.paidAmount);
    if (outstanding > 0) {
      const method = input.methodId
        ? await this.prisma.paymentMethod.findUnique({ where: { id: input.methodId } })
        : await this.prisma.paymentMethod.findFirst({
            where: { kind: 'CASH', isActive: true },
            orderBy: { name: 'asc' },
          });
      if (!method || !method.isActive) {
        throw new BadRequestException('Faol naqd to‘lov usuli topilmadi');
      }
      const amount = Math.min(collected, outstanding);
      await this.payments.payOrder(
        delivery.orderId,
        {
          amount,
          methodId: method.id,
          note: input.note?.trim() || `Kuryer naqd puli (#${delivery.orderId.slice(0, 8)})`,
          idempotencyKey: `delivery-cash-${id}`,
        },
        actor,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.delivery.update({
        where: { id },
        data: { cashHandedOverAt: new Date() },
        include: deliveryInclude,
      });
      await this.audit.log(
        {
          actorId: actor.id,
          actorName: actor.fullName,
          action: 'DELIVERY_CASH_HANDED_OVER',
          entity: 'Delivery',
          entityId: id,
          details: { cashCollectedAmount: collected, outstanding, paidNow: Math.min(collected, outstanding) },
        },
        tx,
      );
      return fresh;
    });

    const mapped = mapDelivery(updated);
    this.rt.emitToRoles(['OWNER', 'CASHIER', 'DELIVERY', 'WAITER'], RtEvent.DELIVERY_STATUS_CHANGED, mapped);
    if (mapped.assignedToId) {
      this.rt.emitToUser(mapped.assignedToId, RtEvent.DELIVERY_STATUS_CHANGED, mapped);
      await this.notifications.notifyUser(mapped.assignedToId, {
        type: 'DELIVERY_CASH_CONFIRMED',
        title: `✅ Pul qabul qilindi (#${mapped.orderNumber})`,
        body: `Kassir ${collected.toLocaleString('uz-UZ')} so‘m naqd pulni tasdiqladi.`,
        data: { orderId: mapped.orderId, deliveryId: id },
      });
    }
    return mapped;
  }

  async assign(id: string, input: AssignDeliveryInput, actor: { id: string; fullName: string }): Promise<DeliveryDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({ where: { id } });
      if (!delivery) throw new NotFoundException('Yetkazish topilmadi');
      if (input.assignedToId) {
        const user = await tx.user.findUnique({ where: { id: input.assignedToId } });
        if (!user || !user.isActive) throw new NotFoundException('Xodim topilmadi yoki faol emas');
        if (user.role !== 'DELIVERY' && user.role !== 'OWNER' && user.role !== 'WAITER') {
          throw new BadRequestException('Bu xodim yetkazishni qabul qila olmaydi');
        }
      }
      await tx.delivery.update({ where: { id }, data: { assignedToId: input.assignedToId } });
      await this.audit.log(
        {
          actorId: actor.id,
          actorName: actor.fullName,
          action: 'DELIVERY_ASSIGNED',
          entity: 'Delivery',
          entityId: id,
          details: { assignedToId: input.assignedToId },
        },
        tx,
      );
      return tx.delivery.findUniqueOrThrow({ where: { id }, include: deliveryInclude });
    });
    const mapped = mapDelivery(dto);
    if (mapped.assignedToId) this.rt.emitToUser(mapped.assignedToId, RtEvent.DELIVERY_STATUS_CHANGED, mapped);
    this.rt.emitToRoles(['OWNER', 'DELIVERY'], RtEvent.DELIVERY_STATUS_CHANGED, mapped);
    return mapped;
  }

  private assertCanView(assignedToId: string | null, status: DeliveryStatus, actor: Actor): void {
    if (actor.role !== 'DELIVERY') return;
    if (assignedToId === actor.id) return;
    if (!assignedToId && CLAIMABLE.includes(status)) return;
    throw new ForbiddenException('Bu yetkazish sizga ko‘rinmaydi');
  }

  private async notifyCustomer(telegramId: string, orderNumber: number, status: 'OUT_FOR_DELIVERY' | 'DELIVERED'): Promise<void> {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) return;
    const text =
      status === 'OUT_FOR_DELIVERY'
        ? `🛵 Buyurtmangiz #${orderNumber} yo‘lga chiqdi. Kuryer tez orada yetib boradi.`
        : `✅ Buyurtmangiz #${orderNumber} yetkazildi. Ikki Do‘st choyxonasini tanlaganingiz uchun rahmat!`;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramId, text }),
      });
    } catch {
      // customer notifications are best-effort
    }
  }
}
