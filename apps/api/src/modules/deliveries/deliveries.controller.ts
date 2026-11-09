import { Body, Controller, Get, Param, Post, Query, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DeliveryDto } from '@ikki-dost/shared-types';
import { assignDeliverySchema, updateDeliveryStatusSchema, type AssignDeliveryInput, type UpdateDeliveryStatusInput } from '@ikki-dost/validation';
import { DeliveriesService } from './deliveries.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('deliveries')
@ApiBearerAuth()
@Controller('deliveries')
export class DeliveriesController {
  constructor(private deliveries: DeliveriesService) {}

  @Get()
  @Roles('OWNER', 'WAITER', 'CASHIER')
  findAll(@Query('status') status?: string): Promise<DeliveryDto[]> {
    return this.deliveries.findAll({ status });
  }

  @Post(':id/status')
  @Roles('OWNER', 'WAITER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(updateDeliveryStatusSchema))
  updateStatus(@Param('id') id: string, @Body() input: UpdateDeliveryStatusInput, @CurrentUser() actor: RequestUser): Promise<DeliveryDto> {
    return this.deliveries.updateStatus(id, input, actor);
  }

  @Post(':id/assign')
  @Roles('OWNER')
  @UsePipes(new ZodValidationPipe(assignDeliverySchema))
  assign(@Param('id') id: string, @Body() input: AssignDeliveryInput, @CurrentUser() actor: RequestUser): Promise<DeliveryDto> {
    return this.deliveries.assign(id, input, actor);
  }
}
