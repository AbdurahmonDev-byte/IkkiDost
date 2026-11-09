import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExpenseDto } from '@ikki-dost/shared-types';
import type { CreateExpenseInput } from '@ikki-dost/validation';
import type { Expense, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function toDto(e: Expense & { createdBy: User }): ExpenseDto {
  return {
    id: e.id,
    title: e.title,
    amount: e.amount,
    category: e.category,
    note: e.note,
    spentAt: e.spentAt.toISOString(),
    createdByName: e.createdBy.fullName,
    createdAt: e.createdAt.toISOString(),
  };
}

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(opts: { from?: string; to?: string }): Promise<ExpenseDto[]> {
    const rows = await this.prisma.expense.findMany({
      where: { spentAt: { gte: opts.from ? new Date(opts.from) : undefined, lte: opts.to ? new Date(opts.to) : undefined } },
      include: { createdBy: true },
      orderBy: { spentAt: 'desc' },
      take: 500,
    });
    return rows.map(toDto);
  }

  async create(input: CreateExpenseInput, actor: { id: string; fullName: string }): Promise<ExpenseDto> {
    const e = await this.prisma.expense.create({
      data: {
        title: input.title,
        amount: input.amount,
        category: input.category ?? null,
        note: input.note ?? null,
        spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
        createdById: actor.id,
      },
      include: { createdBy: true },
    });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'EXPENSE_CREATED', entity: 'Expense', entityId: e.id, details: { amount: e.amount, title: e.title } });
    return toDto(e);
  }

  async delete(id: string, actor: { id: string; fullName: string }): Promise<void> {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Xarajat topilmadi');
    await this.prisma.expense.delete({ where: { id } });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'EXPENSE_DELETED', entity: 'Expense', entityId: id, details: { amount: e.amount, title: e.title } });
  }
}
