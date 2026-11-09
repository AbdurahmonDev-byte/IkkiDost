import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryDto } from '@ikki-dost/shared-types';
import { RtEvent } from '@ikki-dost/shared-types';
import type { AssignDeliveryInput, UpdateDeliveryStatusInput } from '@ikki-dost/validation';
import type { DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OrdersService } from '../orders/orders.service';
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

@Injectable()
export class DeliveriesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private rt: RealtimeService,
    private orders: OrdersService,
  ) {}

  async findAll(opts: { status?: string }): Promise<DeliveryDto[]> {
    const rows = await this.prisma.delivery.findMany({
      where: { status: (opts.status as DeliveryStatus) ?? undefined },
      include: { assignedTo: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(mapDelivery);
  }

  async updateStatus(id: string, input: UpdateDeliveryStatusInput, actor: { id: string; fullName: string; role: string }): Promise<DeliveryDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({ where: { id }, include: { assignedTo: true } });
      if (!delivery) throw new NotFoundException('Yetkazish topilmadi');
      // Staff can only act on deliveries assigned to them (owner can act on all).
      if (actor.role !== 'OWNER' && delivery.assignedToId && delivery.assignedToId !== actor.id) {
        throw new BadRequestException('Bu yetkazish sizga biriktirilmagan');
      }
      const allowed = TRANSITIONS[delivery.status];
      if (!allowed.includes(input.status)) {
        throw new BadRequestException(`${delivery.status} holatdan ${input.status} holatga o‘tib bo‘lmaydi`);
      }
      await tx.delivery.update({ where: { id }, data: { status: input.status } });
      await tx.orderStatusHistory.create({
        data: { orderId: delivery.orderId, fromStatus: delivery.status, toStatus: input.status, actorId: actor.id, note: 'Yetkazish holati' },
      });
      if (input.status === 'DELIVERED') {
        await this.orders.markCompletedIfEligible(tx, delivery.orderId, actor.id);
      }
      return tx.delivery.findUniqueOrThrow({ where: { id }, include: { assignedTo: true } });
    });
    this.rt.emitToRoles(['OWNER', 'WAITER', 'CASHIER'], RtEvent.DELIVERY_STATUS_CHANGED, mapDelivery(dto));
    return mapDelivery(dto);
  }

  async assign(id: string, input: AssignDeliveryInput, actor: { id: string; fullName: string }): Promise<DeliveryDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({ where: { id } });
      if (!delivery) throw new NotFoundException('Yetkazish topilmadi');
      if (input.assignedToId) {
        const user = await tx.user.findUnique({ where: { id: input.assignedToId } });
        if (!user || !user.isActive) throw new NotFoundException('Xodim topilmadi yoki faol emas');
      }
      await tx.delivery.update({ where: { id }, data: { assignedToId: input.assignedToId } });
      await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'DELIVERY_ASSIGNED', entity: 'Delivery', entityId: id, details: { assignedToId: input.assignedToId } }, tx);
      return tx.delivery.findUniqueOrThrow({ where: { id }, include: { assignedTo: true } });
    });
    if (dto.assignedToId) this.rt.emitToUser(dto.assignedToId, RtEvent.DELIVERY_STATUS_CHANGED, mapDelivery(dto));
    this.rt.emitToRoles(['OWNER'], RtEvent.DELIVERY_STATUS_CHANGED, mapDelivery(dto));
    return mapDelivery(dto);
  }
}
