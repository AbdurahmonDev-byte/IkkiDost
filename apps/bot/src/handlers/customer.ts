import { InlineKeyboard, type Context } from 'grammy';
import { receiptMessage } from '../receipt.js';
import { flowKey, type Deps, type OrderFlow } from '../state.js';
import type { RoomDto } from '../types.js';

export function customerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🍽 Menyu / Buyurtma berish', 'c:order')
    .row()
    .text('🛎 Ofitsiant chaqirish', 'c:call')
    .row()
    .text('🧾 Oxirgi chek', 'c:check')
    .row()
    .text('👨‍💼 Xodim kirishi', 'c:staff');
}

export async function customerHome(ctx: Context): Promise<void> {
  await ctx.reply(
    '🍵 Ikki Do‘st choyxonasiga xush kelibsiz!\n\n' +
      'O‘zingizga xizmat ko‘rsating: menyudan tanlang, buyurtma bering — ' +
      'oshxonaga darhol yetib boradi. Yoki ofitsiantni chaqiring.',
    { reply_markup: customerKeyboard() },
  );
}

export function registerCustomer(deps: Deps, bot: import('grammy').Bot) {
  const { store, flows, waiterCalls } = deps;

  bot.callbackQuery('c:staff', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('👨‍💼 Xodimlar uchun kirish: /login bosing.');
  });

  bot.callbackQuery('c:order', async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('🍽 Xonadaman (zalda)', 'c:mode:dine')
      .row()
      .text('🛵 Uyimga (yetkazish)', 'c:mode:del')
      .row()
      .text('⬅️ Orqaga', 'c:home');
    await ctx.editMessageText('Buyurtma turini tanlang:', { reply_markup: kb });
  });

  bot.callbackQuery('c:home', async (ctx) => {
    await ctx.answerCallbackQuery();
    flows.delete(flowKey(ctx.chat.id));
    await ctx.editMessageText('🍵 Ikki Do‘st — bosh menyu', { reply_markup: customerKeyboard() });
  });

  // Dine-in: straight into the menu wizard; the room is picked at the end.
  bot.callbackQuery('c:mode:dine', async (ctx) => {
    const flow: OrderFlow = { mode: 'DINE_IN', actor: 'customer', people: 2, stage: 'menu', lines: {} };
    flows.set(flowKey(ctx.chat.id), { kind: 'order', data: flow });
    await ctx.answerCallbackQuery();
    const { renderStage } = await import('./order.js');
    await renderStage(deps, ctx, flow, true);
  });

  // Delivery: collect name/phone/address, then the menu wizard.
  bot.callbackQuery('c:mode:del', async (ctx) => {
    const profile = store.customer(ctx.chat.id);
    flows.set(flowKey(ctx.chat.id), { kind: 'delivery-name', actor: 'customer' });
    await ctx.answerCallbackQuery();
    const hint = profile.name ? `\n(oldingi: ${profile.name} — o‘sha bo‘lsa shuni yozing)` : '';
    await ctx.editMessageText(`🛵 Yetkazib berish\n\n1/3 — Ismingizni yozing:${hint}`);
  });

  // Waiter call → broadcast to linked staff chats (bot-internal, throttled).
  bot.callbackQuery('c:call', async (ctx) => {
    const chatId = ctx.chat.id;
    const now = Date.now();
    const last = waiterCalls.get(String(chatId)) ?? 0;
    if (now - last < 60_000) {
      await ctx.answerCallbackQuery({ text: 'Ofitsiant allaqachon chaqirilgan. Biroz kuting.', show_alert: true });
      return;
    }
    waiterCalls.set(String(chatId), now);

    let roomText = '';
    const profile = store.customer(chatId);
    if (profile.lastRoomId && deps.system) {
      try {
        const rooms = await deps.system.get<RoomDto[]>('/rooms');
        const room = rooms.find((r) => r.id === profile.lastRoomId);
        if (room) roomText = ` Xona: ${room.name}.`;
      } catch {
        // best effort
      }
    }
    const name = profile.name ?? ctx.from?.first_name ?? 'Mijoz';

    let delivered = 0;
    for (const [staffChatId] of store.all()) {
      try {
        await bot.api.sendMessage(staffChatId, `🔔 Ofitsiant chaqiruvi! ${name} sizni kutmoqda.${roomText}`);
        delivered++;
      } catch {
        // blocked bot, etc.
      }
    }

    await ctx.answerCallbackQuery();
    if (delivered > 0) {
      await ctx.editMessageText('✅ Ofitsiant chaqirildi. Tez orada yoningizda bo‘ladi!');
    } else {
      await ctx.editMessageText('⚠️ Hozircha xodimlar botga ulanmagan. Iltimos, zaldagi xodimga murojaat qiling.');
    }
  });

  // Resend last receipt.
  bot.command('check', async (ctx) => resendReceipt(deps, ctx));
  bot.callbackQuery('c:check', async (ctx) => {
    await ctx.answerCallbackQuery();
    await resendReceipt(deps, ctx);
  });
}

async function resendReceipt(deps: Deps, ctx: Context): Promise<void> {
  const { store } = deps;
  const profile = store.customer(ctx.chat!.id);
  if (!profile.lastReceipt) {
    await ctx.reply('Hali chek yo‘q. Avval buyurtma bering: 🍽 Menyu');
    return;
  }
  await ctx.reply(receiptMessage(profile.lastReceipt), { parse_mode: 'HTML' });
}
