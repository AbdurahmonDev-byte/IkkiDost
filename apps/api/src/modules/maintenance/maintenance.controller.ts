import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(private maintenance: MaintenanceService) {}

  /** Owner-only: wipe test sales data before go-live. */
  @Post('clear-sales-history')
  @Roles('OWNER')
  clearSalesHistory(@CurrentUser() actor: RequestUser) {
    return this.maintenance.clearSalesHistory(actor);
  }
}
