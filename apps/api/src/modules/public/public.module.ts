import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PublicController } from './public.controller';

@Module({
  imports: [OrdersModule, NotificationsModule, RealtimeModule],
  controllers: [PublicController],
})
export class PublicModule {}
