import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [OrdersModule, NotificationsModule, RealtimeModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
