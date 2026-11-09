import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import type { AuthTokens, AuthUser } from '@ikki-dost/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';

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
    const tokens = await this.issueTokens(user.id, randomUUID(), meta);
    return { ...tokens, user };
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
