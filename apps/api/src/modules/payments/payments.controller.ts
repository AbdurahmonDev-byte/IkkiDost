import { Body, Controller, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PaymentDto, PaymentMethodDto } from '@ikki-dost/shared-types';
import {
  createPaymentMethodSchema,
  createPaymentSchema,
  reversePaymentSchema,
  updatePaymentMethodSchema,
  type CreatePaymentInput,
  type CreatePaymentMethodInput,
  type ReversePaymentInput,
  type UpdatePaymentMethodInput,
} from '@ikki-dost/validation';
import { PaymentsService } from './payments.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  @Roles('OWNER', 'CASHIER')
  findAll(@Query('from') from?: string, @Query('to') to?: string): Promise<PaymentDto[]> {
    return this.payments.findAll({ from, to });
  }

  @Get('methods')
  @Roles('OWNER', 'CASHIER', 'WAITER')
  methods(): Promise<PaymentMethodDto[]> {
    return this.payments.methods();
  }

  @Post('methods')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(createPaymentMethodSchema))
  createMethod(@Body() input: CreatePaymentMethodInput, @CurrentUser() actor: RequestUser): Promise<PaymentMethodDto> {
    return this.payments.createMethod(input, actor);
  }

  @Patch('methods/:id')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(updatePaymentMethodSchema))
  updateMethod(@Param('id') id: string, @Body() input: UpdatePaymentMethodInput, @CurrentUser() actor: RequestUser): Promise<PaymentMethodDto> {
    return this.payments.updateMethod(id, input, actor);
  }

  @Post('order/:orderId')
  @Roles('CASHIER', 'OWNER')
  @UsePipes(new ZodValidationPipe(createPaymentSchema))
  payOrder(@Param('orderId') orderId: string, @Body() input: CreatePaymentInput, @CurrentUser() actor: RequestUser): Promise<PaymentDto> {
    return this.payments.payOrder(orderId, input, actor);
  }

  @Post('session/:sessionId')
  @Roles('CASHIER', 'OWNER')
  @UsePipes(new ZodValidationPipe(createPaymentSchema))
  paySession(@Param('sessionId') sessionId: string, @Body() input: CreatePaymentInput, @CurrentUser() actor: RequestUser): Promise<PaymentDto> {
    return this.payments.paySession(sessionId, input, actor);
  }

  @Post(':id/reverse')
  @Roles('CASHIER', 'OWNER')
  @UsePipes(new ZodValidationPipe(reversePaymentSchema))
  reverse(@Param('id') id: string, @Body() input: ReversePaymentInput, @CurrentUser() actor: RequestUser): Promise<PaymentDto> {
    return this.payments.reverse(id, input, actor);
  }
}
