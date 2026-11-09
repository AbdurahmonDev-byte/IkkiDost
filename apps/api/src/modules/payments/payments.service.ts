import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PaymentDto, PaymentMethodDto } from '@ikki-dost/shared-types';
import { RtEvent } from '@ikki-dost/shared-types';
import type { CreatePaymentInput, CreatePaymentMethodInput, ReversePaymentInput, UpdatePaymentMethodInput } from '@ikki-dost/validation';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OrdersService } from '../orders/orders.service';
import { recomputeOrderTotals, recomputeSessionTotals } from '../orders/order-totals';
import { mapPayment } from '../../common/mappers';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private rt: RealtimeService,
    private orders: OrdersService,
  ) {}

  async findAll(opts: { from?: string; to?: string }): Promise<PaymentDto[]> {
    const rows = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: opts.from ? new Date(opts.from) : undefined,
          lte: opts.to ? new Date(opts.to) : undefined,
        },
      },
      include: { method: true, receivedBy: true, reversal: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((p) => ({ ...mapPayment(p), reversalReason: p.reversal?.reason ?? null }));
  }

  async methods(): Promise<PaymentMethodDto[]> {
    const rows = await this.prisma.paymentMethod.findMany({ orderBy: { name: 'asc' } });
    return rows.map((m) => ({ id: m.id, name: m.name, kind: m.kind, isActive: m.isActive }));
  }

  async createMethod(input: CreatePaymentMethodInput, actor: { id: string; fullName: string }): Promise<PaymentMethodDto> {
    const m = await this.prisma.paymentMethod.create({ data: { name: input.name, kind: input.kind } });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PAYMENT_METHOD_CREATED', entity: 'PaymentMethod', entityId: m.id, details: { name: m.name, kind: m.kind } });
    return { id: m.id, name: m.name, kind: m.kind, isActive: m.isActive };
  }

  async updateMethod(id: string, input: UpdatePaymentMethodInput, actor: { id: string; fullName: string }): Promise<PaymentMethodDto> {
    const m = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('To‘lov usuli topilmadi');
    const updated = await this.prisma.paymentMethod.update({ where: { id }, data: { name: input.name ?? undefined, kind: input.kind ?? undefined, isActive: input.isActive ?? undefined } });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PAYMENT_METHOD_UPDATED', entity: 'PaymentMethod', entityId: id, details: { changes: input } });
    return { id: updated.id, name: updated.name, kind: updated.kind, isActive: updated.isActive };
  }

  /** Pay against a single order (delivery bills, or per-order dine-in payment). */
  async payOrder(orderId: string, input: CreatePaymentInput, actor: { id: string; fullName: string }): Promise<PaymentDto> {
    return this.recordPayment({ orderId }, input, actor);
  }

  /** Pay against a whole room session (the normal dine-in flow). */
  async paySession(sessionId: string, input: CreatePaymentInput, actor: { id: string; fullName: string }): Promise<PaymentDto> {
    return this.recordPayment({ roomSessionId: sessionId }, input, actor);
  }

  /**
   * Transactional + idempotent payment recording.
   * - Idempotency: a repeated request with the same key returns the original payment.
   * - Overpayment beyond the outstanding balance is rejected.
   */
  private async recordPayment(target: { orderId?: string; roomSessionId?: string }, input: CreatePaymentInput, actor: { id: string; fullName: string }): Promise<PaymentDto> {
    if (input.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { method: true, receivedBy: true, reversal: true } });
      if (existing) return { ...mapPayment(existing), reversalReason: existing.reversal?.reason ?? null };
    }

    const dto = await this.prisma.$transaction(async (tx) => {
      const method = await tx.paymentMethod.findUnique({ where: { id: input.methodId } });
      if (!method || !method.isActive) throw new BadRequestException('To‘lov usuli topilmadi yoki faol emas');

      let sessionId: string | null = target.roomSessionId ?? null;
      let orderIds: string[] = [];

      if (target.orderId) {
        const order = await tx.order.findUnique({ where: { id: target.orderId } });
        if (!order) throw new NotFoundException('Buyurtma topilmadi');
        if (order.status === 'CANCELLED') throw new BadRequestException('Bekor qilingan buyurtmaga to‘lov qilib bo‘lmaydi');
        if (order.status === 'COMPLETED') throw new BadRequestException('Buyurtma allaqachon to‘liq to‘langan');
        const outstanding = order.totalAmount - order.paidAmount;
        if (input.amount > outstanding) {
          throw new BadRequestException(`To‘lov summasi qarzdorlikdan oshmasligi kerak (qoldiq: ${outstanding} so‘m)`);
        }
        sessionId = order.roomSessionId;
        orderIds = [order.id];
      } else if (target.roomSessionId) {
        const session = await tx.roomSession.findUnique({ where: { id: target.roomSessionId } });
        if (!session) throw new NotFoundException('Sessiya topilmadi');
        if (session.status === 'CLOSED') throw new BadRequestException('Yopilgan sessiyaga to‘lov qilib bo‘lmaydi');
        const outstanding = session.totalAmount - session.paidAmount;
        if (input.amount > outstanding) {
          throw new BadRequestException(`To‘lov summasi qarzdorlikdan oshmasligi kerak (qoldiq: ${outstanding} so‘m)`);
        }
        const orders = await tx.order.findMany({ where: { roomSessionId: session.id, status: { not: 'CANCELLED' } }, select: { id: true } });
        orderIds = orders.map((o) => o.id);
      } else {
        throw new BadRequestException('To‘lov nishoni ko‘rsatilmagan');
      }

      const payment = await tx.payment.create({
        data: {
          orderId: target.orderId ?? null,
          roomSessionId: target.roomSessionId ?? null,
          amount: input.amount,
          methodId: input.methodId,
          note: input.note ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          receivedById: actor.id,
        },
        include: { method: true, receivedBy: true, reversal: true },
      });

      // Recompute cached totals from source rows.
      if (target.orderId) {
        await recomputeOrderTotals(tx, target.orderId);
      } else if (sessionId) {
        // Session-level payment: distribute nothing — order.paidAmount stays per-order for
        // per-order payments only; session cache tracks the aggregate.
      }
      if (sessionId) await recomputeSessionTotals(tx, sessionId);

      // Auto-complete eligible orders (fully-paid delivery + delivered, etc.).
      for (const oid of orderIds) {
        await this.orders.markCompletedIfEligible(tx, oid, actor.id);
      }

      await this.audit.log(
        { actorId: actor.id, actorName: actor.fullName, action: 'PAYMENT_RECEIVED', entity: 'Payment', entityId: payment.id, details: { amount: payment.amount, target } },
        tx,
      );
      return { ...mapPayment(payment), reversalReason: null };
    });

    this.rt.emitToRoles(['OWNER', 'CASHIER'], RtEvent.PAYMENT_RECEIVED, dto);
    if (target.roomSessionId) this.rt.emitToRoles(['OWNER', 'CASHIER', 'WAITER'], RtEvent.ROOM_BALANCE_CHANGED, { sessionId: target.roomSessionId });
    return dto;
  }

  /** Reverse (refund) a payment — CASHIER or OWNER, always audited. */
  async reverse(paymentId: string, input: ReversePaymentInput, actor: { id: string; fullName: string }): Promise<PaymentDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { method: true, receivedBy: true, reversal: true } });
      if (!payment) throw new NotFoundException('To‘lov topilmadi');
      if (payment.reversedAt) throw new BadRequestException('Bu to‘lov allaqachon qaytarilgan');

      await tx.paymentReversal.create({
        data: { paymentId, reason: input.reason, reversedById: actor.id, reversedByName: actor.fullName },
      });
      await tx.payment.update({ where: { id: paymentId }, data: { reversedAt: new Date() } });

      if (payment.orderId) await recomputeOrderTotals(tx, payment.orderId);
      if (payment.roomSessionId) await recomputeSessionTotals(tx, payment.roomSessionId);
      // If the order was auto-completed, reopen it.
      if (payment.orderId) {
        const order = await tx.order.findUnique({ where: { id: payment.orderId } });
        if (order?.status === 'COMPLETED' && order.paidAmount < order.totalAmount) {
          await tx.order.update({ where: { id: order.id }, data: { status: 'SERVED' } });
          await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: 'COMPLETED', toStatus: 'SERVED', actorId: actor.id, note: 'To‘lov qaytarildi' } });
        }
      }
      await this.audit.log(
        { actorId: actor.id, actorName: actor.fullName, action: 'PAYMENT_REVERSED', entity: 'Payment', entityId: paymentId, details: { amount: payment.amount, reason: input.reason } },
        tx,
      );
      const updated = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { method: true, receivedBy: true, reversal: true } });
      return { ...mapPayment(updated), reversalReason: updated.reversal?.reason ?? null };
    });
    this.rt.emitToRoles(['OWNER', 'CASHIER'], RtEvent.PAYMENT_REVERSED, dto);
    return dto;
  }
}
