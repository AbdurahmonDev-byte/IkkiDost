import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export interface TelegramUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  languageCode: string | null;
  isPremium: boolean;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Validates Telegram Mini App `initData` using the documented HMAC-SHA256
 * scheme (secret = HMAC_SHA256("WebAppData", bot_token)).
 *
 * @throws UnauthorizedException when the payload is forged or expired.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 86_400),
): TelegramUser {
  if (!botToken) {
    throw new UnauthorizedException({
      message: 'Telegram autentifikatsiyasi sozlanmagan (BOT_TOKEN yo‘q)',
      details: { code: 'TELEGRAM_AUTH_NOT_CONFIGURED' },
    });
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new UnauthorizedException({
      message: 'Telegram ma’lumotlari noto‘g‘ri',
      details: { code: 'TELEGRAM_INVALID' },
    });
  }

  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort();
  const dataCheckString = entries.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!safeEqualHex(computed, hash)) {
    throw new UnauthorizedException({
      message: 'Telegram imzosi tekshiruvdan o‘tmadi',
      details: { code: 'TELEGRAM_INVALID' },
    });
  }

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new UnauthorizedException({
      message: 'Telegram ma’lumotlarida sana yo‘q',
      details: { code: 'TELEGRAM_INVALID' },
    });
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - authDate);
  if (ageSeconds > maxAgeSeconds) {
    throw new UnauthorizedException({
      message: 'Telegram sessiyasi eskirgan. Ilovani qayta oching.',
      details: { code: 'TELEGRAM_EXPIRED' },
    });
  }

  let parsed: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  try {
    parsed = JSON.parse(params.get('user') ?? '{}');
  } catch {
    parsed = {};
  }

  const id = parsed.id !== undefined ? String(parsed.id) : '';
  if (!/^\d{4,20}$/.test(id)) {
    throw new UnauthorizedException({
      message: 'Telegram foydalanuvchisi aniqlanmadi',
      details: { code: 'TELEGRAM_INVALID' },
    });
  }

  return {
    id,
    firstName: (parsed.first_name ?? '').slice(0, 64) || 'Mehmon',
    lastName: (parsed.last_name ?? '').slice(0, 64),
    username: parsed.username ? parsed.username.slice(0, 64) : null,
    languageCode: parsed.language_code ?? null,
    isPremium: Boolean(parsed.is_premium),
  };
}

/** Constant-time check of the shared bot secret used by bot-only endpoints. */
/**
 * Desktop cashier kiosk access. Disabled unless CASHIER_KIOSK=on. When
 * CASHIER_KIOSK_KEY is set, the request must carry it in `x-kiosk-key`
 * (the Windows build embeds it), so random internet callers are refused.
 */
export function kioskAllowed(headers: Record<string, unknown>): boolean {
  if ((process.env.CASHIER_KIOSK ?? '').trim().toLowerCase() !== 'on') return false;
  const expected = process.env.CASHIER_KIOSK_KEY?.trim() ?? '';
  if (!expected) return true;
  const provided = String(headers['x-kiosk-key'] ?? '');
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isBotSecret(headers: Record<string, unknown>): boolean {
  const expected = process.env.BOT_TOKEN?.trim() ?? '';
  if (!expected) return false;
  const provided = String(headers['x-bot-secret'] ?? '');
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}
