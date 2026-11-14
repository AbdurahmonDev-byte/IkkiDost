import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderDto, PaymentDto, RoomDto, RoomSessionSummaryDto } from '@ikki-dost/shared-types';
import { RtEvent } from '@ikki-dost/shared-types';
import type { CloseSessionInput, CreateRoomInput, UpdateRoomInput } from '@ikki-dost/validation';
import type { Prisma, Room, RoomSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { mapOrder, mapPayment } from '../../common/mappers';

function sessionSummary(s: RoomSession & { _count?: { orders: number } }, orderCount?: number): RoomSessionSummaryDto {
  return {
    id: s.id,
    status: s.status,
    openedAt: s.openedAt.toISOString(),
    orderCount: orderCount ?? s._count?.orders ?? 0,
    totalAmount: s.totalAmount,
    paidAmount: s.paidAmount,
    outstandingAmount: s.totalAmount - s.paidAmount,
  };
}

async function toRoomDto(prisma: PrismaService, room: Room): Promise<RoomDto> {
  const active = await prisma.roomSession.findFirst({
    where: { roomId: room.id, status: 'OPEN' },
    include: { _count: { select: { orders: true } } },
  });
  return {
    id: room.id,
    name: room.name,
    isActive: room.isActive,
    activeSession: active ? sessionSummary(active) : null,
    createdAt: room.createdAt.toISOString(),
  };
}

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private rt: RealtimeService,
  ) {}

  async findAll(): Promise<RoomDto[]> {
    const rooms = await this.prisma.room.findMany({ orderBy: { name: 'asc' } });
    return Promise.all(rooms.map((r) => toRoomDto(this.prisma, r)));
  }

  async create(input: CreateRoomInput, actor: { id: string; fullName: string }): Promise<RoomDto> {
    const existing = await this.prisma.room.findUnique({ where: { name: input.name } });
    if (existing) throw new ConflictException('Bu nomli xona allaqachon mavjud');
    const room = await this.prisma.room.create({ data: { name: input.name } });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'ROOM_CREATED', entity: 'Room', entityId: room.id, details: { name: room.name } });
    return toRoomDto(this.prisma, room);
  }

  async update(id: string, input: UpdateRoomInput, actor: { id: string; fullName: string }): Promise<RoomDto> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Xona topilmadi');
    if (input.name && input.name !== room.name) {
      const taken = await this.prisma.room.findUnique({ where: { name: input.name } });
      if (taken) throw new ConflictException('Bu nomli xona allaqachon mavjud');
    }
    const updated = await this.prisma.room.update({ where: { id }, data: { name: input.name ?? undefined, isActive: input.isActive ?? undefined } });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'ROOM_UPDATED', entity: 'Room', entityId: id, details: { changes: input } });
    return toRoomDto(this.prisma, updated);
  }

  /**
   * Returns the OPEN session for a room, creating one if none exists.
   * Concurrency: the Room row is locked FOR UPDATE, serializing concurrent
   * callers so at most one OPEN session can ever be created per room.
   */
  async getOrCreateOpenSession(roomId: string, tx?: Prisma.TransactionClient): Promise<RoomSession> {
    const client = tx ?? this.prisma;
    const lockRows = await client.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM "Room" WHERE id = ${roomId} FOR UPDATE
    `;
    if (lockRows.length === 0) throw new NotFoundException('Xona topilmadi');
    if (!lockRows[0].isActive) throw new BadRequestException('Xona faol emas');

    const existing = await client.roomSession.findFirst({ where: { roomId, status: 'OPEN' } });
    if (existing) return existing;
    return client.roomSession.create({ data: { roomId, status: 'OPEN' } });
  }

  async getSessionDetail(sessionId: string): Promise<RoomSessionSummaryDto & { orders: OrderDto[]; payments: PaymentDto[] }> {
    const session = await this.prisma.roomSession.findUnique({
      where: { id: sessionId },
      include: {
        orders: { include: { items: { include: { product: { include: { image: true } } } }, delivery: true, createdBy: true }, orderBy: { createdAt: 'asc' } },
        payments: { include: { method: true, receivedBy: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) throw new NotFoundException('Sessiya topilmadi');
    return {
      ...sessionSummary(session, session.orders.length),
      orders: session.orders.map(mapOrder),
      payments: session.payments.map(mapPayment),
    };
  }

  /**
   * Close a room session. Requires zero outstanding balance unless an OWNER
   * supplies an override reason (audited).
   */
  async closeSession(sessionId: string, input: CloseSessionInput, actor: { id: string; fullName: string; role: string }): Promise<RoomSessionSummaryDto> {
    const closed = await this.prisma.$transaction(async (tx) => {
      const session = await tx.roomSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sessiya topilmadi');
      if (session.status === 'CLOSED') return session;

      const outstanding = session.totalAmount - session.paidAmount;
      const override = outstanding > 0;
      if (override) {
        if (actor.role !== 'OWNER') throw new ForbiddenException('Qarzdorlik mavjud — faqat ega sabab ko‘rsatib yopishi mumkin');
        if (!input.overrideReason || input.overrideReason.trim().length < 3) {
          throw new BadRequestException('Qarzdorlik bilan yopish uchun sabab kiritilishi shart');
        }
      }

      const updated = await tx.roomSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closeOverrideReason: override ? input.overrideReason!.trim() : null,
          closeOverrideById: override ? actor.id : null,
        },
      });

      // Closing the session finalizes every non-cancelled order in it.
      const toComplete = await tx.order.findMany({
        where: { roomSessionId: sessionId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { id: true, status: true },
      });
      for (const o of toComplete) {
        await tx.order.update({ where: { id: o.id }, data: { status: 'COMPLETED' } });
        await tx.orderStatusHistory.create({
          data: { orderId: o.id, fromStatus: o.status, toStatus: 'COMPLETED', actorId: actor.id, note: 'Xona sessiyasi yopildi' },
        });
      }
      if (override) {
        await this.audit.log(
          { actorId: actor.id, actorName: actor.fullName, action: 'SESSION_CLOSE_OVERRIDE', entity: 'RoomSession', entityId: sessionId, details: { outstanding, reason: input.overrideReason!.trim() } },
          tx,
        );
      }
      return updated;
    });
    this.rt.emitToRoles(['OWNER', 'CASHIER', 'WAITER'], RtEvent.ROOM_SESSION_CLOSED, { sessionId });
    return sessionSummary(closed);
  }
}
