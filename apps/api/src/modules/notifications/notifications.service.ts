import { Injectable } from '@nestjs/common';
import type { NotificationDto } from '@ikki-dost/shared-types';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PushService } from './push.service';
import { mapNotification } from '../../common/mappers';

interface NotifyInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private rt: RealtimeService,
    private push: PushService,
  ) {}

  async myNotifications(userId: string): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(mapNotification);
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  /** Persist + realtime + push to a single user. */
  async notifyUser(userId: string, input: NotifyInput) {
    const n = await this.prisma.notification.create({
      data: { userId, type: input.type, title: input.title, body: input.body, data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined },
    });
    this.rt.emitToUser(userId, 'notification:new', mapNotification(n));
    return n;
  }

  /** Persist + realtime + web push to every active user of a role. */
  async notifyRole(role: Role, input: NotifyInput) {
    const users = await this.prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
    if (users.length === 0) return;
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
    this.rt.emitToRoles([role], 'notification:new', { type: input.type, title: input.title, body: input.body, data: input.data ?? null });
    await this.push.sendToRole(role, { title: input.title, body: input.body, data: input.data });
  }

  async savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  }

  async deletePushSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
}
