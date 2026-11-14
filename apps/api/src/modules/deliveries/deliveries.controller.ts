import { Body, Controller, Get, Param, Post, Query, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DeliveryDto } from '@ikki-dost/shared-types';
import {
  assignDeliverySchema,
  handoverDeliveryCashSchema,
  updateDeliveryStatusSchema,
  type AssignDeliveryInput,
  type HandoverDeliveryCashInput,
  type UpdateDeliveryStatusInput,
} from '@ikki-dost/validation';
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
  @Roles('OWNER', 'WAITER', 'CASHIER', 'DELIVERY')
  findAll(@Query('status') status: string | undefined, @CurrentUser() actor: RequestUser): Promise<DeliveryDto[]> {
    return this.deliveries.findAll(actor, { status });
  }

  @Get(':id')
  @Roles('OWNER', 'WAITER', 'CASHIER', 'DELIVERY')
  getOne(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<DeliveryDto> {
    return this.deliveries.getOne(id, actor);
  }

  /** A delivery person claims an unassigned delivery. */
  @Post(':id/claim')
  @Roles('OWNER', 'CASHIER', 'DELIVERY')
  claim(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<DeliveryDto> {
    return this.deliveries.claim(id, actor);
  }

  @Post(':id/status')
  @Roles('OWNER', 'WAITER', 'CASHIER', 'DELIVERY')
  @UsePipes(new ZodValidationPipe(updateDeliveryStatusSchema))
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateDeliveryStatusInput,
    @CurrentUser() actor: RequestUser,
  ): Promise<DeliveryDto> {
    return this.deliveries.updateStatus(id, input, actor);
  }

  @Post(':id/assign')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(assignDeliverySchema))
  assign(@Param('id') id: string, @Body() input: AssignDeliveryInput, @CurrentUser() actor: RequestUser): Promise<DeliveryDto> {
    return this.deliveries.assign(id, input, actor);
  }

  /** Cashier/owner confirms the courier handed over the collected cash. */
  @Post(':id/handover')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(handoverDeliveryCashSchema))
  handover(
    @Param('id') id: string,
    @Body() input: HandoverDeliveryCashInput,
    @CurrentUser() actor: RequestUser,
  ): Promise<DeliveryDto> {
    return this.deliveries.handoverCash(id, input, actor);
  }
}
