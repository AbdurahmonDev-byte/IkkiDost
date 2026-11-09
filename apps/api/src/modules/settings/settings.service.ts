import { Injectable } from '@nestjs/common';
import type { ServiceFeeConfigDto } from '@ikki-dost/shared-types';
import type { UpdateServiceFeeConfigInput } from '@ikki-dost/validation';
import type { ServiceFeeConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function toDto(c: ServiceFeeConfig): ServiceFeeConfigDto {
  return {
    enabled: c.enabled,
    amountPerPerson: c.amountPerPerson,
    deliveryFeeAmount: c.deliveryFeeAmount,
    applyToDineIn: c.applyToDineIn,
    applyToDelivery: c.applyToDelivery,
    method: c.method,
    updatedAt: c.updatedAt.toISOString(),
  };
}

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Returns the singleton service-fee configuration, creating defaults if absent. */
  async getServiceFeeConfig(): Promise<ServiceFeeConfigDto> {
    const cfg = await this.prisma.serviceFeeConfig.upsert({
      where: { id: 'service_fee_config' },
      create: { id: 'service_fee_config' },
      update: {},
    });
    return toDto(cfg);
  }

  /**
   * Updates the configuration. Only affects FUTURE orders — every order stores
   * its own fee snapshot, so historical bills are never altered.
   */
  async updateServiceFeeConfig(input: UpdateServiceFeeConfigInput, actor: { id: string; fullName: string }): Promise<ServiceFeeConfigDto> {
    const before = await this.getServiceFeeConfig();
    const cfg = await this.prisma.serviceFeeConfig.upsert({
      where: { id: 'service_fee_config' },
      create: { id: 'service_fee_config', ...input },
      update: {
        enabled: input.enabled ?? undefined,
        amountPerPerson: input.amountPerPerson ?? undefined,
        deliveryFeeAmount: input.deliveryFeeAmount ?? undefined,
        applyToDineIn: input.applyToDineIn ?? undefined,
        applyToDelivery: input.applyToDelivery ?? undefined,
        method: input.method ?? undefined,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorName: actor.fullName,
      action: 'SERVICE_FEE_CONFIG_UPDATED',
      entity: 'ServiceFeeConfig',
      entityId: cfg.id,
      details: { before: before as unknown as Record<string, unknown>, after: toDto(cfg) as unknown as Record<string, unknown> } as never,
    });
    return toDto(cfg);
  }
}
