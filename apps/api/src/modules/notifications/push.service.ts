import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Web Push (VAPID) delivery for browsers that are closed or in the background.
 * Degrades gracefully to a no-op when VAPID keys are not configured —
 * Socket.IO remains the primary in-app channel.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private logger = new Logger('PushService');
  private webpush: typeof import('web-push') | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      this.logger.warn('VAPID keys not configured — Web Push disabled (socket fallback active)');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const wp = require('web-push') as typeof import('web-push');
      wp.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@ikkidost.uz', pub, priv);
      this.webpush = wp;
    } catch (err) {
      this.logger.warn(`web-push unavailable: ${(err as Error).message}`);
      this.webpush = null;
    }
  }

  get publicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  async sendToRole(role: Role, payload: { title: string; body: string; data?: Record<string, unknown> }) {
    if (!this.webpush) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { user: { role, isActive: true } } });
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await this.webpush!.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired — clean up.
            await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          }
        }
      }),
    );
  }
}
