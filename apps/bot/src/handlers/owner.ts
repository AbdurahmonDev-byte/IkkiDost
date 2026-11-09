import { type Context } from 'grammy';
import { api } from '../api.js';
import { money } from '../format.js';
import { backHome } from '../keyboards.js';
import type { Deps } from '../state.js';
import { expired } from './auth.js';
import { handleError } from './rooms.js';

function dashboardText(d: import('../types.js').DashboardSummaryDto): string {
  const profit = d.todayRevenue - d.todayExpenses;
  return [
    '📊 Bugungi hisobot',
    '',
    `💰 Tushum: ${money(d.todayRevenue)} (${d.todayOrderCount} buyurtma)`,
    `💵 To‘langan: ${money(d.paidToday)}`,
    `⚠️ Qarz: ${money(d.unpaidOutstanding)}`,
    `🧾 Xizmat haqi: ${money(d.serviceFeeRevenueToday)}`,
    `💸 Xarajat: ${money(d.todayExpenses)}`,
    `📈 Sof foyda: ${money(profit)}`,
    '',
    `🏠 Faol xonalar: ${d.activeRooms} · zalda: ${d.activeDineInOrders} · yetkazish: ${d.activeDeliveryOrders}`,
    '',
    'Ommabop taomlar:',
    ...(d.popularProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.productName} — ${money(p.revenue)} (${p.quantity})`) || []),
  ].join('\n');
}

export function registerOwner(deps: Deps, bot: import('grammy').Bot) {
  const { config, store } = deps;

  async function showDashboard(ctx: Context, edit: boolean) {
    const session = store.get(ctx.chat!.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'OWNER') {
      await ctx.reply('📊 Bu bo‘lim faqat egasi uchun.');
      return;
    }
    try {
      const data = await api.dashboard(config, store, ctx.chat!.id);
      if (edit) await ctx.editMessageText(dashboardText(data), { reply_markup: backHome() });
      else await ctx.reply(dashboardText(data), { reply_markup: backHome() });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  bot.command('dashboard', async (ctx) => showDashboard(ctx, false));
  bot.callbackQuery('m:dash', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showDashboard(ctx, true);
  });
}
