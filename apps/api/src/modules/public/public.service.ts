import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CustomerDto, OrderDto } from '@ikki-dost/shared-types';
import type {
  BotUpdateCustomerInput,
  RegisterCustomerInput,
  UpdateCustomerInput,
} from '@ikki-dost/validation';
import type { Customer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { validateTelegramInitData, type TelegramUser } from '../auth/telegram';

function toCustomerDto(c: Customer): CustomerDto {
  return {
    id: c.id,
    telegramId: c.telegramId,
    telegramUsername: c.telegramUsername,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    phone: c.phone,
    phoneVerified: Boolean(c.phoneVerifiedAt),
    deliveryAddress: c.deliveryAddress ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  /** Validates the Mini App initData and returns the Telegram identity. */
  telegram(initData: string | undefined): TelegramUser {
    if (!initData) {
      throw new BadRequestException({
        message: 'Telegram ilovasi ma’lumotlari topilmadi. Ilovani Telegram orqali oching.',
        details: { code: 'TELEGRAM_INITDATA_MISSING' },
      });
    }
    return validateTelegramInitData(initData, process.env.BOT_TOKEN ?? '');
  }

  botUrl(): string {
    const username = (process.env.BOT_USERNAME || 'ikkidostbot').replace(/^@/, '');
    return `https://t.me/${username}?start=register`;
  }

  async me(initData: string | undefined): Promise<CustomerDto | null> {
    const tg = this.telegram(initData);
    const customer = await this.prisma.customer.findUnique({ where: { telegramId: tg.id } });
    return customer ? toCustomerDto(customer) : null;
  }

  async lookupBot(telegramId: string): Promise<CustomerDto | null> {
    const customer = await this.prisma.customer.findUnique({ where: { telegramId } });
    return customer ? toCustomerDto(customer) : null;
  }

  async register(
    tg: TelegramUser,
    input: Pick<RegisterCustomerInput, 'firstName' | 'lastName' | 'phone' | 'deliveryAddress'>,
  ): Promise<{ customer: CustomerDto; verificationSent: boolean; botUrl: string }> {
    const phone = input.phone.trim();
    if (!/^[+\d][\d\s()-]{6,}$/.test(phone)) {
      throw new BadRequestException('Telefon raqami noto‘g‘ri');
    }

    const existing = await this.prisma.customer.findUnique({ where: { telegramId: tg.id } });
    let customer: Customer;
    if (existing) {
      customer = await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          telegramUsername: tg.username ?? existing.telegramUsername,
          // Never silently replace an already verified phone number.
          phone: existing.phoneVerifiedAt ? existing.phone : phone,
          deliveryAddress: input.deliveryAddress?.trim() || existing.deliveryAddress,
        },
      });
    } else {
      customer = await this.prisma.customer.create({
        data: {
          telegramId: tg.id,
          telegramUsername: tg.username,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone,
          deliveryAddress: input.deliveryAddress?.trim() || null,
        },
      });
    }

    const verificationSent = customer.phoneVerifiedAt
      ? false
      : await this.sendPhoneVerification(customer.telegramId);

    return { customer: toCustomerDto(customer), verificationSent, botUrl: this.botUrl() };
  }

  /** Bot-only: the contact was shared inside Telegram, so the phone is verified. */
  async registerBot(
    tg: TelegramUser,
    input: Pick<RegisterCustomerInput, 'firstName' | 'lastName' | 'phone' | 'deliveryAddress'>,
  ): Promise<CustomerDto> {
    const phone = input.phone.trim();
    if (!/^[+\d][\d\s()-]{6,}$/.test(phone)) throw new BadRequestException('Telefon raqami noto‘g‘ri');
    const customer = await this.prisma.customer.upsert({
      where: { telegramId: tg.id },
      create: {
        telegramId: tg.id,
        telegramUsername: tg.username,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone,
        phoneVerifiedAt: new Date(),
        deliveryAddress: input.deliveryAddress?.trim() || null,
      },
      update: {
        telegramUsername: tg.username,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone,
        phoneVerifiedAt: new Date(),
        deliveryAddress: input.deliveryAddress?.trim() || undefined,
      },
    });
    return toCustomerDto(customer);
  }

  /** Bot-only: shared Telegram contact confirmed phone ownership. */
  async verifyPhone(telegramId: string, phone: string, contactUserId: string): Promise<CustomerDto> {
    if (telegramId !== contactUserId) {
      throw new ForbiddenException('Telegram kontakt mos emas');
    }
    const existing = await this.prisma.customer.findUnique({ where: { telegramId } });
    if (!existing) throw new NotFoundException('Mijoz topilmadi — avval ro‘yxatdan o‘ting');
    const customer = await this.prisma.customer.update({
      where: { id: existing.id },
      data: { phone: phone.trim(), phoneVerifiedAt: new Date() },
    });
    return toCustomerDto(customer);
  }

  async updateProfile(initData: string | undefined, input: UpdateCustomerInput): Promise<CustomerDto> {
    const tg = this.telegram(initData);
    const existing = await this.prisma.customer.findUnique({ where: { telegramId: tg.id } });
    if (!existing) throw new NotFoundException('Mijoz topilmadi');
    const customer = await this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        firstName: input.firstName?.trim() ?? undefined,
        lastName: input.lastName?.trim() ?? undefined,
        // Changing the phone requires a fresh Telegram contact confirmation.
        phone: input.phone && !existing.phoneVerifiedAt ? input.phone.trim() : undefined,
        deliveryAddress:
          input.deliveryAddress === undefined
            ? undefined
            : input.deliveryAddress?.trim() || null,
      },
    });
    return toCustomerDto(customer);
  }

  /** Bot-only profile patch (location/address after Telegram registration). */
  async updateBotProfile(input: BotUpdateCustomerInput): Promise<CustomerDto> {
    const existing = await this.prisma.customer.findUnique({ where: { telegramId: input.telegramId } });
    if (!existing) throw new NotFoundException('Mijoz topilmadi — avval ro‘yxatdan o‘ting');
    const customer = await this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        firstName: input.firstName?.trim() ?? undefined,
        lastName: input.lastName?.trim() ?? undefined,
        deliveryAddress:
          input.deliveryAddress === undefined
            ? undefined
            : input.deliveryAddress?.trim() || null,
      },
    });
    return toCustomerDto(customer);
  }

  async getOrder(initData: string | undefined, orderId: string): Promise<OrderDto> {
    const tg = this.telegram(initData);
    const customer = await this.prisma.customer.findUnique({ where: { telegramId: tg.id } });
    if (!customer) throw new ForbiddenException('Buyurtma topilmadi');
    const order = await this.orders.findOne(orderId);
    if (order.customerId !== customer.id) throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
    return order;
  }

  private async sendPhoneVerification(telegramId: string): Promise<boolean> {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) return false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text:
            '📞 Ikki Do‘st: telefon raqamingizni tasdiqlang.\n\n' +
            'Pastdagi «Telefonni tasdiqlash» tugmasini bosing — raqam Telegram orqali tasdiqlanadi.',
          reply_markup: {
            keyboard: [[{ text: '📞 Telefonni tasdiqlash', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
