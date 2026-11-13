import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CustomerDto, OrderDto } from '@ikki-dost/shared-types';
import {
  botCustomerLookupSchema,
  botUpdateCustomerSchema,
  createPublicOrderSchema,
  registerCustomerSchema,
  updateCustomerSchema,
  verifyPhoneSchema,
  type BotCustomerLookupInput,
  type BotUpdateCustomerInput,
  type CreatePublicOrderInput,
  type RegisterCustomerInput,
  type UpdateCustomerInput,
  type VerifyPhoneInput,
} from '@ikki-dost/validation';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { isBotSecret } from '../auth/telegram';
import { PublicService } from './public.service';

interface CallWaiterInput {
  roomId: string;
  note?: string;
}

type PublicReq = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
};

function header(req: PublicReq, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private prisma: PrismaService,
    private publicService: PublicService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
  ) {}

  @Get('config')
  config() {
    const username = (process.env.BOT_USERNAME || 'ikkidostbot').replace(/^@/, '');
    return {
      botUsername: username,
      botUrl: `https://t.me/${username}`,
      registrationUrl: this.publicService.botUrl(),
      remoteOrdering: true,
      dineInOrdering: false,
    };
  }

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
      this.prisma.serviceFeeConfig.findUnique({
        where: { id: 'service_fee_config' },
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

  // ===== Customer registration / profile =====

  @Get('me')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async me(@Req() req: PublicReq): Promise<{ customer: CustomerDto | null }> {
    const initData = header(req, 'x-telegram-init-data');
    return { customer: await this.publicService.me(initData) };
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(registerCustomerSchema.omit({ telegramId: true, telegramUsername: true })))
  async register(
    @Body() input: Pick<RegisterCustomerInput, 'firstName' | 'lastName' | 'phone' | 'deliveryAddress'>,
    @Req() req: PublicReq,
  ) {
    const initData = header(req, 'x-telegram-init-data') ?? (input as { initData?: string }).initData;
    const tg = this.publicService.telegram(initData);
    return this.publicService.register(tg, input);
  }

  /** Bot-only registration: phone is verified by Telegram contact sharing. */
  @Post('register/bot')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(registerCustomerSchema))
  async registerBot(@Body() input: RegisterCustomerInput, @Req() req: PublicReq) {
    if (!isBotSecret(req.headers)) throw new BadRequestException('Bot maxfiy kaliti noto‘g‘ri');
    if (!input.telegramId) throw new BadRequestException('telegramId ko‘rsatilmagan');
    const customer = await this.publicService.registerBot(
      {
        id: input.telegramId,
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.telegramUsername ?? null,
        languageCode: null,
        isPremium: false,
      },
      input,
    );
    return { customer };
  }

  @Post('customers/lookup')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(botCustomerLookupSchema))
  async lookupCustomer(@Body() input: BotCustomerLookupInput, @Req() req: PublicReq) {
    if (!isBotSecret(req.headers)) throw new BadRequestException('Bot maxfiy kaliti noto‘g‘ri');
    return { customer: await this.publicService.lookupBot(input.telegramId) };
  }

  @Post('verify-phone')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(verifyPhoneSchema))
  async verifyPhone(@Body() input: VerifyPhoneInput, @Req() req: PublicReq) {
    if (!isBotSecret(req.headers)) throw new BadRequestException('Bot maxfiy kaliti noto‘g‘ri');
    return { customer: await this.publicService.verifyPhone(input.telegramId, input.phone, input.contactUserId) };
  }

  @Patch('me')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(updateCustomerSchema))
  async updateMe(@Body() input: UpdateCustomerInput, @Req() req: PublicReq): Promise<{ customer: CustomerDto }> {
    const initData = header(req, 'x-telegram-init-data');
    return { customer: await this.publicService.updateProfile(initData, input) };
  }

  /** Bot-only profile patch: saves the delivery address/location sent in Telegram. */
  @Patch('customers/bot')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(botUpdateCustomerSchema))
  async updateBotProfile(@Body() input: BotUpdateCustomerInput, @Req() req: PublicReq): Promise<{ customer: CustomerDto }> {
    if (!isBotSecret(req.headers)) throw new BadRequestException('Bot maxfiy kaliti noto‘g‘ri');
    return { customer: await this.publicService.updateBotProfile(input) };
  }

  // ===== Remote (delivery) orders =====

  @Get('orders/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async getOrder(@Param('id') id: string, @Req() req: PublicReq): Promise<OrderDto> {
    return this.publicService.getOrder(header(req, 'x-telegram-init-data'), id);
  }

  @Post('orders')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(createPublicOrderSchema))
  async createOrder(@Body() input: CreatePublicOrderInput, @Req() req: PublicReq): Promise<OrderDto> {
    const initData = header(req, 'x-telegram-init-data') ?? input.initData;
    return this.publicService.createOrder(initData, input);
  }

  @Post('call-waiter')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async callWaiter(@Body() body: CallWaiterInput) {
    if (!body.roomId) {
      throw new BadRequestException('Xona ko‘rsatilmagan');
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
