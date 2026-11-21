import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { money, time, uzs } from '../format.js';
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
    if (session.role !== 'OWNER' && session.role !== 'CASHIER') {
      const msg = '❌ Hisobot bo‘limi faqat ega va kassir uchun ochiq.';
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

  /** Today's till: money received by method plus the latest payments. */
  async function showToday(ctx: Context, edit: boolean) {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'OWNER' && session.role !== 'CASHIER') {
      const msg = '❌ Kassa bo‘limi faqat ega va kassir uchun.';
      if (edit) await ctx.editMessageText(msg, { reply_markup: backHome() });
      else await ctx.reply(msg, { reply_markup: backHome() });
      return;
    }
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const payments = await api.payments(config, store, ctx.chat.id, from);
      const valid = payments.filter((p) => !p.reversedAt);
      const sum = (kind: string) => valid.filter((p) => p.methodKind === kind).reduce((s, p) => s + p.amount, 0);
      const cash = sum('CASH');
      const card = sum('CARD');
      const other = sum('OTHER');
      const lines = [
        `💵 Bugungi kassa · ${now.toLocaleDateString('ru-RU')}`,
        '',
        `Naqd: ${money(cash)}`,
        `Karta: ${money(card)}`,
        ...(other > 0 ? [`Boshqa: ${money(other)}`] : []),
        `JAMI: ${money(cash + card + other)} (${valid.length} ta to‘lov)`,
      ];
      const reversed = payments.length - valid.length;
      if (reversed > 0) lines.push(`Qaytarilgan: ${reversed} ta`);
      const latest = payments
        .slice()
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 10);
      if (latest.length) {
        lines.push('', 'Oxirgi to‘lovlar:');
        for (const p of latest) {
          lines.push(`${time(p.createdAt)} · ${uzs(p.amount)} · ${p.methodName} · ${p.receivedByName}${p.reversedAt ? ' ↩️' : ''}`);
        }
      }
      const kb = new InlineKeyboard().text('🔄 Yangilash', 'm:today').text('⬅️ Bosh menyu', 'm:home');
      if (edit) await ctx.editMessageText(lines.join('\n'), { reply_markup: kb });
      else await ctx.reply(lines.join('\n'), { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  bot.callbackQuery('m:today', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showToday(ctx, true);
  });
  bot.command('bugun', async (ctx) => showToday(ctx, false));

  bot.callbackQuery('m:dash', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    await showDashboard(ctx, true);
  });
  bot.command('dash', async (ctx) => showDashboard(ctx, false));
  bot.command('stats', async (ctx) => showDashboard(ctx, false));
}
