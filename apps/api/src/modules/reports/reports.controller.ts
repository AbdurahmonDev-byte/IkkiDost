import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DashboardSummaryDto, ReportDto } from '@ikki-dost/shared-types';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@Roles('OWNER', 'CASHIER')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  dashboard(): Promise<DashboardSummaryDto> {
    return this.reports.dashboard();
  }

  @Get('summary')
  summary(@Query('from') from: string, @Query('to') to: string): Promise<ReportDto> {
    return this.reports.summary(from, to);
  }
}
