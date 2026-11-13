import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import type { AuthTokens, AuthUser } from '@ikki-dost/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import { validateTelegramInitData, type TelegramUser } from './telegram';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseTtl(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 900;
  const n = Number(m[1]);
  const unit = m[2];
  return unit === 's' ? n : unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) return null;
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) return null;
    return this.toAuthUser(user);
  }

  async login(username: string, password: string, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens & { user: AuthUser }> {
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    if (user.role !== 'OWNER' && user.username !== 'bot') {
      throw new UnauthorizedException({
        message: 'Xodimlar faqat admin biriktirgan Telegram ID orqali kiradi',
        details: { code: 'TELEGRAM_LOGIN_REQUIRED' },
      });
    }
    const tokens = await this.issueTokens(user.id, randomUUID(), meta);
    return { ...tokens, user };
  }

  /**
   * Passwordless staff login from the Telegram Mini App. The initData is
   * cryptographically validated, then matched to a staff User by Telegram ID.
   * The owner account is resolved from OWNER_TELEGRAM_IDS.
   */
  async loginWithTelegram(
    initData: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens & { user: AuthUser }> {
    const tg = validateTelegramInitData(initData, process.env.BOT_TOKEN ?? '');
    return this.loginTelegramUser(tg, meta);
  }

  /** Bot-only variant: Telegram identity is already verified by getUpdates. */
  async loginWithTelegramId(
    telegramId: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens & { user: AuthUser }> {
    const tg: TelegramUser = {
      id: telegramId,
      firstName: '',
      lastName: '',
      username: null,
      languageCode: null,
      isPremium: false,
    };
    return this.loginTelegramUser(tg, meta);
  }

  private async loginTelegramUser(
    tg: TelegramUser,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens & { user: AuthUser }> {
    const ownerTelegramIds = new Set(
      (process.env.OWNER_TELEGRAM_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    const user = ownerTelegramIds.has(tg.id)
      ? await this.prisma.user.findFirst({
          where: { role: 'OWNER', isActive: true },
          orderBy: { createdAt: 'asc' },
        })
      : await this.prisma.user.findUnique({ where: { telegramId: tg.id } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        message: 'Telegram ID xodimga biriktirilmagan. Egasi admin panelda ID ni biriktirsin.',
        details: { code: 'TELEGRAM_NOT_LINKED' },
      });
    }

    if (tg.username && tg.username !== user.telegramUsername) {
      await this.prisma.user.update({ where: { id: user.id }, data: { telegramUsername: tg.username } });
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(user.id, randomUUID(), meta);
    return { ...tokens, user: authUser };
  }

  /**
   * One-time account linking: verifies username/password and binds the
   * Telegram identity. After this, Telegram-initData login is passwordless
   * for staff, including the owner (resolved via OWNER_TELEGRAM_IDS).
   */
  async linkTelegram(
    username: string,
    password: string,
    tg: TelegramUser,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens & { user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    if (user.role !== 'OWNER') {
      throw new UnauthorizedException({
        message: 'Xodim Telegram ID sini faqat egasi admin paneldan biriktiradi',
        details: { code: 'TELEGRAM_ID_OWNER_ASSIGNMENT_REQUIRED' },
      });
    }
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw new UnauthorizedException('Login yoki parol noto‘g‘ri');

    const alreadyLinked = await this.prisma.user.findUnique({ where: { telegramId: tg.id } });
    if (alreadyLinked && alreadyLinked.id !== user.id) {
      throw new ConflictException('Bu Telegram hisobi boshqa xodimga ulangan');
    }
    if (user.telegramId && user.telegramId !== tg.id) {
      throw new ConflictException('Bu xodim hisobi boshqa Telegram hisobiga ulangan');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: tg.id,
        telegramUsername: tg.username,
        firstName: user.firstName ?? tg.firstName,
        lastName: user.lastName ?? tg.lastName,
      },
    });

    const authUser = this.toAuthUser(updated);
    const tokens = await this.issueTokens(updated.id, randomUUID(), meta);
    return { ...tokens, user: authUser };
  }

  /** Refresh-token rotation with reuse detection: reusing an old token revokes its whole family. */
  async refresh(refreshToken: string, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored) throw new UnauthorizedException('Token yaroqsiz');

    if (stored.revokedAt) {
      // Reuse of a rotated-out token — possible theft: revoke the entire family.
      await this.prisma.refreshToken.updateMany({ where: { familyId: stored.familyId }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Token qayta ishlatilgan — barcha sessiyalar bekor qilindi');
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Token muddati tugagan');
    }

    const tokens = await this.issueTokens(stored.userId, stored.familyId, meta);
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken) }, data: { revokedAt: new Date() } });
  }

  private async issueTokens(userId: string, familyId: string, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessTtl = process.env.JWT_ACCESS_TTL || '15m';
    const refreshTtl = process.env.JWT_REFRESH_TTL || '30d';

    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      canCreateDelivery: user.canCreateDelivery,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: parseTtl(accessTtl),
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: parseTtl(refreshTtl) },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + parseTtl(refreshTtl) * 1000),
        userAgent: meta?.userAgent?.slice(0, 255),
        ip: meta?.ip,
      },
    });
    return { accessToken, refreshToken };
  }

  toAuthUser(user: { id: string; username: string; fullName: string; role: AuthUser['role']; isActive: boolean }): AuthUser {
    return { id: user.id, username: user.username, fullName: user.fullName, role: user.role, isActive: user.isActive };
  }

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
