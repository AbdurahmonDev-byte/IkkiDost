import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { money } from '../format.js';
import { backHome } from '../keyboards.js';
import type { Deps } from '../state.js';
import { expired } from './auth.js';
import { handleError } from './rooms.js';

export function registerDashboard(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store } = deps;

  async function showDashboard(ctx: Context, edit: boolean) {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'OWNER') {
      const msg = '❌ Hisobot bo‘limi faqat choyxona egasi (OWNER) uchun ochiq.';
      if (edit) await ctx.editMessageText(msg, { reply_markup: backHome() });
      else await ctx.reply(msg, { reply_markup: backHome() });
      return;
    }

    try {
      const d = await api.dashboard(config, store, ctx.chat.id);
      const kb = new InlineKeyboard()
        .text('🔄 Yangilash', 'm:dash')
        .row()
        .text('⬅️ Bosh menyu', 'm:home');

      let text =
        `📊 Bugungi ko‘rsatkichlar\n\n` +
        `💰 Jami tushum: ${money(d.todayRevenue)}\n` +
        `💵 Kassaga tushgan: ${money(d.paidToday)}\n`;

      if (d.unpaidOutstanding > 0) {
        text += `⚠️ Yopilmagan qarz: ${money(d.unpaidOutstanding)}\n`;
      }
      text +=
        `📉 Xarajatlar: ${money(d.todayExpenses)}\n` +
        `🧾 Xizmat haqi: ${money(d.serviceFeeRevenueToday)}\n\n` +
        `📦 Buyurtmalar soni: ${d.todayOrderCount} ta\n` +
        `🏠 Band xonalar: ${d.activeRooms} ta\n` +
        `🍽 Faol ichki buyurtmalar: ${d.activeDineInOrders} ta\n` +
        `🛵 Faol yetkazishlar: ${d.activeDeliveryOrders} ta\n`;

      if (d.popularProducts && d.popularProducts.length > 0) {
        text += `\n🔥 Bugungi top taomlar:\n`;
        d.popularProducts.slice(0, 5).forEach((p, idx) => {
          text += `${idx + 1}. ${p.productName} — ${p.quantity} ta (${money(p.revenue)})\n`;
        });
      }

      if (edit) await ctx.editMessageText(text, { reply_markup: kb });
      else await ctx.reply(text, { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  bot.callbackQuery('m:dash', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    await showDashboard(ctx, true);
  });
  bot.command('dash', async (ctx) => showDashboard(ctx, false));
  bot.command('stats', async (ctx) => showDashboard(ctx, false));
}
