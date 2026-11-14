import { Body, Controller, Get, Patch, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ServiceFeeConfigDto } from '@ikki-dost/shared-types';
import { updateServiceFeeConfigSchema, type UpdateServiceFeeConfigInput } from '@ikki-dost/validation';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  /** All roles can read the config (waiters show the fee while creating orders). */
  @Get('service-fee')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  getServiceFee(): Promise<ServiceFeeConfigDto> {
    return this.settings.getServiceFeeConfig();
  }

  @Patch('service-fee')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(updateServiceFeeConfigSchema))
  updateServiceFee(@Body() input: UpdateServiceFeeConfigInput, @CurrentUser() actor: RequestUser): Promise<ServiceFeeConfigDto> {
    return this.settings.updateServiceFeeConfig(input, actor);
  }
}
