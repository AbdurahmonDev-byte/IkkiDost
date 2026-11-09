import { ApiError, api, login, logout } from '../api.js';
import type { Context } from 'grammy';
import { customerKeyboard, greeting, homeKeyboard, roleLabel } from '../keyboards.js';
import { flowKey, type Deps } from '../state.js';

export function registerAuth(deps: Deps, bot: import('grammy').Bot) {
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

    // Check for deep-linked room param (e.g. /start room_1 or /start room_2)
    const match = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    let matchedRoom: { id: string; name: string } | undefined;

    if (match) {
      try {
        const rooms = await api.publicRooms(config);
        matchedRoom = rooms.find(
          (r) =>
            r.id.toLowerCase() === match.toLowerCase() ||
            r.name.toLowerCase().replace(/\s+/g, '_') === match.toLowerCase() ||
            r.name.toLowerCase().includes(match.toLowerCase()),
        );
      } catch {
        // best effort
      }
    }

    if (matchedRoom) {
      await ctx.reply(
        `🍵 Ikki Do‘st choyxonasiga xush kelibsiz!\n\n` +
          `Siz 🏠 <b>${matchedRoom.name}</b>dasiz.\n` +
          `O‘zingizga qulay tarzda to‘g‘ridan-to‘g‘ri Mini App orqali taomlarni tanlang va buyurtma bering — buyurtmangiz darhol oshxonaga yetib boradi!`,
        {
          parse_mode: 'HTML',
          reply_markup: customerKeyboard(config.miniAppUrl, matchedRoom.id, matchedRoom.name),
        },
      );
    } else {
      await ctx.reply(
        `🍵 Ikki Do‘st choyxonasi botiga xush kelibsiz!\n\n` +
          `Bu yerda o‘zingizga o‘zingiz xizmat ko‘rsatishingiz mumkin: xonada o‘tirib yoki uydan turib taomlarni tanlab buyurtma bering, kerak bo‘lsa ofitsiantni chaqiring!`,
        { reply_markup: customerKeyboard(config.miniAppUrl) },
      );
    }
  });

  bot.callbackQuery(/^c:call:(.+)$/, async (ctx) => {
    if (!ctx.chat) return;
    const roomId = ctx.match[1];
    try {
      await api.callWaiter(config, roomId);
      await ctx.answerCallbackQuery({
        text: '🔔 Ofitsiantga xabar yuborildi! Tez orada xonangizga keladi.',
        show_alert: true,
      });
    } catch {
      await ctx.answerCallbackQuery({
        text: 'Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
        show_alert: true,
      });
    }
  });

  bot.command('help', async (ctx) => {
    if (!ctx.chat) return;
    return ctx.reply(helpText(store.get(ctx.chat.id)?.role));
  });

  bot.callbackQuery('m:help', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    const session = store.get(ctx.chat.id);
    await ctx.editMessageText(helpText(session?.role), {
      reply_markup: homeKeyboard(session?.role ?? 'WAITER', config.miniAppUrl),
    });
  });

  const promptLogin = async (ctx: Context) => {
    if (!ctx.chat) return;
    if (store.get(ctx.chat.id)) {
      await ctx.reply('Siz allaqachon ulangansiz. Avval /logout qiling.');
      return;
    }
    flows.set(flowKey(ctx.chat.id), { kind: 'login' });
    await ctx.reply(
      '🔐 Hisobni ulash (xodimlar uchun)\n\n' +
        'Login va parolingizni BITTA xabarda, bo‘sh joy bilan yozing:\n' +
        'misol:  ofitsiant password123\n\n' +
        'Xabaringiz tekshirilgach darhol o‘chirib tashlanadi.',
    );
  };

  bot.command('login', promptLogin);
  bot.callbackQuery('m:login', async (ctx) => {
    await ctx.answerCallbackQuery();
    await promptLogin(ctx);
  });

  bot.command('logout', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) {
      await ctx.reply('Siz ulanmagansiz.');
      return;
    }
    await logout(config, session);
    store.remove(ctx.chat.id);
    flows.delete(flowKey(ctx.chat.id));
    await ctx.reply('✅ Hisob uzildi. Qayta ulash uchun /login.');
  });

  bot.command('me', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) {
      await ctx.reply('Siz xodim sifatida ulanmagansiz. /login orqali ulashingiz mumkin.');
      return;
    }
    await ctx.reply(
      `👤 ${session.fullName}\nLogin: ${session.username}\nRol: ${roleLabel[session.role]}\nUlangan: ${new Date(session.linkedAt).toLocaleString('uz-UZ')}`,
      { reply_markup: homeKeyboard(session.role, config.miniAppUrl) },
    );
  });

  bot.command('menu', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) {
      await ctx.reply('🍵 Ikki Do‘st choyxonasi taomlar menyusi:', {
        reply_markup: customerKeyboard(config.miniAppUrl),
      });
      return;
    }
    await ctx.reply(`${greeting()}, ${session.fullName}!`, {
      reply_markup: homeKeyboard(session.role, config.miniAppUrl),
    });
  });

  bot.callbackQuery('m:home', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    const session = store.get(ctx.chat.id);
    if (!session) {
      await ctx.editMessageText('🍵 Ikki Do‘st choyxonasiga xush kelibsiz!', {
        reply_markup: customerKeyboard(config.miniAppUrl),
      });
      return;
    }
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
    await ctx.answerCallbackQuery({ text: 'Sessiya tugagan. /login qiling.', show_alert: true });
  } catch {
    // already answered
  }
  await ctx.reply('⚠️ Sessiya muddati tugagan yoki hisob uzilgan. /login qilib qayta ulaning.');
}

export function helpText(role?: string): string {
  const lines = [
    '🍵 Ikki Do‘st bot — buyruqlar',
    '',
    '/start — boshlash',
    '/login — hisobni ulash',
    '/logout — hisobni uzish',
    '/menu — bosh menyu',
    '/me — profil',
    '/help — yordam',
    '',
  ];
  if (role === 'OWNER' || role === 'WAITER' || role === 'CASHIER') {
    lines.push('🏠 Xonalar — band/bo‘sh xonalar, hisob, taom qo‘shish');
    lines.push('🛵 Yetkazish — faol yetkazish buyurtmalari');
  }
  if (role === 'OWNER' || role === 'CHEF') lines.push('👨‍🍳 Oshxona — tayyorlanayotgan taomlar');
  if (role === 'OWNER' || role === 'WAITER') lines.push('➕ Yangi yetkazish — mijoz va buyurtma kiritish');
  if (role === 'OWNER') lines.push('📊 Hisobot — bugungi ko‘rsatkichlar');
  lines.push('', 'To‘lovlar faqat kassa ilovasida yoki egasi tomonidan qabul qilinadi.');
  return lines.join('\n');
}

export async function handleLoginText(deps: Deps, ctx: Context, text: string): Promise<void> {
  if (!ctx.chat) return;
  const { config, store, flows } = deps;
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 2) {
    await ctx.reply('❌ Format noto‘g‘ri. Misol:  ofitsiant password123');
    return;
  }
  const [username, password] = parts;

  // Delete the message containing the password ASAP (private chats only).
  try {
    await ctx.deleteMessage();
  } catch {
    await ctx.reply('⚠️ Iltimos, parolli xabaringizni o‘zingiz o‘chiring.');
  }

  try {
    const result = await login(config, username, password);
    store.set(ctx.chat.id, {
      userId: result.user.id,
      username: result.user.username,
      fullName: result.user.fullName,
      role: result.user.role,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      lastNotifiedAt: new Date().toISOString(),
      linkedAt: new Date().toISOString(),
    });
    flows.delete(flowKey(ctx.chat.id));
    await ctx.reply(
      `✅ Ulandi! ${result.user.fullName} · ${roleLabel[result.user.role]}`,
      { reply_markup: homeKeyboard(result.user.role, config.miniAppUrl) },
    );
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Serverga ulanib bo‘lmadi';
    await ctx.reply(`❌ Kira olmadim: ${message}\n\nQayta urinib ko‘ring:  login parol`);
  }
}

