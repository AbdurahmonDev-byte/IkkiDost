import { randomUUID } from 'node:crypto';
import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { money } from '../format.js';
import { backHome } from '../keyboards.js';
import { flowKey, type Deps } from '../state.js';
import type { PaymentMethodDto } from '../types.js';
import { expired } from './auth.js';
import { handleError, stale } from './rooms.js';

/** Only the cashier and the owner accept money (mirrors the API guards). */
export const canTakePayments = (role: string) => role === 'OWNER' || role === 'CASHIER';

type Target = 'session' | 'order';
const code = (t: Target) => (t === 'session' ? 's' : 'o');
const fromCode = (c: string): Target => (c === 's' ? 'session' : 'order');

const methodIcon = (m: PaymentMethodDto) => (m.kind === 'CASH' ? '💵' : m.kind === 'CARD' ? '💳' : '🔁');

/** Current outstanding balance and a human label for a session or order. */
async function loadTarget(deps: Deps, chatId: number, target: Target, targetId: string) {
  const { config, store } = deps;
  if (target === 'session') {
    const s = await api.roomSession(config, store, chatId, targetId);
    return { outstanding: s.outstandingAmount, total: s.totalAmount, paid: s.paidAmount, label: 'Xona hisobi' };
  }
  const o = await api.order(config, store, chatId, targetId);
  return {
    outstanding: o.outstandingAmount,
    total: o.totalAmount,
    paid: o.paidAmount,
    label: `Buyurtma #${o.orderNumber}`,
  };
}

/** Button that opens the payment screen; callers add it next to a bill. */
export function payButton(kb: InlineKeyboard, deps: Deps, chatId: number, target: Target, targetId: string, outstanding: number) {
  kb.text(`💰 To‘lov qabul qilish (${money(outstanding)})`, `p:open:${code(target)}:${deps.refs.ref(chatId, targetId)}`).row();
}

export function registerPayments(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store, refs, flows } = deps;

  async function guard(ctx: Context) {
    const session = store.get(ctx.chat!.id);
    if (!session) {
      await expired(deps, ctx);
      return null;
    }
    if (!canTakePayments(session.role)) {
      await ctx.answerCallbackQuery({ text: 'To‘lovni faqat kassir yoki ega qabul qiladi', show_alert: true });
      return null;
    }
    return session;
  }

  // Payment screen: outstanding balance + one row per active method.
  bot.callbackQuery(/^p:open:([so]):(.+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    const target = fromCode(ctx.match[1]);
    const targetId = refs.unref(ctx.chat.id, ctx.match[2]);
    if (!targetId) return stale(ctx);
    try {
      const [info, methods] = await Promise.all([
        loadTarget(deps, ctx.chat.id, target, targetId),
        api.paymentMethods(config, store, ctx.chat.id),
      ]);
      await ctx.answerCallbackQuery();
      if (info.outstanding <= 0) {
        await ctx.editMessageText(`✅ ${info.label} to‘liq to‘langan.`, { reply_markup: backHome() });
        return;
      }
      const kb = new InlineKeyboard();
      for (const m of methods.filter((x) => x.isActive)) {
        const mref = refs.ref(ctx.chat.id, m.id);
        kb.text(`${methodIcon(m)} ${m.name} — to‘liq`, `p:full:${ctx.match[1]}:${ctx.match[2]}:${mref}`);
        kb.text('✍️ Qisman', `p:part:${ctx.match[1]}:${ctx.match[2]}:${mref}`).row();
      }
      kb.text('⬅️ Bosh menyu', 'm:home');
      await ctx.editMessageText(
        `💰 ${info.label}\n\nJami: ${money(info.total)}\nTo‘langan: ${money(info.paid)}\n` +
          `Qoldiq: ${money(info.outstanding)}\n\nTo‘lov usulini tanlang:`,
        { reply_markup: kb },
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // Full payment of the current outstanding balance. The API rejects
  // overpayment, so a double tap cannot charge twice.
  bot.callbackQuery(/^p:full:([so]):([^:]+):(.+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    const target = fromCode(ctx.match[1]);
    const targetId = refs.unref(ctx.chat.id, ctx.match[2]);
    const methodId = refs.unref(ctx.chat.id, ctx.match[3]);
    if (!targetId || !methodId) return stale(ctx);
    try {
      const info = await loadTarget(deps, ctx.chat.id, target, targetId);
      if (info.outstanding <= 0) {
        await ctx.answerCallbackQuery({ text: 'Qarz yo‘q — allaqachon to‘langan', show_alert: true });
        return;
      }
      const payment = await api.pay(config, store, ctx.chat.id, target, targetId, {
        amount: info.outstanding,
        methodId,
        idempotencyKey: randomUUID(),
      });
      await ctx.answerCallbackQuery({ text: '✅ To‘lov qabul qilindi' });
      await ctx.editMessageText(
        `✅ ${info.label}: ${money(payment.amount)} (${payment.methodName}) qabul qilindi.\nQoldiq: ${money(0)}`,
        { reply_markup: backHome() },
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // Partial payment — ask for the amount as text.
  bot.callbackQuery(/^p:part:([so]):([^:]+):(.+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    const target = fromCode(ctx.match[1]);
    const targetId = refs.unref(ctx.chat.id, ctx.match[2]);
    const methodId = refs.unref(ctx.chat.id, ctx.match[3]);
    if (!targetId || !methodId) return stale(ctx);
    try {
      const [info, methods] = await Promise.all([
        loadTarget(deps, ctx.chat.id, target, targetId),
        api.paymentMethods(config, store, ctx.chat.id),
      ]);
      const method = methods.find((m) => m.id === methodId);
      flows.set(flowKey(ctx.chat.id), {
        kind: 'pay-amount',
        target,
        targetId,
        methodId,
        methodName: method?.name ?? 'To‘lov',
        outstanding: info.outstanding,
      });
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `✍️ ${info.label} — ${method?.name ?? ''}\nQoldiq: ${money(info.outstanding)}\n\n` +
          'Qabul qilingan summani so‘mda yozing (masalan: 50000):',
        { reply_markup: new InlineKeyboard().text('❌ Bekor qilish', 'm:home') },
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });
}

/** Text router handler for the partial payment amount. */
export async function handlePayAmountText(
  deps: Deps,
  ctx: Context,
  flow: { target: Target; targetId: string; methodId: string; methodName: string; outstanding: number },
  text: string,
): Promise<void> {
  const { config, store, flows } = deps;
  if (!ctx.chat) return;
  const digits = text.replace(/[\s,.'’‘]/g, '');
  if (!/^\d+$/.test(digits) || Number(digits) <= 0) {
    await ctx.reply('❌ Faqat musbat raqam kiriting (masalan: 50000):');
    return;
  }
  const amount = Number(digits);
  if (amount > flow.outstanding) {
    await ctx.reply(`❌ Summa qoldiqdan oshmasligi kerak (${money(flow.outstanding)}). Qayta yozing:`);
    return;
  }
  try {
    const payment = await api.pay(config, store, ctx.chat.id, flow.target, flow.targetId, {
      amount,
      methodId: flow.methodId,
      idempotencyKey: randomUUID(),
    });
    flows.delete(flowKey(ctx.chat.id));
    await ctx.reply(
      `✅ ${money(payment.amount)} (${payment.methodName}) qabul qilindi.\nQoldiq: ${money(flow.outstanding - amount)}`,
      { reply_markup: backHome() },
    );
  } catch (error) {
    return handleError(deps, ctx, error);
  }
}
