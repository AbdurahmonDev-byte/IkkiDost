import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { OrderDto } from '@ikki-dost/shared-types';
import { createOrderSchema, type CreateOrderInput } from '@ikki-dost/validation';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

interface CallWaiterInput {
  roomId: string;
  note?: string;
}

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
  ) {}

  @Get('menu')
  async getMenu() {
    const [categories, products, feeConfig] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        include: { image: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.serviceFeeConfig.findFirst({
        where: { id: 'singleton' },
      }),
    ]);

    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      unit: p.unit,
      price: p.price,
      status: p.status,
      imageUrl: p.image ? `/uploads/${p.image.fileName}` : null,
      thumbnailUrl: p.image ? `/uploads/${p.image.thumbnailName ?? p.image.fileName}` : null,
    }));

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
      })),
      products: formattedProducts,
      serviceFee: feeConfig
        ? {
            enabled: feeConfig.enabled,
            amountPerPerson: feeConfig.amountPerPerson,
            applyToDineIn: feeConfig.applyToDineIn,
            applyToDelivery: feeConfig.applyToDelivery,
            method: feeConfig.method,
          }
        : null,
    };
  }

  @Get('rooms')
  async getRooms() {
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        sessions: {
          where: { status: 'OPEN' },
          take: 1,
        },
      },
    });

    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      isOccupied: r.sessions.length > 0,
    }));
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string): Promise<OrderDto> {
    return this.orders.findOne(id);
  }

  @Post('orders')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  async createOrder(@Body() input: CreateOrderInput): Promise<OrderDto> {
    // Resolve an actor to attach the created order in the database.
    // Self-service orders use the dedicated `bot` account so audit trails stay
    // honest and are never attributed to a real waiter.
    const actorUser =
      (await this.prisma.user.findFirst({
        where: { username: 'bot', isActive: true },
      })) ||
      (await this.prisma.user.findFirst({
        where: { role: 'WAITER', isActive: true },
      })) ||
      (await this.prisma.user.findFirst({
        where: { role: 'OWNER', isActive: true },
      }));

    if (!actorUser) {
      throw new BadRequestException('Tizimda faol xodim topilmadi');
    }

    const customerName = input.type === 'DELIVERY' ? input.customerName : null;
    const actor = {
      id: actorUser.id,
      fullName: customerName ? `Mijoz (${customerName})` : 'Mijoz (Self-service)',
      role: 'WAITER',
      canCreateDelivery: true,
    };

    return this.orders.create(input, actor);
  }

  @Post('call-waiter')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async callWaiter(@Body() body: CallWaiterInput) {
    if (!body.roomId) {
      throw new BadRequestException('Xona ko‘rsatilmadi');
    }

    const room = await this.prisma.room.findUnique({
      where: { id: body.roomId },
    });

    if (!room) {
      throw new NotFoundException('Xona topilmadi');
    }

    const noteText = body.note ? `\nIzoh: ${body.note}` : '';
    const alertBody = `${room.name} ofitsiantni chaqirmoqda!${noteText}`;

    await Promise.all([
      this.notifications.notifyRole('WAITER', {
        type: 'WAITER_CALLED',
        title: '🔔 Ofitsiant chaqirildi!',
        body: alertBody,
        data: { roomId: room.id, roomName: room.name, note: body.note },
      }),
      this.notifications.notifyRole('OWNER', {
        type: 'WAITER_CALLED',
        title: '🔔 Ofitsiant chaqirildi!',
        body: alertBody,
        data: { roomId: room.id, roomName: room.name, note: body.note },
      }),
    ]);

    this.rt.emitToRoles(['WAITER', 'OWNER'], 'waiter:called' as never, {
      roomId: room.id,
      roomName: room.name,
      note: body.note ?? null,
      calledAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: `${room.name} uchun ofitsiant chaqirildi!`,
    };
  }
}
