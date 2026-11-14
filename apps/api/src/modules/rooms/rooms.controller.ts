import { Body, Controller, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { OrderDto, PaymentDto, RoomDto, RoomSessionSummaryDto } from '@ikki-dost/shared-types';
import { closeSessionSchema, createRoomSchema, updateRoomSchema, type CloseSessionInput, type CreateRoomInput, type UpdateRoomInput } from '@ikki-dost/validation';
import { RoomsService } from './rooms.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private rooms: RoomsService) {}

  @Get()
  @Roles('OWNER', 'WAITER', 'CASHIER')
  findAll(): Promise<RoomDto[]> {
    return this.rooms.findAll();
  }

  @Post()
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(createRoomSchema))
  create(@Body() input: CreateRoomInput, @CurrentUser() actor: RequestUser): Promise<RoomDto> {
    return this.rooms.create(input, actor);
  }

  @Patch(':id')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(updateRoomSchema))
  update(@Param('id') id: string, @Body() input: UpdateRoomInput, @CurrentUser() actor: RequestUser): Promise<RoomDto> {
    return this.rooms.update(id, input, actor);
  }

  @Get('sessions/:sessionId')
  @Roles('OWNER', 'WAITER', 'CASHIER')
  getSession(@Param('sessionId') sessionId: string): Promise<RoomSessionSummaryDto & { orders: OrderDto[]; payments: PaymentDto[] }> {
    return this.rooms.getSessionDetail(sessionId);
  }

  @Post('sessions/:sessionId/close')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(closeSessionSchema))
  closeSession(@Param('sessionId') sessionId: string, @Body() input: CloseSessionInput, @CurrentUser() actor: RequestUser): Promise<RoomSessionSummaryDto> {
    return this.rooms.closeSession(sessionId, input, actor);
  }
}
