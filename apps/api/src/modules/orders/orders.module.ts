import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RoomsModule } from '../rooms/rooms.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RoomsModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
