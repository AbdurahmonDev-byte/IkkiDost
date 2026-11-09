import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  fullName: string;
  role: RequestUser['role'];
  canCreateDelivery: boolean;
  type: 'access';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Avtorizatsiya talab qilinadi');
    const token = header.slice(7);
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, { secret: process.env.JWT_ACCESS_SECRET });
      if (payload.type !== 'access') throw new Error('wrong token type');
      req.user = {
        id: payload.sub,
        username: payload.username,
        fullName: payload.fullName,
        role: payload.role,
        canCreateDelivery: payload.canCreateDelivery,
      } satisfies RequestUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati tugagan');
    }
  }
}
