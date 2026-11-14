import { Body, Controller, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { OrderDto } from '@ikki-dost/shared-types';
import {
  addOrderItemsSchema,
  cancelOrderSchema,
  createOrderSchema,
  itemStatusSchema,
  updateOrderItemSchema,
  type AddOrderItemsInput,
  type CancelOrderInput,
  type CreateOrderInput,
  type ItemStatusInput,
  type UpdateOrderItemInput,
} from '@ikki-dost/validation';
import { OrdersService } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  @Roles('OWNER', 'WAITER', 'CASHIER')
  findAll(@Query('status') status?: string, @Query('type') type?: string, @Query('active') active?: string): Promise<OrderDto[]> {
    return this.orders.findAll({ status, type, active: active === 'true' });
  }

  @Get('kitchen')
  @Roles('CHEF', 'OWNER', 'CASHIER')
  kitchen(): Promise<OrderDto[]> {
    return this.orders.kitchenOrders();
  }

  @Get(':id')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER', 'DELIVERY')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<OrderDto> {
    return this.orders.findOneForActor(id, actor);
  }

  @Get(':id/history')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  history(@Param('id') id: string) {
    return this.orders.history(id);
  }

  @Post()
  @Roles('OWNER', 'WAITER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  create(@Body() input: CreateOrderInput, @CurrentUser() actor: RequestUser): Promise<OrderDto> {
    return this.orders.create(input, actor);
  }

  @Post(':id/items')
  @Roles('OWNER', 'WAITER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(addOrderItemsSchema))
  addItems(@Param('id') id: string, @Body() input: AddOrderItemsInput, @CurrentUser() actor: RequestUser): Promise<OrderDto> {
    return this.orders.addItems(id, input, actor);
  }

  @Patch(':id/items/:itemId')
  @Roles('OWNER', 'WAITER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(updateOrderItemSchema))
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() input: UpdateOrderItemInput, @CurrentUser() actor: RequestUser): Promise<OrderDto> {
    return this.orders.updateItem(id, itemId, input, actor);
  }

  @Post(':id/items/:itemId/status')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  @UsePipes(new ZodValidationPipe(itemStatusSchema))
  setItemStatus(@Param('id') id: string, @Param('itemId') itemId: string, @Body() input: ItemStatusInput, @CurrentUser() actor: RequestUser): Promise<OrderDto> {
    return this.orders.setItemStatus(id, itemId, input, actor);
  }

  @Post(':id/cancel')
  @Roles('OWNER', 'WAITER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(cancelOrderSchema))
  cancel(@Param('id') id: string, @Body() input: CancelOrderInput, @CurrentUser() actor: RequestUser): Promise<OrderDto> {
    return this.orders.cancel(id, input, actor);
  }
}
