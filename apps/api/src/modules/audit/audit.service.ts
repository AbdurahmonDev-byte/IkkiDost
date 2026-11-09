import { Injectable } from '@nestjs/common';
import type { AuditLogDto } from '@ikki-dost/shared-types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface LogInput {
  actorId?: string | null;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Write an audit record. Can be called inside a transaction via the `tx` client. */
  async log(input: LogInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        details: input.details,
      },
    });
  }

  async findAll(limit = 100): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 500) });
    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorName: r.actorName,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: (r.details as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
