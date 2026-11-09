import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './modules/prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
