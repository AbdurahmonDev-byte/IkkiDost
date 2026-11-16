import { logout, telegramBotLogin } from '../api.js';
import type { Context } from 'grammy';
import { greeting, homeKeyboard, roleLabel } from '../keyboards.js';
import { flowKey, type Deps } from '../state.js';
import type { AuthUser } from '../types.js';

function startSession(
  deps: Deps,
  chatId: number,
  result: { accessToken: string; refreshToken: string; user: AuthUser },
): void {
  deps.store.set(chatId, {
    userId: result.user.id,
    username: result.user.username,
    fullName: result.user.fullName,
    role: result.user.role,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    lastNotifiedAt: new Date().toISOString(),
    linkedAt: new Date().toISOString(),
  });
  deps.flows.delete(flowKey(chatId));
}

/** Map coordinates from a Telegram location into a clickable Google Maps link. */
export function locationToAddress(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function staffOnlyMessage(telegramId: number | string | undefined): string {
  return (
    `Faqat xodimlar uchun. Sizning ID: ${telegramId ?? 'aniqlanmadi'}\n\n` +
    'Ega bilan bog‘lanib, shu ID ni xodim hisobingizga biriktirishni so‘rang. ' +
    'ID biriktirilgach /start bosing.'
  );
}

export async function replyStaffOnly(ctx: Context): Promise<void> {
  await ctx.reply(staffOnlyMessage(ctx.from?.id));
}

/** Logs staff in when the Telegram ID is assigned to an employee account. */
async function tryAutoLogin(deps: Deps, ctx: Context): Promise<boolean> {
  const { config } = deps;
  if (!ctx.chat || !ctx.from) return false;
  try {
    const result = await telegramBotLogin(config, String(ctx.from.id));
    startSession(deps, ctx.chat.id, result);
    await ctx.reply(
      `${greeting()}, ${result.user.fullName}! 👋\nTelegram hisobingiz orqali kirdingiz.`,
      { reply_markup: homeKeyboard(result.user.role, config.miniAppUrl) },
    );
    return true;
  } catch {
    return false;
  }
}

export function registerAuth(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store, flows } = deps;

  bot.command('start', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (session) {
      await ctx.reply(
        `${greeting()}, ${session.fullName}! 👋\nSiz ${roleLabel[session.role]} sifatida ulangansiz.`,
        { reply_markup: homeKeyboard(session.role, config.miniAppUrl) },
      );
      return;
    }

    // Staff role is resolved from the Telegram ID assigned by the owner.
    if (await tryAutoLogin(deps, ctx)) return;
    await replyStaffOnly(ctx);
  });

  bot.command('help', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return replyStaffOnly(ctx);
    return ctx.reply(helpText(session.role));
  });

  bot.callbackQuery('m:help', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    const session = store.get(ctx.chat.id);
    if (!session) return replyStaffOnly(ctx);
    await ctx.editMessageText(helpText(session.role), {
      reply_markup: homeKeyboard(session.role, config.miniAppUrl),
    });
  });

  bot.command('logout', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return replyStaffOnly(ctx);
    await logout(config, session);
    store.remove(ctx.chat.id);
    flows.delete(flowKey(ctx.chat.id));
    await ctx.reply('✅ Hisob uzildi. Telegram ID qayta tekshirilishi uchun /start bosing.');
  });

  bot.command('me', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return replyStaffOnly(ctx);
    await ctx.reply(
      `👤 ${session.fullName}\nLogin: ${session.username}\nRol: ${roleLabel[session.role]}\nUlangan: ${new Date(session.linkedAt).toLocaleString('uz-UZ')}`,
      { reply_markup: homeKeyboard(session.role, config.miniAppUrl) },
    );
  });

  bot.command('menu', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return replyStaffOnly(ctx);
    await ctx.reply(`${greeting()}, ${session.fullName}!`, {
      reply_markup: homeKeyboard(session.role, config.miniAppUrl),
    });
  });

  bot.callbackQuery('m:home', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    const session = store.get(ctx.chat.id);
    if (!session) return replyStaffOnly(ctx);
    flows.delete(flowKey(ctx.chat.id));
    await ctx.editMessageText(`${greeting()}, ${session.fullName}! 👋`, {
      reply_markup: homeKeyboard(session.role, config.miniAppUrl),
    });
  });
}

/** Shared helper for expired/invalid sessions inside callback handlers. */
export async function expired(deps: Deps, ctx: Context): Promise<void> {
  const { store, flows } = deps;
  store.remove(ctx.chat?.id ?? 0);
  flows.delete(flowKey(ctx.chat?.id ?? 0));
  try {
    await ctx.answerCallbackQuery({ text: 'Sessiya tugagan. /start bosing.', show_alert: true });
  } catch {
    // already answered
  }
  await ctx.reply('⚠️ Sessiya muddati tugagan yoki hisob uzilgan. Telegram ID qayta tekshirilishi uchun /start bosing.');
}

export function helpText(role?: string): string {
  const lines = [
    '🍵 Ikki Do‘st — xodimlar buyruqlari',
    '',
    '/start — Telegram ID orqali kirish',
    '/menu — bosh menyu',
    '/logout — hisobni uzish',
    '/me — profil va rol',
    '/help — yordam',
    '',
  ];
  if (role === 'DELIVERY') {
    lines.push('🛵 Mening yetkazishlarim — tayyor buyurtmalarni qabul qilish va yetkazish');
  }
  if (role === 'OWNER' || role === 'WAITER' || role === 'CASHIER') {
    lines.push('🏠 Xonalar — band/bo‘sh xonalar, hisob, taom qo‘shish');
    lines.push('🛵 Yetkazish — faol yetkazish buyurtmalari');
  }
  if (role === 'OWNER' || role === 'CHEF') lines.push('👨‍🍳 Oshxona — tayyorlanayotgan taomlar');
  if (role === 'OWNER' || role === 'WAITER') lines.push('➕ Yangi yetkazish — mijoz va buyurtma kiritish');
  if (role === 'OWNER') lines.push('📊 Hisobot — bugungi ko‘rsatkichlar');
  lines.push('', 'To‘lovlar faqat kassa ilovasida yoki ega tomonidan qabul qilinadi.');
  return lines.join('\n');
}
