import { Body, Controller, Get, Post, Req, UnauthorizedException, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  loginSchema,
  refreshSchema,
  telegramAuthSchema,
  telegramBotAuthSchema,
  telegramLinkSchema,
  type LoginInput,
  type RefreshInput,
  type TelegramAuthInput,
  type TelegramBotAuthInput,
  type TelegramLinkInput,
} from '@ikki-dost/validation';
import type { AuthTokens, AuthUser } from '@ikki-dost/shared-types';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';
import { isBotSecret, kioskAllowed, validateTelegramInitData, type TelegramUser } from './telegram';

type ReqMeta = { ip?: string; headers: Record<string, string> };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // brute-force protection
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() input: LoginInput, @Req() req: ReqMeta): Promise<AuthTokens & { user: AuthUser }> {
    return this.auth.login(input.username, input.password, { userAgent: req.headers['user-agent'], ip: req.ip });
  }

  /** Passwordless Telegram Mini App login (all roles, including OWNER). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('telegram')
  @UsePipes(new ZodValidationPipe(telegramAuthSchema))
  async telegram(@Body() input: TelegramAuthInput, @Req() req: ReqMeta): Promise<AuthTokens & { user: AuthUser }> {
    return this.auth.loginWithTelegram(input.initData, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  /** Bot auto-login by Telegram id (bot-secret protected). */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('telegram/bot')
  @UsePipes(new ZodValidationPipe(telegramBotAuthSchema))
  async telegramBot(@Body() input: TelegramBotAuthInput, @Req() req: ReqMeta): Promise<AuthTokens & { user: AuthUser }> {
    if (!isBotSecret(req.headers)) throw new UnauthorizedException('Bot maxfiy kaliti noto‘g‘ri');
    return this.auth.loginWithTelegramId(input.telegramId, {
      userAgent: 'telegram-bot',
      ip: req.ip,
    });
  }

  /** Login-free desktop cashier terminal (see AuthService.loginKiosk). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('kiosk')
  async kiosk(@Req() req: ReqMeta): Promise<AuthTokens & { user: AuthUser }> {
    if (!kioskAllowed(req.headers)) throw new UnauthorizedException('Kassa terminaliga ruxsat berilmagan');
    return this.auth.loginKiosk({ userAgent: 'cashier-kiosk', ip: req.ip });
  }

  /**
   * One-time link of username/password credentials to the Telegram identity.
   * Mini App sends initData; the bot sends telegramId + X-Bot-Secret.
   */
  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('link-telegram')
  @UsePipes(new ZodValidationPipe(telegramLinkSchema))
  async linkTelegram(@Body() input: TelegramLinkInput, @Req() req: ReqMeta): Promise<AuthTokens & { user: AuthUser }> {
    let tg: TelegramUser;
    if (input.initData) {
      tg = validateTelegramInitData(input.initData, process.env.BOT_TOKEN ?? '');
    } else {
      if (!isBotSecret(req.headers)) throw new UnauthorizedException('Bot maxfiy kaliti noto‘g‘ri');
      if (!input.telegramId) throw new UnauthorizedException('telegramId ko‘rsatilmagan');
      tg = {
        id: input.telegramId,
        firstName: '',
        lastName: '',
        username: input.telegramUsername ?? null,
        languageCode: null,
        isPremium: false,
      };
    }
    return this.auth.linkTelegram(input.username, input.password, tg, {
      userAgent: req.headers['user-agent'] ?? 'telegram-link',
      ip: req.ip,
    });
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
