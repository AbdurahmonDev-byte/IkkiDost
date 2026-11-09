import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { NotificationDto } from '@ikki-dost/shared-types';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private push: PushService,
  ) {}

  @Get()
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  mine(@CurrentUser() user: RequestUser): Promise<NotificationDto[]> {
    return this.notifications.myNotifications(user.id);
  }

  @Post(':id/read')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  markRead(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  markAllRead(@CurrentUser() user: RequestUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Public()
  @Get('vapid-key')
  vapidKey() {
    return { publicKey: this.push.publicKey };
  }

  @Post('push-subscription')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  async saveSub(@CurrentUser() user: RequestUser, @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) return;
    await this.notifications.savePushSubscription(user.id, body);
  }

  @Delete('push-subscription')
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  async deleteSub(@CurrentUser() user: RequestUser, @Body() body: { endpoint: string }) {
    if (!body?.endpoint) return;
    await this.notifications.deletePushSubscription(user.id, body.endpoint);
  }
}
