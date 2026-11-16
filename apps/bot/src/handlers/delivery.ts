import { InlineKeyboard, type Context } from 'grammy';
import { api } from '../api.js';
import { dateTime, deliveryNext, deliveryStatusLabel, isDeliveryActive, money, qty } from '../format.js';
import { flowKey, type Deps } from '../state.js';
import { expired, locationToAddress } from './auth.js';
import { handleError, stale } from './rooms.js';
import { startDeliveryWizard } from './order.js';
import { homeKeyboard, locationRequestKeyboard } from '../keyboards.js';
import type { DeliveryDto } from '../types.js';

const allowed = (role: string) => role === 'OWNER' || role === 'WAITER' || role === 'CASHIER' || role === 'DELIVERY';
const CLAIMABLE: DeliveryDto['status'][] = ['CONFIRMED', 'PREPARING', 'READY'];

function isClaimable(d: DeliveryDto): boolean {
  return !d.assignedToId && CLAIMABLE.includes(d.status);
}

export function registerDelivery(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store, refs, flows } = deps;

  async function showList(ctx: Context, edit: boolean) {
    const session = store.get(ctx.chat!.id);
    if (!session) return expired(deps, ctx);
    if (!allowed(session.role)) return ctx.reply('Ruxsat yo‘q.');
    try {
      const deliveries = await api.deliveries(config, store, ctx.chat!.id);
      const active = deliveries.filter((d) => isDeliveryActive(d.status));
      const recent = deliveries.filter((d) => !isDeliveryActive(d.status)).slice(0, 3);
      const cashPending = deliveries.filter(
        (d) => d.status === 'DELIVERED' && (d.cashCollectedAmount ?? 0) > 0 && !d.cashHandedOverAt,
      );
      const kb = new InlineKeyboard();
      const lines = [session.role === 'DELIVERY' ? '🛵 Mening yetkazishlarim\n' : '🛵 Yetkazib berish\n'];
      if (cashPending.length > 0) {
        lines.push(`💵 Kassir tasdiqlashi kerak: ${cashPending.length} ta yetkazish`);
        for (const d of cashPending.slice(0, 5)) {
          kb.text(
            `💵 #${d.orderNumber} ${d.customerName} · ${money(d.cashCollectedAmount ?? 0)}`,
            `d:open:${refs.ref(ctx.chat!.id, d.id)}`,
          ).row();
        }
        kb.row();
      }
      if (active.length === 0) lines.push('Faol buyurtma yo‘q.');
      for (const d of active) {
        const mark = isClaimable(d) ? '🆕 ' : '• ';
        const mine = d.assignedToId === session.userId ? ' (mening)' : '';
        kb.text(`${mark}${deliveryStatusLabel[d.status]} · #${d.orderNumber} ${d.customerName}${mine}`, `d:open:${refs.ref(ctx.chat!.id, d.id)}`).row();
      }
      for (const d of recent) {
        const cash = (d.cashCollectedAmount ?? 0) > 0 && !d.cashHandedOverAt ? '💵 ' : '';
        kb.text(`${cash}✔ ${deliveryStatusLabel[d.status]} · #${d.orderNumber} ${d.customerName}`, `d:open:${refs.ref(ctx.chat!.id, d.id)}`).row();
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

  async function renderDelivery(ctx: Context, d: DeliveryDto, edit: boolean, comment?: string) {
    const session = store.get(ctx.chat!.id);
    if (!session) return expired(deps, ctx);
    const lines = [
      `🛵 Yetkazish #${d.orderNumber}`,
      '',
      `👤 ${d.customerName}`,
      `📞 ${d.customerPhone}`,
      `📍 ${d.address}`,
      `Holat: ${deliveryStatusLabel[d.status]}`,
      `Jami: ${money(d.totalAmount)}`,
      `To‘langan: ${money(d.paidAmount)}`,
      ...(d.outstandingAmount > 0 ? [`Qoldiq: ${money(d.outstandingAmount)}`] : []),
      ...(d.cashCollectedAmount != null
        ? [
            `Naqd (kuryer): ${money(d.cashCollectedAmount)}${
              d.cashHandedOverAt ? ' ✅ kassir tasdiqladi' : ' ⏳ kassirga topshirilmagan'
            }`,
          ]
        : []),
      '',
      ...d.items.map((i) => `• ${i.productName} × ${qty(i.quantity, i.productUnit)}`),
    ];
    if (d.note) lines.push('', `✍️ ${d.note}`);
    lines.push('', `Yaratilgan: ${dateTime(d.createdAt)}`);
    if (comment) lines.push('', comment);

    const kb = new InlineKeyboard();
    const key = refs.ref(ctx.chat!.id, d.id);
    const mine = d.assignedToId === session.userId;
    if (isClaimable(d)) {
      kb.text('📥 Yetkazishni qabul qilish', `d:claim:${key}`).row();
    } else if (mine || session.role === 'OWNER') {
      const next = deliveryNext[d.status];
      // Couriers only hand off when the kitchen marks the order ready.
      const allowedNext = session.role === 'DELIVERY' ? next === 'OUT_FOR_DELIVERY' || next === 'DELIVERED' : Boolean(next);
      if (next === 'DELIVERED' && session.role === 'DELIVERY') {
        kb.text('✅ Yetkazildi — naqdni qayd etish', `d:cashstart:${key}`).row();
      } else if (next && allowedNext) {
        kb.text(`▶️ ${deliveryStatusLabel[next]}`, `d:next:${key}`).row();
      }
    }
    const cashPending = d.status === 'DELIVERED' && (d.cashCollectedAmount ?? 0) > 0 && !d.cashHandedOverAt;
    if (cashPending && (session.role === 'CASHIER' || session.role === 'OWNER')) {
      kb.text(`💵 Pul topshirildi — ${money(d.cashCollectedAmount ?? 0)}`, `d:handover:${key}`).row();
    }
    if (isDeliveryActive(d.status) && session.role !== 'DELIVERY') {
      kb.text('🚫 Bekor qilish', `d:cancel:${key}`).row();
    }
    kb.text('⬅️ Ro‘yxat', 'm:delivery');
    const text = lines.join('\n');
    if (edit) await ctx.editMessageText(text, { reply_markup: kb });
    else await ctx.reply(text, { reply_markup: kb });
  }

  bot.callbackQuery(/^d:open:(.+)$/, async (ctx) => {
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const d = await api.deliveries(config, store, ctx.chat.id).then((list) => list.find((x) => x.id === deliveryId));
      if (!d) return stale(ctx);
      await ctx.answerCallbackQuery();
      await renderDelivery(ctx, d, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^d:claim:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const d = await api.claimDelivery(config, store, ctx.chat.id, deliveryId);
      await ctx.answerCallbackQuery({ text: '✅ Qabul qilindi' });
      await renderDelivery(ctx, d, true, '✅ Buyurtma sizga biriktirildi. Tayyor bo‘lgach yo‘lga chiqing.');
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
      const list = await api.deliveries(config, store, ctx.chat.id);
      const d = list.find((x) => x.id === deliveryId);
      const next = d ? deliveryNext[d.status] : undefined;
      if (!d || !next) return stale(ctx);
      const updated = await api.updateDeliveryStatus(config, store, ctx.chat.id, deliveryId, next);
      await ctx.answerCallbackQuery({ text: `▶️ ${deliveryStatusLabel[next]}` });
      await renderDelivery(ctx, updated, true, `✅ ${deliveryStatusLabel[d.status]} → ${deliveryStatusLabel[next]}`);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  /** Courier marks the delivery done — first record the cash collected. */
  bot.callbackQuery(/^d:cashstart:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const list = await api.deliveries(config, store, ctx.chat.id);
      const d = list.find((x) => x.id === deliveryId);
      if (!d || d.status !== 'OUT_FOR_DELIVERY') return stale(ctx);
      flows.set(flowKey(ctx.chat.id), {
        kind: 'delivery-cash',
        deliveryId,
        orderNumber: d.orderNumber,
        outstanding: d.outstandingAmount,
      });
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard();
      if (d.outstandingAmount > 0) {
        kb.text(`💵 Naqd ${money(d.outstandingAmount)}`, `d:cash:${ctx.match[1]}:${d.outstandingAmount}`).row();
      }
      kb.text('💳 Naqdsiz / pul olinmadi', `d:cash:${ctx.match[1]}:0`).row();
      kb.text('✍️ Boshqa summa', `d:cashmanual:${ctx.match[1]}`).row();
      kb.text('⬅️ Bekor qilish', 'm:delivery');
      await ctx.editMessageText(
        `💵 Naqd pulni qayd eting\n\n#${d.orderNumber} · ${d.customerName}\n` +
          `Qoldiq: ${money(d.outstandingAmount)}\n\nMijozdan qancha naqd pul oldingiz?`,
        { reply_markup: kb },
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^d:cash:(.+):(\d+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const amount = Number(ctx.match[2]);
      const updated = await api.updateDeliveryStatus(config, store, ctx.chat.id, deliveryId, 'DELIVERED', amount);
      flows.delete(flowKey(ctx.chat.id));
      await ctx.answerCallbackQuery({ text: '✅ Yetkazildi' });
      await renderDelivery(
        ctx,
        updated,
        true,
        amount > 0
          ? `✅ Yetkazildi. Naqd ${money(amount)} kassirga topshirilishi kerak.`
          : '✅ Naqdsiz yetkazildi.',
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^d:cashmanual:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (!refs.unref(ctx.chat.id, ctx.match[1])) return stale(ctx);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✍️ Mijozdan olingan naqd summani so‘mda yozing (faqat raqam):');
  });

  /** Cashier/owner confirms the courier handed the cash over. */
  bot.callbackQuery(/^d:handover:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('✅ Ha, to‘lov qilindi', `d:handovery:${ctx.match[1]}`)
      .row()
      .text('❌ Yo‘q', 'm:delivery');
    await ctx.editMessageText(
      '💵 Kuryer naqd pulni topshirdimi?\n\nTasdiqlasangiz, to‘lov kassada qayd etiladi.',
      { reply_markup: kb },
    );
  });

  bot.callbackQuery(/^d:handovery:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const deliveryId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!deliveryId) return stale(ctx);
    try {
      const updated = await api.handoverDeliveryCash(config, store, ctx.chat.id, deliveryId);
      await ctx.answerCallbackQuery({ text: '✅ To‘lov qilindi' });
      await renderDelivery(
        ctx,
        updated,
        true,
        `✅ To‘lov qilindi. Naqd ${money(updated.cashCollectedAmount ?? 0)} kassaga qabul qilindi.`,
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^d:cancel:(.+)$/, async (ctx) => {    const kb = new InlineKeyboard()
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
  async function promptNewDelivery(ctx: Context, edit: boolean) {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (session.role !== 'OWNER' && session.role !== 'WAITER') {
      if (edit) return ctx.answerCallbackQuery({ text: 'Ruxsat yo‘q', show_alert: true });
      return ctx.reply('🛵 Yangi yetkazishni faqat ofitsiant va ega yaratadi.');
    }
    flows.set(flowKey(ctx.chat.id), { kind: 'delivery-name' });
    const text = '🛵 Yangi yetkazish\n\n1/3 — Mijoz ismini yozing:';
    if (edit) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(text);
    } else {
      await ctx.reply(text);
    }
  }

  bot.callbackQuery('m:newdel', (ctx) => promptNewDelivery(ctx, true));
  bot.command('newdel', (ctx) => promptNewDelivery(ctx, false));
}

/** Text router handler for the name/phone/address prompt chain. */
export async function handleDeliveryText(
  deps: Deps,
  ctx: Context,
  flow: { kind: string; name?: string; phone?: string },
  text: string,
): Promise<void> {
  const { flows } = deps;
  const chatId = ctx.chat!.id;
  const value = text.trim();

  if (flow.kind === 'delivery-name') {
    if (value.length < 1) {
      await ctx.reply('❌ Ism kiriting:');
      return;
    }
    flows.set(flowKey(chatId), { kind: 'delivery-phone', name: value });
    await ctx.reply(`2/3 — ${value} telefon raqamini yozing (masalan: +998901234567):`);
    return;
  }
  if (flow.kind === 'delivery-phone') {
    if (!/^[+\d][\d\s()-]{3,}$/.test(value)) {
      await ctx.reply('❌ Telefon noto‘g‘ri. Qayta yozing:');
      return;
    }
    flows.set(flowKey(chatId), { kind: 'delivery-address', name: flow.name!, phone: value });
    await ctx.reply(
      '3/3 — Yetkazish manzilini yuboring.\n\nLokatsiyani yuborishingiz yoki manzilni qo‘lda yozishingiz mumkin.',
      { reply_markup: locationRequestKeyboard() },
    );
    return;
  }
  if (flow.kind === 'delivery-address') {
    if (value.length < 3) {
      await ctx.reply('❌ Manzil juda qisqa. Qayta yozing:');
      return;
    }
    await startDeliveryWizard(deps, ctx, { name: flow.name!, phone: flow.phone!, address: value });
  }
}

/** Telegram location message during the staff delivery-address prompt. */
export async function handleDeliveryAddressLocation(
  deps: Deps,
  ctx: Context,
  flow: { kind: string; name?: string; phone?: string },
): Promise<void> {
  const location = ctx.message?.location;
  if (!location || !flow.name || !flow.phone) return;
  await startDeliveryWizard(deps, ctx, {
    name: flow.name,
    phone: flow.phone,
    address: locationToAddress(location.latitude, location.longitude),
  });
}

/** Text router for the courier's collected-cash prompt. */
export async function handleDeliveryCashText(
  deps: Deps,
  ctx: Context,
  flow: { kind: 'delivery-cash'; deliveryId: string; orderNumber: number; outstanding: number },
  text: string,
): Promise<void> {
  const { config, store, flows } = deps;
  if (!ctx.chat) return;
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) {
    await ctx.reply('❌ Faqat raqam kiriting (masalan: 45000):');
    return;
  }
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount > flow.outstanding) {
    await ctx.reply(`❌ Summa qoldiqdan oshmasligi kerak (${money(flow.outstanding)}):`);
    return;
  }
  try {
    const updated = await api.updateDeliveryStatus(
      config,
      store,
      ctx.chat.id,
      flow.deliveryId,
      'DELIVERED',
      amount,
    );
    flows.delete(flowKey(ctx.chat.id));
    await ctx.reply(
      amount > 0
        ? `✅ Buyurtma #${flow.orderNumber} yetkazildi.\n💵 Naqd ${money(amount)} — kassirga topshiring.`
        : `✅ Buyurtma #${flow.orderNumber} naqdsiz yetkazildi.`,
      { reply_markup: { remove_keyboard: true } },
    );
    await ctx.reply('Bosh menyu:', {
      reply_markup: homeKeyboard(store.get(ctx.chat.id)?.role ?? 'DELIVERY', config.miniAppUrl),
    });
    void updated;
  } catch (error) {
    return handleError(deps, ctx, error);
  }
}
