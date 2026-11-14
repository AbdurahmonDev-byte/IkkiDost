import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProductDto } from '@ikki-dost/shared-types';
import { RtEvent } from '@ikki-dost/shared-types';
import type { CreateProductInput, UpdateProductInput } from '@ikki-dost/validation';
import type { Prisma, Product, ProductImage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ImageService } from './image.service';

type ProductWithImage = Product & { image?: ProductImage | null; category?: { name: string } };

export function mapProduct(p: ProductWithImage): ProductDto {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: p.category?.name,
    unit: p.unit,
    price: p.price,
    costPrice: p.costPrice,
    status: p.status,
    imageUrl: p.image ? `/uploads/${p.image.fileName}` : null,
    thumbnailUrl: p.image ? `/uploads/${p.image.thumbnailName ?? p.image.fileName}` : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private rt: RealtimeService,
    private images: ImageService,
  ) {}

  async findAll(opts: { includeArchived?: boolean; categoryId?: string } = {}): Promise<ProductDto[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: opts.includeArchived ? undefined : { not: 'ARCHIVED' },
        categoryId: opts.categoryId ?? undefined,
      },
      include: { image: true, category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(mapProduct);
  }

  /** Active products only — used by order creation. Throws unless ALL ids are valid. */
  async getActiveByIds(ids: string[], tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const rows = await client.product.findMany({ where: { id: { in: ids }, status: 'ACTIVE' } });
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) throw new BadRequestException('Ba’zi mahsulotlar mavjud emas yoki faol emas');
    return rows;
  }

  async create(input: CreateProductInput, actor: { id: string; fullName: string }): Promise<ProductDto> {
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    const p = await this.prisma.product.create({
      data: { name: input.name, categoryId: input.categoryId, unit: input.unit, price: input.price, costPrice: input.costPrice },
      include: { image: true, category: true },
    });
    await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PRODUCT_CREATED', entity: 'Product', entityId: p.id, details: { name: p.name, price: p.price } });
    this.rt.emitToRoles(['OWNER', 'WAITER', 'CASHIER'], RtEvent.PRODUCT_UPDATED, mapProduct(p));
    return mapProduct(p);
  }

  async update(id: string, input: UpdateProductInput, actor: { id: string; fullName: string }): Promise<ProductDto> {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { image: true, category: true } });
    if (!p) throw new NotFoundException('Mahsulot topilmadi');
    if (input.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new NotFoundException('Kategoriya topilmadi');
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        categoryId: input.categoryId ?? undefined,
        unit: input.unit ?? undefined,
        price: input.price ?? undefined,
        costPrice: input.costPrice ?? undefined,
        status: input.status ?? undefined,
      },
      include: { image: true, category: true },
    });
    if (input.price !== undefined && input.price !== p.price) {
      await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PRODUCT_PRICE_CHANGED', entity: 'Product', entityId: id, details: { from: p.price, to: input.price } });
    }
    if (input.costPrice !== undefined && input.costPrice !== p.costPrice) {
      await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PRODUCT_COST_CHANGED', entity: 'Product', entityId: id, details: { from: p.costPrice, to: input.costPrice } });
    }
    if (input.status !== undefined && input.status !== p.status) {
      await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PRODUCT_STATUS_CHANGED', entity: 'Product', entityId: id, details: { from: p.status, to: input.status } });
    }
    this.rt.emitToRoles(['OWNER', 'WAITER', 'CASHIER'], RtEvent.PRODUCT_UPDATED, mapProduct(updated));
    return mapProduct(updated);
  }

  async setImage(id: string, buffer: Buffer, mimeType: string, actor: { id: string; fullName: string }): Promise<ProductDto> {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { image: true, category: true } });
    if (!p) throw new NotFoundException('Mahsulot topilmadi');
    const stored = await this.images.saveImage(buffer, mimeType);
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (p.image) await tx.productImage.delete({ where: { id: p.image.id } });
        await tx.productImage.create({
          data: { productId: id, fileName: stored.fileName, thumbnailName: stored.thumbnailName, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes },
        });
        return tx.product.findUniqueOrThrow({ where: { id }, include: { image: true, category: true } });
      });
      await this.images.removeFiles(p.image?.fileName ?? '', p.image?.thumbnailName ?? null);
      await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PRODUCT_IMAGE_SET', entity: 'Product', entityId: id });
      this.rt.emitToRoles(['OWNER', 'WAITER', 'CASHIER'], RtEvent.PRODUCT_UPDATED, mapProduct(updated));
      return mapProduct(updated);
    } catch (err) {
      await this.images.removeFiles(stored.fileName, stored.thumbnailName);
      throw err;
    }
  }

  async removeImage(id: string, actor: { id: string; fullName: string }): Promise<ProductDto> {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { image: true, category: true } });
    if (!p) throw new NotFoundException('Mahsulot topilmadi');
    if (p.image) {
      await this.prisma.productImage.delete({ where: { id: p.image.id } });
      await this.images.removeFiles(p.image.fileName, p.image.thumbnailName);
      await this.audit.log({ actorId: actor.id, actorName: actor.fullName, action: 'PRODUCT_IMAGE_REMOVED', entity: 'Product', entityId: id });
    }
    const updated = await this.prisma.product.findUniqueOrThrow({ where: { id }, include: { image: true, category: true } });
    return mapProduct(updated);
  }
}
