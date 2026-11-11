import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { qty, time } from '../format.js';
import type { Deps } from '../state.js';
import type { OrderDto } from '../types.js';
import { expired } from './auth.js';
import { handleError, shortName, stale } from './rooms.js';

function kitchenText(orders: OrderDto[]): string {
  if (orders.length === 0) {
    return '👨‍🍳 Oshxona\n\nHozircha faol buyurtma yo‘q. Yangi buyurtma kelganda xabar beriladi.';
  }
  const parts = ['👨‍🍳 Oshxona — faol buyurtmalar\n'];
  for (const order of orders.slice(0, 8)) {
    const where = order.type === 'DELIVERY' ? `🛵 ${order.delivery?.customerName ?? ''}` : `🪑 ${order.roomName ?? 'Zal'}`;
    parts.push(`#${order.orderNumber} · ${where} · ${time(order.createdAt)}`);
    if (order.note) parts.push(`✍️ ${order.note}`);
  }
  if (orders.length > 8) parts.push(`\n… va yana ${orders.length - 8} ta buyurtma`);
  parts.push('\nTugmalar: 🍳 — pishirishni boshlash, ✅ — tayyor');
  return parts.join('\n');
}

export function registerKitchen(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store, refs } = deps;

  async function showKitchen(ctx: Context, edit: boolean) {
    const session = store.get(ctx.chat!.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'CHEF' && session.role !== 'OWNER') {
      await ctx.reply('👨‍🍳 Bu bo‘lim faqat oshpaz va egasi uchun.');
      return;
    }
    try {
      const orders = await api.kitchenOrders(config, store, ctx.chat!.id);
      const kb = new InlineKeyboard();
      for (const order of orders.slice(0, 8)) {
        const active = order.items.filter((i) => i.status === 'PENDING' || i.status === 'PREPARING');
        for (const item of active.slice(0, 6)) {
          if (item.status === 'PENDING') {
            kb.text(
              `🍳 #${order.orderNumber} ${shortName(item.productName)} ×${qty(item.quantity, item.productUnit)}`,
              `k:p:${refs.ref(ctx.chat!.id, order.id)}:${refs.ref(ctx.chat!.id, item.id)}`,
            ).row();
          } else {
            kb.text(
              `✅ #${order.orderNumber} ${shortName(item.productName)} tayyor`,
              `k:r:${refs.ref(ctx.chat!.id, order.id)}:${refs.ref(ctx.chat!.id, item.id)}`,
            ).row();
          }
        }
      }
      kb.text('🔄 Yangilash', 'm:kitchen').row().text('⬅️ Bosh menyu', 'm:home');
      const text = kitchenText(orders);
      if (edit) await ctx.editMessageText(text, { reply_markup: kb });
      else await ctx.reply(text, { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  bot.command('kitchen', async (ctx) => showKitchen(ctx, false));
  bot.callbackQuery('m:kitchen', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showKitchen(ctx, true);
  });

  async function setStatus(ctx: Context, status: 'PREPARING' | 'READY') {
    const session = store.get(ctx.chat!.id);
    if (!session) return expired(deps, ctx);
    const orderId = refs.unref(ctx.chat!.id, ctx.match![1]);
    const itemId = refs.unref(ctx.chat!.id, ctx.match![2]);
    if (!orderId || !itemId) return stale(ctx);
    try {
      await api.setItemStatus(config, store, ctx.chat!.id, orderId, itemId, status);
      await ctx.answerCallbackQuery({
        text: status === 'PREPARING' ? '🍳 Pishirish boshlandi' : '✅ Tayyor deb belgilandi',
      });
      await showKitchen(ctx, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  bot.callbackQuery(/^k:p:([^:]+):(.+)$/, async (ctx) => setStatus(ctx, 'PREPARING'));
  bot.callbackQuery(/^k:r:([^:]+):(.+)$/, async (ctx) => setStatus(ctx, 'READY'));
}

