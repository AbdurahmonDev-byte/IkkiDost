import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const user: RequestUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Ruxsat yo‘q');
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Bu amal uchun ruxsatingiz yo‘q');
    }
    return true;
  }
}
