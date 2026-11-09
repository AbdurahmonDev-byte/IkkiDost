import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryDto } from '@ikki-dost/shared-types';
import type { CreateCategoryInput, UpdateCategoryInput } from '@ikki-dost/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, productCount: c._count.products }));
  }

  async create(input: CreateCategoryInput): Promise<CategoryDto> {
    const existing = await this.prisma.category.findUnique({ where: { name: input.name } });
    if (existing) throw new ConflictException('Bu kategoriya allaqachon mavjud');
    const c = await this.prisma.category.create({ data: { name: input.name, sortOrder: input.sortOrder ?? 0 } });
    return { id: c.id, name: c.name, sortOrder: c.sortOrder, productCount: 0 };
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kategoriya topilmadi');
    if (input.name && input.name !== c.name) {
      const taken = await this.prisma.category.findUnique({ where: { name: input.name } });
      if (taken) throw new ConflictException('Bu kategoriya allaqachon mavjud');
    }
    const updated = await this.prisma.category.update({ where: { id }, data: { name: input.name ?? undefined, sortOrder: input.sortOrder ?? undefined } });
    return { id: updated.id, name: updated.name, sortOrder: updated.sortOrder };
  }
}
