import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmployeeDto } from '@ikki-dost/shared-types';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '@ikki-dost/validation';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

function toDto(u: User): EmployeeDto {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    canCreateDelivery: u.canCreateDelivery,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(): Promise<EmployeeDto[]> {
    const users = await this.prisma.user.findMany({ orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
    return users.map(toDto);
  }

  async create(input: CreateEmployeeInput, actor: { id: string; fullName: string }): Promise<EmployeeDto> {
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictException('Bu login band');
    const passwordHash = await AuthService.hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone ?? null,
        role: input.role,
        canCreateDelivery: input.canCreateDelivery ?? false,
      },
    });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'EMPLOYEE_CREATED', entity: 'User', entityId: user.id, details: { username: user.username, role: user.role } });
    return toDto(user);
  }

  async update(id: string, input: UpdateEmployeeInput, actor: { id: string; fullName: string }): Promise<EmployeeDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Xodim topilmadi');
    if (input.username && input.username !== user.username) {
      const taken = await this.prisma.user.findUnique({ where: { username: input.username } });
      if (taken) throw new ConflictException('Bu login band');
    }
    // Guard against locking out the last active owner.
    if (input.isActive === false && user.role === 'OWNER') {
      const activeOwners = await this.prisma.user.count({ where: { role: 'OWNER', isActive: true } });
      if (activeOwners <= 1) throw new BadRequestException('Oxirgi faol egani o‘chirib bo‘lmaydi');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        username: input.username ?? undefined,
        fullName: input.fullName ?? undefined,
        phone: input.phone === undefined ? undefined : input.phone,
        role: input.role ?? undefined,
        isActive: input.isActive ?? undefined,
        canCreateDelivery: input.canCreateDelivery ?? undefined,
        passwordHash: input.password ? await AuthService.hashPassword(input.password) : undefined,
      },
    });
    // Deactivation or password change must kill existing sessions.
    if (input.isActive === false || input.password) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'EMPLOYEE_UPDATED', entity: 'User', entityId: id, details: { changes: Object.keys(input) } });
    return toDto(updated);
  }
}
