import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface RequestUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  canCreateDelivery: boolean;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
