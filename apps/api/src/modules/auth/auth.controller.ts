import { Body, Controller, Get, Post, Req, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, refreshSchema, type LoginInput, type RefreshInput } from '@ikki-dost/validation';
import type { AuthTokens, AuthUser } from '@ikki-dost/shared-types';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // brute-force protection
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() input: LoginInput, @Req() req: { ip?: string; headers: Record<string, string> }): Promise<AuthTokens & { user: AuthUser }> {
    return this.auth.login(input.username, input.password, { userAgent: req.headers['user-agent'], ip: req.ip });
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async refresh(@Body() input: RefreshInput): Promise<AuthTokens> {
    return this.auth.refresh(input.refreshToken);
  }

  @Public()
  @Post('logout')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async logout(@Body() input: RefreshInput): Promise<void> {
    return this.auth.logout(input.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: RequestUser): AuthUser {
    return { id: user.id, username: user.username, fullName: user.fullName, role: user.role, isActive: true };
  }
}
