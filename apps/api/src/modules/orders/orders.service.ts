import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { computeServiceFee } from '@ikki-dost/utils';
import { RtEvent, type OrderDto } from '@ikki-dost/shared-types';
import type { AddOrderItemsInput, CancelOrderInput, CreateOrderInput, ItemStatusInput, UpdateOrderItemInput } from '@ikki-dost/validation';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { mapOrder } from '../../common/mappers';
import { deriveOrderStatus, recomputeOrderTotals, recomputeSessionTotals } from './order-totals';

const orderInclude = {
  items: { include: { product: { include: { image: true } } }, orderBy: { createdAt: 'asc' as const } },
  delivery: { include: { assignedTo: true } },
  createdBy: true,
  roomSession: { include: { room: true } },
};

type OrderClient = PrismaClient | Prisma.TransactionClient;

async function loadOrder(client: OrderClient, id: string): Promise<OrderDto> {
  const order = await client.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw new NotFoundException('Buyurtma topilmadi');
  return mapOrder(order);
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private rooms: RoomsService,
    private audit: AuditService,
    private rt: RealtimeService,
    private notifications: NotificationsService,
  ) {}

  async findAll(opts: { status?: string; type?: string; active?: boolean }): Promise<OrderDto[]> {
    const activeStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY', 'SERVED'];
    const orders = await this.prisma.order.findMany({
      where: {
        status: opts.active ? { in: activeStatuses as never[] } : (opts.status as never | undefined),
        type: opts.type as never | undefined,
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return orders.map(mapOrder);
  }

  /** Active kitchen view: orders with at least one item not yet served. */
  async kitchenOrders(): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY'] as never[] } },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return orders.map(mapOrder);
  }

  async findOne(id: string): Promise<OrderDto> {
    return loadOrder(this.prisma, id);
  }

  /** Delivery staff may only open unassigned deliveries or their own. */
  async findOneForActor(id: string, actor: { id: string; role: string }): Promise<OrderDto> {
    const order = await this.findOne(id);
    if (actor.role === 'DELIVERY') {
      if (!order.delivery) throw new ForbiddenException('Bu buyurtma yetkazish emas');
      if (order.delivery.assignedToId && order.delivery.assignedToId !== actor.id) {
        throw new ForbiddenException('Bu yetkazish boshqa xodimga biriktirilgan');
      }
    }
    return order;
  }

  async create(input: CreateOrderInput, actor: { id: string; fullName: string; role: string; canCreateDelivery: boolean }, customerId?: string): Promise<OrderDto> {
    if (input.type === 'DELIVERY' && actor.role !== 'OWNER' && actor.role !== 'CASHIER' && !actor.canCreateDelivery) {
      throw new ForbiddenException('Yetkazib berish buyurtmasini yaratish uchun ruxsatingiz yo‘q');
    }

    const dto = await this.prisma.$transaction(async (tx) => {
      // 1. Resolve products (must be ACTIVE) and compute line totals with snapshots.
      const products = await tx.product.findMany({
        where: { id: { in: input.items.map((i) => i.productId) }, status: 'ACTIVE' },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const item of input.items) {
        if (!byId.has(item.productId)) throw new BadRequestException('Ba’zi mahsulotlar mavjud emas yoki faol emas');
      }
      const itemRows = input.items.map((i) => {
        const p = byId.get(i.productId)!;
        const qty = Number(i.quantity);
        return {
          productId: p.id,
          productName: p.name, // snapshot
          productUnit: p.unit, // snapshot
          unitPrice: p.price, // snapshot (integer UZS)
          unitCost: p.costPrice,
          quantity: i.quantity,
          lineTotal: Math.round(p.price * qty),
          costTotal: Math.round(p.costPrice * qty),
          note: i.note ?? null,
        };
      });
      const itemsTotal = itemRows.reduce((s, r) => s + r.lineTotal, 0);

      // 2. Service fee from the CURRENT configuration (snapshot onto the order).
      const feeConfig = await this.getFeeConfig(tx);
      const fee = computeServiceFee(feeConfig, input.type, input.numberOfPeople);

      // 3. Room session for dine-in.
      let roomSessionId: string | null = null;
      let roomId: string | null = null;
      if (input.type === 'DINE_IN') {
        const session = await this.rooms.getOrCreateOpenSession(input.roomId, tx);
        roomSessionId = session.id;
        roomId = input.roomId;
      }

      // 4. Create order with human-friendly sequential number (unique + retry).
      const order = await this.createWithOrderNumber(tx, {
        type: input.type,
        status: 'CONFIRMED',
        roomId,
        roomSession: roomSessionId ? { connect: { id: roomSessionId } } : undefined,
        numberOfPeople: input.numberOfPeople,
        note: input.note ?? null,
        itemsTotal,
        serviceFeeAmount: fee.amount,
        serviceFeePerPerson: fee.perPerson,
        serviceFeeMethod: fee.method,
        totalAmount: itemsTotal + fee.amount,
        paidAmount: 0,
        createdBy: { connect: { id: actor.id } },
        ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
        items: { create: itemRows },
        ...(input.type === 'DELIVERY'
          ? {
              delivery: {
                create: {
                  customerName: input.customerName || 'Saboy',
                  customerPhone: input.customerPhone || '—',
                  address: input.address || '—',
                  status: 'CONFIRMED',
                  assignedToId: input.assignedToId ?? null,
                },
              },
            }
          : {}),
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: null, toStatus: 'CONFIRMED', actorId: actor.id, note: 'Buyurtma yaratildi' },
      });
      if (roomSessionId) await recomputeSessionTotals(tx, roomSessionId);
      return loadOrder(tx, order.id);
    });

    // 5. Realtime + push notifications (outside the transaction).
    this.rt.emitToRoles(['CHEF'], RtEvent.ORDER_CREATED, dto);
    this.rt.emitToRoles(['OWNER', 'CASHIER'], RtEvent.ORDER_CREATED, dto);
    if (dto.type === 'DINE_IN' && dto.roomSessionId) {
      this.rt.emitToRoles(['OWNER', 'CASHIER'], RtEvent.ROOM_SESSION_OPENED, { roomId: dto.roomId, sessionId: dto.roomSessionId });
    }
    await this.notifications.notifyRole('CHEF', {
      type: 'ORDER_CREATED',
      title: `Yangi buyurtma #${dto.orderNumber}`,
      body: dto.type === 'DINE_IN' ? `${dto.roomName ?? 'Xona'} — ${dto.items.length} ta mahsulot` : `Yetkazish: ${dto.delivery?.customerName ?? ''} — ${dto.items.length} ta mahsulot`,
      data: { orderId: dto.id, orderNumber: dto.orderNumber },
    });
    if (dto.type === 'DELIVERY') {
      this.rt.emitToRoles(['DELIVERY'], RtEvent.ORDER_CREATED, dto);
    }
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'ORDER_CREATED', entity: 'Order', entityId: dto.id, details: { type: dto.type, total: dto.totalAmount, people: dto.numberOfPeople } });
    return dto;
  }

  /** Adds items to an existing order. Service fee is NOT recalculated (charged once per order). */
  async addItems(orderId: string, input: AddOrderItemsInput, actor: { id: string; fullName: string }): Promise<OrderDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Buyurtma topilmadi');
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        throw new BadRequestException('Yakunlangan yoki bekor qilingan buyurtmaga mahsulot qo‘shib bo‘lmaydi');
      }
      const products = await tx.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) }, status: 'ACTIVE' } });
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const item of input.items) {
        if (!byId.has(item.productId)) throw new BadRequestException('Ba’zi mahsulotlar mavjud emas yoki faol emas');
      }
      await tx.orderItem.createMany({
        data: input.items.map((i) => {
          const p = byId.get(i.productId)!;
          return {
            orderId,
            productId: p.id,
            productName: p.name,
            productUnit: p.unit,
            unitPrice: p.price,
            unitCost: p.costPrice,
            quantity: i.quantity,
            lineTotal: Math.round(p.price * Number(i.quantity)),
            costTotal: Math.round(p.costPrice * Number(i.quantity)),
            note: i.note ?? null,
          };
        }),
      });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: order.status, actorId: actor.id, note: `${input.items.length} ta mahsulot qo‘shildi` },
      });
      await recomputeOrderTotals(tx, orderId);
      if (order.roomSessionId) await recomputeSessionTotals(tx, order.roomSessionId);
      return loadOrder(tx, orderId);
    });
    this.rt.emitToRoles(['CHEF'], RtEvent.ORDER_UPDATED, dto);
    this.rt.emitToRoles(['OWNER', 'CASHIER'], RtEvent.ORDER_UPDATED, dto);
    this.rt.emitToUser(dto.createdById, RtEvent.ORDER_UPDATED, dto);
    return dto;
  }

  /** Edit item quantity/note. Not allowed once the item is ready/served or the order is finished. */
  async updateItem(orderId: string, itemId: string, input: UpdateOrderItemInput, actor: { id: string; fullName: string; role: string }): Promise<OrderDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Buyurtma topilmadi');
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        throw new BadRequestException('Yakunlangan buyurtmani tahrirlab bo‘lmaydi');
      }
      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw new NotFoundException('Mahsulot topilmadi');
      if (item.status === 'READY' || item.status === 'SERVED') {
        throw new BadRequestException('Tayyor bo‘lgan mahsulotni tahrirlab bo‘lmaydi');
      }
      if (input.quantity) {
        const lineTotal = Math.round(item.unitPrice * Number(input.quantity));
        await tx.orderItem.update({ where: { id: itemId }, data: { quantity: input.quantity, lineTotal, note: input.note === undefined ? undefined : input.note } });
      } else if (input.note !== undefined) {
        await tx.orderItem.update({ where: { id: itemId }, data: { note: input.note } });
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: order.status, actorId: actor.id, note: `«${item.productName}» tahrirlandi` },
      });
      await recomputeOrderTotals(tx, orderId);
      if (order.roomSessionId) await recomputeSessionTotals(tx, order.roomSessionId);
      return loadOrder(tx, orderId);
    });
    this.rt.emitToRoles(['CHEF', 'OWNER', 'CASHIER'], RtEvent.ORDER_UPDATED, dto);
    this.rt.emitToUser(dto.createdById, RtEvent.ORDER_UPDATED, dto);
    return dto;
  }

  /** Chef: mark item PREPARING/READY. Waiter (or owner): mark item SERVED. */
  async setItemStatus(orderId: string, itemId: string, input: ItemStatusInput, actor: { id: string; fullName: string; role: string }): Promise<OrderDto> {
    if (input.status === 'SERVED' && actor.role !== 'WAITER' && actor.role !== 'OWNER' && actor.role !== 'CASHIER') {
      throw new ForbiddenException('Faqat ofitsiant mahsulotni xonaga yetkazilgan deb belgilashi mumkin');
    }
    if ((input.status === 'PREPARING' || input.status === 'READY') && actor.role !== 'CHEF' && actor.role !== 'OWNER' && actor.role !== 'CASHIER') {
      throw new ForbiddenException('Faqat oshpaz tayyorlash holatini o‘zgartirishi mumkin');
    }

    let itemName = '';
    let deliveryChanged = false;
    let deliveryBecameReady = false;
    const dto = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Buyurtma topilmadi');
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        throw new BadRequestException('Buyurtma yakunlangan');
      }
      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw new NotFoundException('Mahsulot topilmadi');
      if (item.status === 'CANCELLED') throw new BadRequestException('Mahsulot bekor qilingan');
      itemName = item.productName;

      await tx.orderItem.update({ where: { id: itemId }, data: { status: input.status } });

      const items = await tx.orderItem.findMany({ where: { orderId } });
      const newStatus = deriveOrderStatus(items.map((i) => i.status), order.status);
      if (newStatus !== order.status) {
        await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
        await tx.orderStatusHistory.create({
          data: { orderId, fromStatus: order.status, toStatus: newStatus, actorId: actor.id, note: `«${itemName}» — ${input.status}` },
        });
      }

      // Keep the delivery workflow in sync with the kitchen: first cooking item
      // moves the delivery to PREPARING, all items ready moves it to READY so
      // the delivery person can claim it.
      if (order.type === 'DELIVERY') {
        const delivery = await tx.delivery.findUnique({ where: { orderId } });
        if (delivery) {
          let next: 'PREPARING' | 'READY' | null = null;
          if ((newStatus === 'PREPARING' || newStatus === 'PARTIALLY_READY') && delivery.status === 'CONFIRMED') {
            next = 'PREPARING';
          } else if (newStatus === 'READY' && (delivery.status === 'CONFIRMED' || delivery.status === 'PREPARING')) {
            next = 'READY';
            deliveryBecameReady = true;
          }
          if (next) {
            await tx.delivery.update({ where: { id: delivery.id }, data: { status: next } });
            await tx.orderStatusHistory.create({
              data: { orderId, fromStatus: delivery.status, toStatus: next, actorId: actor.id, note: 'Oshxona yetkazish holatini yangiladi' },
            });
            deliveryChanged = true;
          }
        }
      }
      return loadOrder(tx, orderId);
    });

    // Notifications: waiter who created the order cares when items become ready.
    if (input.status === 'READY') {
      this.rt.emitToUser(dto.createdById, RtEvent.ITEM_READY, { orderId, itemId, productName: itemName, orderNumber: dto.orderNumber });
      await this.notifications.notifyUser(dto.createdById, {
        type: 'ITEM_READY',
        title: `«${itemName}» tayyor`,
        body: `Buyurtma #${dto.orderNumber}${dto.roomName ? ` — ${dto.roomName}` : ''}`,
        data: { orderId, itemId },
      });
    }
    if (dto.status === 'READY') {
      this.rt.emitToUser(dto.createdById, RtEvent.ORDER_READY, { orderId, orderNumber: dto.orderNumber });
    }
    if (deliveryChanged && dto.delivery) {
      this.rt.emitToRoles(['DELIVERY', 'OWNER', 'CASHIER'], RtEvent.DELIVERY_STATUS_CHANGED, dto.delivery);
      if (deliveryBecameReady) {
        await this.notifications.notifyRole('DELIVERY', {
          type: 'DELIVERY_READY',
          title: `🛵 Buyurtma #${dto.orderNumber} tayyor`,
          body: `${dto.delivery.customerName} · ${dto.delivery.address}`,
          data: { orderId, deliveryId: dto.delivery.id },
        });
      }
    }
    this.rt.emitToRoles(['CHEF', 'OWNER', 'CASHIER'], RtEvent.ORDER_UPDATED, dto);
    return dto;
  }

  async cancel(orderId: string, input: CancelOrderInput, actor: { id: string; fullName: string; role: string }): Promise<OrderDto> {
    const dto = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { delivery: true } });
      if (!order) throw new NotFoundException('Buyurtma topilmadi');
      if (order.status === 'CANCELLED') throw new BadRequestException('Buyurtma allaqachon bekor qilingan');
      if (order.status === 'COMPLETED') throw new BadRequestException('Yakunlangan buyurtmani bekor qilib bo‘lmaydi');
      if (order.paidAmount > 0) {
        throw new BadRequestException('To‘lov qilingan buyurtmani bekor qilish uchun avval to‘lovlar qaytarilishi kerak');
      }
      // Only creator or owner can cancel.
      if (actor.role !== 'OWNER' && actor.role !== 'CASHIER' && order.createdById !== actor.id) {
        throw new ForbiddenException('Faqat buyurtmani yaratgan xodim yoki ega bekor qilishi mumkin');
      }
      await tx.orderItem.updateMany({ where: { orderId, status: { not: 'SERVED' } }, data: { status: 'CANCELLED' } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelReason: input.reason, cancelledAt: new Date(), totalAmount: 0, itemsTotal: 0 } });
      if (order.delivery) {
        await tx.delivery.update({ where: { id: order.delivery.id }, data: { status: 'CANCELLED' } });
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: 'CANCELLED', actorId: actor.id, note: input.reason },
      });
      if (order.roomSessionId) await recomputeSessionTotals(tx, order.roomSessionId);
      await this.audit.log(
        { actorId: actor.id, actorName: actor.fullName, action: 'ORDER_CANCELLED', entity: 'Order', entityId: orderId, details: { reason: input.reason } },
        tx,
      );
      return loadOrder(tx, orderId);
    });
    this.rt.emitToRoles(['CHEF', 'OWNER', 'CASHIER'], RtEvent.ORDER_CANCELLED, dto);
    this.rt.emitToUser(dto.createdById, RtEvent.ORDER_CANCELLED, dto);
    return dto;
  }

  async history(orderId: string) {
    const rows = await this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      include: { actor: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorName: r.actor?.fullName ?? 'Tizim',
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Internal: called by payments/deliveries to finalize delivery orders. */
  async markCompletedIfEligible(tx: Prisma.TransactionClient, orderId: string, actorId: string) {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { delivery: true } });
    if (!order || order.status === 'COMPLETED' || order.status === 'CANCELLED') return;
    const fullyPaid = order.paidAmount >= order.totalAmount;
    if (order.type === 'DELIVERY') {
      // Saboy is take-away: a full payment finishes it, whatever the courier status.
      if (fullyPaid) {
        if (order.delivery && order.delivery.status !== 'DELIVERED' && order.delivery.status !== 'CANCELLED') {
          await tx.delivery.update({ where: { id: order.delivery.id }, data: { status: 'DELIVERED' } });
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
        await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: 'COMPLETED', actorId, note: 'To‘liq to‘landi (saboy)' } });
      }
    } else if (fullyPaid) {
      await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: 'COMPLETED', actorId, note: 'To‘liq to‘landi' } });
    }
  }

  private async getFeeConfig(tx: Prisma.TransactionClient) {
    const cfg = await tx.serviceFeeConfig.findUnique({ where: { id: 'service_fee_config' } });
    return (
      cfg ?? {
        enabled: true,
        amountPerPerson: 4000,
        applyToDineIn: true,
        applyToDelivery: true,
        method: 'PER_PERSON' as const,
      }
    );
  }

  private async createWithOrderNumber(tx: Prisma.TransactionClient, data: Omit<Prisma.OrderCreateInput, 'orderNumber'>) {
    for (let attempt = 0; ; attempt++) {
      const max = await tx.order.aggregate({ _max: { orderNumber: true } });
      const orderNumber = (max._max.orderNumber ?? 0) + 1;
      try {
        return await tx.order.create({ data: { ...data, orderNumber } });
      } catch (err) {
        // Unique constraint race on orderNumber — retry; otherwise rethrow.
        if (attempt < 4 && String((err as Error).message).includes('orderNumber')) continue;
        throw err;
      }
    }
  }
}
