import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuditLogDto } from '@ikki-dost/shared-types';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
@Roles('OWNER')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  findAll(@Query('limit') limit?: string): Promise<AuditLogDto[]> {
    return this.audit.findAll(limit ? Number(limit) : 100);
  }
}
