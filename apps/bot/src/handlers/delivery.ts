import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { dateTime, deliveryNext, deliveryStatusLabel, isDeliveryActive, money, qty } from '../format.js';
import { flowKey, type Actor, type Deps } from '../state.js';
import { expired } from './auth.js';
import { handleError, stale } from './rooms.js';
import { startDeliveryWizard } from './order.js';

const allowed = (role: string) => role === 'OWNER' || role === 'WAITER' || role === 'CASHIER';

export function registerDelivery(deps: Deps, bot: import('grammy').Bot) {
  const { config, store, refs, flows } = deps;

  async function showList(ctx: Context, edit: boolean) {
    const session = store.get(ctx.chat!.id);
    if (!session) return expired(deps, ctx);
    if (!allowed(session.role)) return ctx.reply('Ruxsat yo‘q.');
    try {
      const deliveries = await api.deliveries(config, store, ctx.chat!.id);
      const active = deliveries.filter((d) => isDeliveryActive(d.status));
      const recent = deliveries.filter((d) => !isDeliveryActive(d.status)).slice(0, 3);
      const kb = new InlineKeyboard();
      const lines = ['🛵 Yetkazib berish\n'];
      if (active.length === 0) lines.push('Faol buyurtma yo‘q.');
      for (const d of active) {
        kb.text(`${deliveryStatusLabel[d.status]} · ${d.customerName}`, `d:open:${refs.ref(ctx.chat!.id, d.id)}`).row();
      }
      for (const d of recent) {
        kb.text(`✔ ${deliveryStatusLabel[d.status]} · ${d.customerName}`, `d:open:${refs.ref(ctx.chat!.id, d.id)}`).row();
      }
      if (session.role === 'OWNER' || session.role === 'WAITER') kb.text('➕ Yangi yetkazish', 'm:newdel').row();
      kb.text('🔄 Yangilash', 'm:delivery').row().text('⬅️ Bosh menyu', 'm:home');
      lines.push(`${active.length} ta faol. Tanlang:`);
      const text = lines.join('\n');
      if (edit) await ctx.editMessageText(text, { reply_markup: kb });
      else await ctx.reply(text, { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  bot.command('delivery', async (ctx) => showList(ctx, false));
  bot.callbackQuery('m:delivery', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showList(ctx, true);
  });

  bot.callbackQuery(/^d:open:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const deliveries = await api.deliveries(config, store, ctx.chat.id);
      const d = deliveries.find((x) => x.id === deliveryId);
      if (!d) return stale(ctx);
      const order = await api.order(config, store, ctx.chat.id, d.orderId);

      const lines = [
        `🛵 Yetkazish #${order.orderNumber}`,
        '',
        `👤 ${d.customerName}`,
        `📞 ${d.customerPhone}`,
        `📍 ${d.address}`,
        `Holat: ${deliveryStatusLabel[d.status]}`,
        `Jami: ${money(order.totalAmount)}`,
        '',
        ...order.items.map((i) => `• ${i.productName} × ${qty(i.quantity, i.productUnit)}`),
      ];
      if (order.note) lines.push('', `✍️ ${order.note}`);
      lines.push('', `Yaratilgan: ${dateTime(d.createdAt)}`);

      const kb = new InlineKeyboard();
      const next = deliveryNext[d.status];
      if (next) kb.text(`▶️ ${deliveryStatusLabel[next]}`, `d:next:${ctx.match[1]}`).row();
      if (isDeliveryActive(d.status)) kb.text('🚫 Bekor qilish', `d:cancel:${ctx.match[1]}`).row();
      kb.text('⬅️ Ro‘yxat', 'm:delivery');
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(lines.join('\n'), { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^d:next:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const deliveries = await api.deliveries(config, store, ctx.chat.id);
      const d = deliveries.find((x) => x.id === deliveryId);
      const next = d ? deliveryNext[d.status] : undefined;
      if (!d || !next) return stale(ctx);
      await api.updateDeliveryStatus(config, store, ctx.chat.id, deliveryId, next);
      await ctx.answerCallbackQuery({ text: `▶️ ${deliveryStatusLabel[next]}` });
      const kb = new InlineKeyboard().text('⬅️ Ro‘yxat', 'm:delivery');
      await ctx.editMessageText(
        `✅ ${d.customerName}: ${deliveryStatusLabel[d.status]} → ${deliveryStatusLabel[next]}`,
        { reply_markup: kb },
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^d:cancel:(.+)$/, async (ctx) => {
    const kb = new InlineKeyboard()
      .text('✅ Ha, bekor qilish', `d:cancely:${ctx.match[1]}`)
      .text('❌ Yo‘q', 'm:delivery');
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Yetkazishni bekor qilmoqchimisiz?', { reply_markup: kb });
  });

  bot.callbackQuery(/^d:cancely:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      await api.updateDeliveryStatus(config, store, ctx.chat.id, deliveryId, 'CANCELLED');
      await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
      await showList(ctx, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // New delivery (staff): prompt chain.
  bot.callbackQuery('m:newdel', async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'OWNER' && session.role !== 'WAITER') {
      return ctx.answerCallbackQuery({ text: 'Ruxsat yo‘q', show_alert: true });
    }
    flows.set(flowKey(ctx.chat.id), { kind: 'delivery-name', actor: 'staff' });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('🛵 Yangi yetkazish\n\n1/3 — Mijoz ismini yozing:');
  });
}

/** Text router handler for the name/phone/address prompt chain. */
export async function handleDeliveryText(
  deps: Deps,
  ctx: Context,
  flow: { kind: string; actor: Actor; name?: string; phone?: string },
  text: string,
): Promise<void> {
  const { flows } = deps;
  const chatId = ctx.chat!.id;
  const value = text.trim();

  if (flow.kind === 'delivery-name') {
    if (value.length < 1) return ctx.reply('❌ Ism kiriting:');
    flows.set(flowKey(chatId), { kind: 'delivery-phone', actor: flow.actor, name: value });
    await ctx.reply(`2/3 — ${value} telefon raqamini yozing (masalan: +998901234567):`);
    return;
  }
  if (flow.kind === 'delivery-phone') {
    if (!/^[+\d][\d\s()-]{3,}$/.test(value)) return ctx.reply('❌ Telefon noto‘g‘ri. Qayta yozing:');
    flows.set(flowKey(chatId), { kind: 'delivery-address', actor: flow.actor, name: flow.name!, phone: value });
    await ctx.reply('3/3 — Yetkazish manzilini yozing:');
    return;
  }
  if (flow.kind === 'delivery-address') {
    if (value.length < 3) return ctx.reply('❌ Manzil juda qisqa. Qayta yozing:');
    if (flow.actor === 'customer') deps.store.patchCustomer(chatId, { name: flow.name, phone: flow.phone, address: value });
    await startDeliveryWizard(deps, ctx, flow.actor, { name: flow.name!, phone: flow.phone!, address: value });
  }
}
