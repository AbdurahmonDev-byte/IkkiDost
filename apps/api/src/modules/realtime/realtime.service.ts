import { Injectable, Logger } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Central role-aware event emitter. All domain services publish realtime
 * events through here so targeting rules live in exactly one place.
 */
@Injectable()
export class RealtimeService {
  private logger = new Logger('RealtimeService');

  constructor(private gateway: RealtimeGateway) {}

  emitToRoles(roles: Role[], event: string, payload: unknown) {
    const s = this.gateway.server;
    if (!s) return;
    for (const role of roles) {
      s.to(`role:${role}`).emit(event, payload);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.gateway.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToUsers(userIds: Iterable<string>, event: string, payload: unknown) {
    const s = this.gateway.server;
    if (!s) return;
    for (const id of userIds) s.to(`user:${id}`).emit(event, payload);
  }

  emitToAll(event: string, payload: unknown) {
    this.gateway.server?.emit(event, payload);
  }
}
