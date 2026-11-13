import {
  ApiError,
  api,
  logout,
  lookupCustomerBot,
  registerCustomerBot,
  telegramBotLogin,
  updateCustomerBot,
  verifyPhoneBot,
} from '../api.js';
import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import {
  customerKeyboard,
  greeting,
  homeKeyboard,
  locationRequestKeyboard,
  registeredCustomerKeyboard,
  roleLabel,
} from '../keyboards.js';
import { flowKey, type Deps } from '../state.js';
import type { AuthUser, CustomerDto } from '../types.js';

function tgUsername(ctx: Context): string | null {
  return ctx.from?.username ? ctx.from.username : null;
}

function startSession(deps: Deps, chatId: number, result: { accessToken: string; refreshToken: string; user: AuthUser }): void {
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

function profileText(c: CustomerDto): string {
  return (
    `👤 ${c.fullName}\n` +
    `📞 ${c.phone}${c.phoneVerified ? ' ✅ tasdiqlangan' : ' ⏳ tasdiqlanmagan'}\n` +
    (c.deliveryAddress ? `📍 ${c.deliveryAddress}\n` : '📍 Manzil kiritilmagan\n') +
    `🆔 Telegram: ${c.telegramId}`
  );
}

/** Map coordinates from a Telegram location into a clickable Google Maps link. */
export function locationToAddress(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** Asks the customer for a delivery location (with a manual-text fallback). */
export async function askCustomerLocation(deps: Deps, ctx: Context, existing?: string | null): Promise<void> {
  if (!ctx.chat) return;
  deps.flows.set(flowKey(ctx.chat.id), { kind: 'customer-location' });
  const current = existing ? `\n\nSaqlangan manzil: 📍 ${existing}` : '';
  await ctx.reply(
    '📍 Yetkazib berish manzilini yuboring.' + current + '\n\n' +
      'Telegram lokatsiyasini yuborishingiz yoki manzilni qo‘lda yozishingiz mumkin. ' +
      'Manzil saqlanadi va keyingi buyurtmada Mini App avtomatik to‘ldiradi.',
    { reply_markup: locationRequestKeyboard() },
  );
}

/** Saves the customer's address and returns them to the Mini App keyboard. */
async function saveCustomerAddress(deps: Deps, ctx: Context, address: string): Promise<void> {
  if (!ctx.chat || !ctx.from) return;
  const value = address.trim();
  if (value.length < 3 || value.length > 500) {
    await ctx.reply('❌ Manzilni to‘g‘ri kiriting (3–500 belgi):');
    return;
  }
  const { customer } = await updateCustomerBot(deps.config, {
    telegramId: String(ctx.from.id),
    deliveryAddress: value,
  });
  deps.store.patchCustomer(ctx.chat.id, {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    phoneVerified: customer.phoneVerified,
  });
  deps.flows.delete(flowKey(ctx.chat.id));
  await ctx.reply(`✅ Manzil saqlandi:\n📍 ${customer.deliveryAddress ?? value}`, {
    reply_markup: { remove_keyboard: true },
  });
  await ctx.reply('👇 Buyurtma berish uchun:', {
    reply_markup: registeredCustomerKeyboard(deps.config.miniAppUrl),
  });
}

/** Logs staff in when the Telegram ID is assigned to an employee account. */
async function tryAutoLogin(deps: Deps, ctx: Context): Promise<boolean> {
  const { config, store, flows } = deps;
  if (!ctx.chat || !ctx.from) return false;
  try {
    const result = await telegramBotLogin(config, String(ctx.from.id));
    startSession(deps, ctx.chat.id, result);
    await ctx.reply(
      `${greeting()}, ${result.user.fullName}! 👋\nTelegram hisobingiz orqali kirdingiz.`,
      { reply_markup: homeKeyboard(result.user.role, config.miniAppUrl) },
    );
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'OWNER_PASSWORD_REQUIRED') {
      flows.set(flowKey(ctx.chat.id), { kind: 'owner-password' });
      await ctx.reply(
        '🔐 Egasi hisobi aniqlandi.\n\nQo‘shimcha parolni yuboring (xabar yuborilgach o‘chiriladi):',
      );
      return true;
    }
    // Not linked yet — fall through to guest handling.
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

    const match = typeof ctx.match === 'string' ? ctx.match.trim() : '';

    // Deep-linked room (e.g. /start room_1) → call the waiter only.
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

    const customer = await lookupCustomerBot(config, String(ctx.from?.id ?? '')).catch(() => null);
    if (customer) {
      store.patchCustomer(ctx.chat.id, {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        phoneVerified: customer.phoneVerified,
      });
    }

    if (matchedRoom) {
      await ctx.reply(
        `🍵 Ikki Do‘st choyxonasiga xush kelibsiz!\n\n` +
          `Siz 🏠 <b>${matchedRoom.name}</b>dasiz.\n` +
          `Taomlar menyusi va yetkazib berish buyurtmasi uchun Mini App’ni oching. ` +
          `Zaldagi xizmat uchun quyidagi «Ofitsiant chaqirish» tugmasidan foydalaning.`,
        {
          parse_mode: 'HTML',
          reply_markup: customerKeyboard(config.miniAppUrl, matchedRoom.id),
        },
      );
      return;
    }

    if (customer) {
      await ctx.reply(
        `🍵 Xush kelibsiz, ${customer.fullName}!\n\n` +
          `Buyurtma berish uchun Mini App’ni oching yoki profilingizni ko‘ring.`,
        { reply_markup: registeredCustomerKeyboard(config.miniAppUrl) },
      );
      // /start itself asks where the order should be delivered.
      await askCustomerLocation(deps, ctx, customer.deliveryAddress);
      return;
    }

    await ctx.reply(
      `Telegram ID: ${ctx.from?.id ?? 'aniqlanmadi'}\n` +
        'Xodim bo‘lsangiz, shu ID ni egasiga yuboring. ID rolingizga biriktirilgach /start bosing.',
    );
    return startRegistration(ctx, {
      firstName: ctx.from?.first_name ?? '',
      lastName: ctx.from?.last_name ?? '',
    });
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
      reply_markup: session
        ? homeKeyboard(session.role, config.miniAppUrl)
        : customerKeyboard(config.miniAppUrl),
    });
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
    await ctx.reply('✅ Hisob uzildi. Telegram ID qayta tekshirilishi uchun /start bosing.');
  });

  bot.command('me', async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) {
      await ctx.reply(
        `Xodim bo‘lsangiz, egasiga Telegram ID’ingizni yuboring: ${ctx.from?.id ?? 'aniqlanmadi'}\n` +
          'Egasi ID ni Xodimlar bo‘limida rolingizga biriktirgach /start bosing.',
      );
      return;
    }
    await ctx.reply(
      `👤 ${session.fullName}\nLogin: ${session.username}\nRol: ${roleLabel[session.role]}\nUlangan: ${new Date(session.linkedAt).toLocaleString('uz-UZ')}`,
      { reply_markup: homeKeyboard(session.role, config.miniAppUrl) },
    );
  });

  // ===== Customer registration =====

  const startRegistration = async (
    ctx: Context,
    telegramName?: { firstName: string; lastName: string },
  ) => {
    if (!ctx.chat) return;
    if (store.get(ctx.chat.id)) {
      return ctx.reply('Siz xodim sifatida ulangansiz. Mijoz ro‘yxati uchun /logout qiling.');
    }
    const firstName = telegramName?.firstName.trim() ?? '';
    const lastName = telegramName?.lastName.trim() ?? '';
    if (firstName && lastName) {
      flows.set(flowKey(ctx.chat.id), { kind: 'register-confirm-name', firstName, lastName });
      await ctx.reply(
        `📝 Ro‘yxatdan o‘tish\n\nTelegram profilingizdagi ism-familiyadan foydalanamizmi?\n👤 ${firstName} ${lastName}`,
        {
          reply_markup: new InlineKeyboard()
            .text('✅ Shu ism-familiyadan foydalanish', 'c:register-name:use')
            .row()
            .text('✏️ Boshqa ism-familiya kiritish', 'c:register-name:edit'),
        },
      );
      return;
    }
    if (firstName) {
      flows.set(flowKey(ctx.chat.id), { kind: 'register-last-name', firstName });
      await ctx.reply(`Telegram ismingiz: ${firstName}\nFamiliyangizni yozing:`);
      return;
    }
    flows.set(flowKey(ctx.chat.id), { kind: 'register-first-name' });
    await ctx.reply(
      '📝 Ro‘yxatdan o‘tish (1/3)\n\nIsmingizni yozing:',
      { reply_markup: { remove_keyboard: true } },
    );
  };

  bot.command('register', async (ctx) =>
    startRegistration(ctx, {
      firstName: ctx.from?.first_name ?? '',
      lastName: ctx.from?.last_name ?? '',
    }),
  );
  bot.callbackQuery('c:register', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startRegistration(ctx, {
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name ?? '',
    });
  });

  bot.callbackQuery('c:location', async (ctx) => {
    await ctx.answerCallbackQuery();
    const customer = await lookupCustomerBot(config, String(ctx.from?.id ?? '')).catch(() => null);
    if (!customer) {
      return ctx.reply('Avval /register orqali ro‘yxatdan o‘ting.');
    }
    await askCustomerLocation(deps, ctx, customer.deliveryAddress);
  });

  bot.callbackQuery('c:register-name:use', async (ctx) => {
    if (!ctx.chat) return;
    const flow = flows.get(flowKey(ctx.chat.id));
    if (flow?.kind !== 'register-confirm-name') {
      return ctx.answerCallbackQuery({ text: 'Qayta /start bosing' });
    }
    flows.set(flowKey(ctx.chat.id), {
      kind: 'register-phone',
      firstName: flow.firstName,
      lastName: flow.lastName,
    });
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📞 ${flow.firstName} ${flow.lastName}, telefon raqamingizni tasdiqlang.`,
      {
        reply_markup: {
          keyboard: [[{ text: '📞 Telefon raqamni yuborish', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
  });

  bot.callbackQuery('c:register-name:edit', async (ctx) => {
    if (!ctx.chat) return;
    flows.set(flowKey(ctx.chat.id), { kind: 'register-first-name' });
    await ctx.answerCallbackQuery();
    await ctx.reply('Ismingizni kiriting:');
  });

  bot.command('profile', async (ctx) => {
    if (!ctx.chat) return;
    const customer = await lookupCustomerBot(config, String(ctx.from?.id ?? '')).catch(() => null);
    if (!customer) {
      return ctx.reply('Siz hali ro‘yxatdan o‘tmaganmisiz. /register orqali boshlang.');
    }
    store.patchCustomer(ctx.chat.id, {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      phoneVerified: customer.phoneVerified,
    });
    await ctx.reply(profileText(customer), {
      reply_markup: registeredCustomerKeyboard(config.miniAppUrl),
    });
  });

  bot.callbackQuery('c:profile', async (ctx) => {
    await ctx.answerCallbackQuery();
    const customer = await lookupCustomerBot(config, String(ctx.from?.id ?? '')).catch(() => null);
    if (!customer) {
      return ctx.editMessageText('Siz hali ro‘yxatdan o‘tmaganmisiz.', {
        reply_markup: customerKeyboard(config.miniAppUrl),
      });
    }
    await ctx.editMessageText(profileText(customer), {
      reply_markup: registeredCustomerKeyboard(config.miniAppUrl),
    });
  });

  /** Telegram contact sharing — used for registration and phone verification. */
  bot.on('message:contact', async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply('❌ Iltimos, faqat o‘zingizning telefon raqamingizni yuboring.');
      return;
    }
    const phone = contact.phone_number.startsWith('+') ? contact.phone_number : `+${contact.phone_number}`;
    const flow = flows.get(flowKey(ctx.chat.id));

    try {
      if (flow?.kind === 'register-phone') {
        const { customer } = await registerCustomerBot(config, {
          telegramId: String(ctx.from.id),
          telegramUsername: tgUsername(ctx),
          firstName: flow.firstName,
          lastName: flow.lastName,
          phone,
        });
        store.patchCustomer(ctx.chat.id, {
          id: customer.id,
          fullName: customer.fullName,
          phone: customer.phone,
          phoneVerified: customer.phoneVerified,
        });
        flows.delete(flowKey(ctx.chat.id));
        await ctx.reply(
          `✅ Ro‘yxatdan o‘tdingiz!\n\n👤 ${customer.fullName}\n📞 ${customer.phone} — tasdiqlangan\n\n` +
            `Endi uydan buyurtma berishingiz mumkin.`,
          { reply_markup: { remove_keyboard: true } },
        );
        await askCustomerLocation(deps, ctx, customer.deliveryAddress);
        return;
      }

      // API-triggered phone confirmation.
      const { customer } = await verifyPhoneBot(config, {
        telegramId: String(ctx.from.id),
        phone,
        contactUserId: String(ctx.from.id),
      });
      store.patchCustomer(ctx.chat.id, {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        phoneVerified: customer.phoneVerified,
      });
      await ctx.reply(
        `✅ Telefon raqamingiz tasdiqlandi: ${customer.phone}\n\nEndi Mini App orqali buyurtma berishingiz mumkin.`,
        { reply_markup: { remove_keyboard: true } },
      );
      await ctx.reply('👇 Buyurtma berish uchun:', {
        reply_markup: registeredCustomerKeyboard(config.miniAppUrl),
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Serverga ulanib bo‘lmadi';
      await ctx.reply(`❌ Telefonni tasdiqlab bo‘lmadi: ${message}\n\n/register orqali qayta urinib ko‘ring.`);
    }
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
    await ctx.answerCallbackQuery({ text: 'Sessiya tugagan. /start bosing.', show_alert: true });
  } catch {
    // already answered
  }
  await ctx.reply('⚠️ Sessiya muddati tugagan yoki hisob uzilgan. Telegram ID qayta tekshirilishi uchun /start bosing.');
}

export function helpText(role?: string): string {
  const lines = [
    '🍵 Ikki Do‘st bot — buyruqlar',
    '',
    '/start — boshlash',
    '/menu — bosh menyu',
    '/register — mijoz sifatida ro‘yxatdan o‘tish',
    '/profile — mijoz profili',
    '/logout — hisobni uzish',
    '/me — profil',
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
  lines.push('', 'To‘lovlar faqat kassa ilovasida yoki egasi tomonidan qabul qilinadi.');
  return lines.join('\n');
}

/** OWNER extra password after Telegram auto-login. */
export async function handleOwnerPassword(deps: Deps, ctx: Context, password: string): Promise<void> {
  if (!ctx.chat || !ctx.from) return;
  const { config, store, flows } = deps;
  try {
    await ctx.deleteMessage();
  } catch {
    await ctx.reply('⚠️ Iltimos, parolli xabaringizni o‘zingiz o‘chiring.');
  }
  try {
    const result = await telegramBotLogin(config, String(ctx.from.id), password);
    startSession(deps, ctx.chat.id, result);
    await ctx.reply(`✅ Ulandi! ${result.user.fullName} · ${roleLabel[result.user.role]}`, {
      reply_markup: homeKeyboard(result.user.role, config.miniAppUrl),
    });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Serverga ulanib bo‘lmadi';
    await ctx.reply(`❌ Parol noto‘g‘ri: ${message}\n\nQayta yuboring yoki /start bosing.`);
    if (!store.get(ctx.chat.id)) flows.set(flowKey(ctx.chat.id), { kind: 'owner-password' });
  }
}

/** Text router handler for the customer registration wizard. */
export async function handleRegisterText(
  deps: Deps,
  ctx: Context,
  flow: { kind: 'register-first-name' } | { kind: 'register-last-name'; firstName: string },
  text: string,
): Promise<void> {
  const { flows } = deps;
  if (!ctx.chat) return;
  const value = text.trim().replace(/\s+/g, ' ');

  if (flow.kind === 'register-first-name') {
    if (value.length < 2 || value.length > 64) {
      await ctx.reply('❌ Ismni to‘g‘ri kiriting (2–64 belgi):');
      return;
    }
    flows.set(flowKey(ctx.chat.id), { kind: 'register-last-name', firstName: value });
    await ctx.reply(`📝 Ro‘yxatdan o‘tish (2/3)\n\nFamiliyangizni yozing:`);
    return;
  }

  if (value.length < 2 || value.length > 64) {
    await ctx.reply('❌ Familiyani to‘g‘ri kiriting (2–64 belgi):');
    return;
  }
  flows.set(flowKey(ctx.chat.id), {
    kind: 'register-phone',
    firstName: flow.firstName,
    lastName: value,
  });
  await ctx.reply(
    `📝 Ro‘yxatdan o‘tish (3/3)\n\nTelefon raqamingizni tasdiqlang.\n` +
      `Pastdagi tugmani bosing — raqam Telegram orqali yuboriladi.`,
    {
      reply_markup: {
        keyboard: [[{ text: '📞 Telefon raqamni yuborish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
  );
}

/** Text router for the customer delivery-location prompt. */
export async function handleCustomerLocationText(deps: Deps, ctx: Context, text: string): Promise<void> {
  if (!ctx.chat) return;
  const value = text.trim();

  if (value === '⏭ O‘tkazib yuborish') {
    deps.flows.delete(flowKey(ctx.chat.id));
    await ctx.reply('Yaxshi, manzilni keyinroq kiritishingiz mumkin.', {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.reply('👇 Buyurtma berish uchun:', {
      reply_markup: registeredCustomerKeyboard(deps.config.miniAppUrl),
    });
    return;
  }
  if (value === '✍️ Manzilni qo‘lda yozish') {
    await ctx.reply('Manzilni yozing (masalan: Chilonzor 19-kvartal, 12-uy):');
    return;
  }
  try {
    await saveCustomerAddress(deps, ctx, value);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Manzilni saqlab bo‘lmadi';
    await ctx.reply(`❌ ${message}`);
  }
}

/** Telegram location message while the customer address prompt is active. */
export async function handleCustomerLocationMessage(deps: Deps, ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const location = ctx.message?.location;
  if (!location) return;
  try {
    await saveCustomerAddress(deps, ctx, locationToAddress(location.latitude, location.longitude));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Lokatsiyani saqlab bo‘lmadi';
    await ctx.reply(`❌ ${message}`);
  }
}
