import { InlineKeyboard, type Context } from 'grammy';
import { ApiError, api, SessionExpiredError } from '../api.js';
import { money, qty, time, uzs } from '../format.js';
import { backHome } from '../keyboards.js';
import { receiptMessage, sessionReceipt } from '../receipt.js';
import { flowKey, type Deps } from '../state.js';
import { expired } from './auth.js';
import type { OrderDto, OrderItemDto, RoomDto } from '../types.js';
import { canTakePayments } from './payments.js';

const canTakeOrders = (role: string) => role === 'OWNER' || role === 'WAITER' || role === 'CASHIER';
const canClose = (role: string) => role === 'OWNER' || role === 'CASHIER';

/** Compact tile label: 🟢 free, 🟡 busy with debt, ✅ busy and paid. */
function roomTile(room: RoomDto): string {
  const s = room.activeSession;
  if (!s) return `🟢 ${room.name}`;
  return `${s.outstandingAmount > 0 ? '🟡' : '✅'} ${room.name} · ${uzs(s.totalAmount)}`;
}

/** Same products across the bill's orders are summed into one ticket line. */
function ticketLines(orders: OrderDto[]): string[] {
  const lines = new Map<string, { name: string; unit: OrderItemDto['productUnit']; qty: number; total: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.status === 'CANCELLED') continue;
      const key = `${item.productName}|${item.unitPrice}`;
      const cur = lines.get(key) ?? { name: item.productName, unit: item.productUnit, qty: 0, total: 0 };
      cur.qty = Math.round((cur.qty + Number(item.quantity)) * 1000) / 1000;
      cur.total += item.lineTotal;
      lines.set(key, cur);
    }
  }
  return [...lines.values()].map((l) => `• ${l.name} × ${qty(l.qty, l.unit)} — ${uzs(l.total)}`);
}

/** Lets other handlers (order, payments) reopen a room ticket. */
export let showRoomRef: ((ctx: Context, roomId: string, edit: boolean) => Promise<unknown>) | null = null;

export function registerRooms(deps: Deps, bot: import('../state.js').AppBot) {
  const { config, store, refs, flows } = deps;

  async function showRooms(ctx: Context, edit: boolean) {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    if (session.role === 'DELIVERY') {
      return ctx.reply('🛵 Yetkazib beruvchi xonalar bo‘limidan foydalanmaydi. «Mening yetkazishlarim» bo‘limini oching.');
    }
    try {
      const rooms = await api.rooms(config, store, ctx.chat.id);
      const active = rooms.filter((r) => r.isActive);
      const kb = new InlineKeyboard();
      active.forEach((room, i) => {
        kb.text(roomTile(room), `r:open:${refs.ref(ctx.chat!.id, room.id)}`);
        if (i % 2 === 1) kb.row();
      });
      if (active.length % 2 === 1) kb.row();
      kb.text('🔄 Yangilash', 'm:rooms').text('⬅️ Bosh menyu', 'm:home');
      const busy = active.filter((r) => r.activeSession).length;
      const text = active.length
        ? `🏠 Zal — bo‘sh: ${active.length - busy}, band: ${busy}\n\n🟢 bo‘sh · 🟡 qarz bor · ✅ to‘langan\nXonani tanlang:`
        : '🏠 Xonalar topilmadi. Ega Mini App’da qo‘shishi mumkin.';
      if (edit) await ctx.editMessageText(text, { reply_markup: kb });
      else await ctx.reply(text, { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

  /** Room “ticket”: the whole bill and POS-style actions. */
  async function showRoom(ctx: Context, roomId: string, edit: boolean) {
    const chatId = ctx.chat!.id;
    const session = store.get(chatId)!;
    const rooms = await api.rooms(config, store, chatId);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return stale(ctx);
    const roomKey = refs.ref(chatId, room.id);
    const kb = new InlineKeyboard();
    let text: string;

    if (!room.activeSession) {
      text = `🟢 ${room.name} — bo‘sh\n\nYangi hisob ochish uchun mahsulot qo‘shing.`;
      if (canTakeOrders(session.role)) kb.text('➕ Buyurtma ochish', `o:start:${roomKey}`).row();
    } else {
      const detail = await api.roomSession(config, store, chatId, room.activeSession.id);
      const orders = detail.orders.slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      const fee = orders.reduce((sum, o) => sum + o.serviceFeeAmount, 0);
      let items = ticketLines(orders);
      if (items.length > 40) items = [...items.slice(0, 40), `… va yana ${items.length - 40} ta`];
      text =
        `🪑 ${room.name} · ochilgan ${time(detail.openedAt)}\n` +
        '━━━━━━━━━━━━━━\n' +
        (items.length ? items.join('\n') : '(mahsulot yo‘q)') +
        (fee > 0 ? `\n• Xizmat haqi — ${uzs(fee)}` : '') +
        '\n━━━━━━━━━━━━━━\n' +
        `Jami: ${money(detail.totalAmount)}\nTo‘langan: ${money(detail.paidAmount)}\n` +
        `${detail.outstandingAmount > 0 ? '🔴' : '🟢'} Qarz: ${money(detail.outstandingAmount)}`;

      const sessionKey = refs.ref(chatId, detail.id);
      if (canTakeOrders(session.role)) kb.text('➕ Mahsulot qo‘shish', `o:start:${roomKey}`);
      if (detail.outstandingAmount > 0 && canTakePayments(session.role)) {
        kb.text('💰 To‘lov', `p:open:s:${sessionKey}`);
      }
      kb.row();
      kb.text('🧾 Chek', `r:rcpt:${sessionKey}`);
      if (canClose(session.role)) kb.text('🔒 Yopish', `r:close:${sessionKey}`);
      kb.row();

      // Waiters confirm dishes the kitchen marked ready.
      if (canTakeOrders(session.role)) {
        const ready = orders.flatMap((o) => o.items.filter((i) => i.status === 'READY').map((i) => ({ o, i })));
        for (const { o, i } of ready.slice(0, 4)) {
          kb.text(`✅ ${shortName(i.productName)} · berildi`, `r:svc:${refs.ref(chatId, o.id)}:${refs.ref(chatId, i.id)}`).row();
        }
      }
      if (detail.outstandingAmount > 0 && !canTakePayments(session.role)) text += '\n\n⚠️ To‘lov kassada qabul qilinadi.';
    }

    kb.text('🔄 Yangilash', `r:open:${roomKey}`).text('⬅️ Zal', 'm:rooms');
    if (edit) await ctx.editMessageText(text, { reply_markup: kb });
    else await ctx.reply(text, { reply_markup: kb });
  }
  showRoomRef = showRoom;

  bot.callbackQuery('m:rooms', async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    await showRooms(ctx, true);
  });
  bot.command('rooms', async (ctx) => showRooms(ctx, false));

  bot.callbackQuery(/^r:open:(.+)$/, async (ctx) => {
    if (!ctx.chat) return;
    await ctx.answerCallbackQuery();
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const roomId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!roomId) return stale(ctx);
    try {
      await showRoom(ctx, roomId, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // Waiter marks a READY item as served.
  bot.callbackQuery(/^r:svc:([^:]+):(.+)$/, async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const orderId = refs.unref(ctx.chat.id, ctx.match[1]);
    const itemId = refs.unref(ctx.chat.id, ctx.match[2]);
    if (!orderId || !itemId) return stale(ctx);
    try {
      await api.setItemStatus(config, store, ctx.chat.id, orderId, itemId, 'SERVED');
      await ctx.answerCallbackQuery({ text: '✅ Berildi deb belgilandi' });
      await showRooms(ctx, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // Session receipt (80mm-style text check).
  bot.callbackQuery(/^r:rcpt:(.+)$/, async (ctx) => {
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const sessionId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!sessionId) return stale(ctx);
    try {
      const detail = await api.roomSession(config, store, ctx.chat.id, sessionId);
      const rooms = await api.rooms(config, store, ctx.chat.id);
      const room = rooms.find((r) => r.activeSession?.id === sessionId);
      await ctx.answerCallbackQuery();
      await ctx.reply(receiptMessage(sessionReceipt(detail, room?.name ?? 'Xona')), { parse_mode: 'HTML' });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  // Close session — confirmation, debt handling.
  bot.callbackQuery(/^r:close:(.+)$/, async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const sessionId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!sessionId) return stale(ctx);
    try {
      const detail = await api.roomSession(config, store, ctx.chat.id, sessionId);
      if (detail.status !== 'OPEN') {
        await ctx.answerCallbackQuery({ text: 'Sessiya allaqachon yopilgan', show_alert: true });
        return showRooms(ctx, true);
      }
      const kb = new InlineKeyboard()
        .text('✅ Ha, yopish', `r:closeyes:${ctx.match[1]}`)
        .text('❌ Bekor', 'm:rooms');
      const warn =
        detail.outstandingAmount > 0
          ? `\n⚠️ Qarz: ${money(detail.outstandingAmount)} — sabab ko‘rsatish talab qilinadi.`
          : '';
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `🔒 ${money(detail.totalAmount)} lik sessiyani yopishni tasdiqlaysizmi?${warn}`,
        { reply_markup: kb },
      );
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });

  bot.callbackQuery(/^r:closeyes:(.+)$/, async (ctx) => {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    const sessionId = refs.unref(ctx.chat.id, ctx.match[1]);
    if (!sessionId) return stale(ctx);
    try {
      const detail = await api.roomSession(config, store, ctx.chat.id, sessionId);
      if (detail.outstandingAmount > 0) {
        // Owner must provide a reason.
        flows.set(flowKey(ctx.chat.id), { kind: 'close-reason', sessionId });
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `⚠️ Qarz: ${money(detail.outstandingAmount)}\n\nYopish sababini yozib yuboring (kamida 3 ta belgi):`,
        );
        return;
      }
      await api.closeRoomSession(config, store, ctx.chat.id, sessionId);
      await ctx.answerCallbackQuery({ text: '✅ Sessiya yopildi' });
      await showRooms(ctx, true);
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  });
}

export async function handleCloseReason(deps: Deps, ctx: Context, sessionId: string, reason: string): Promise<void> {
  if (!ctx.chat) return;
  const { config, store, flows } = deps;
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    await ctx.reply('❌ Sabab juda qisqa. Kamida 3 ta belgi yozing:');
    return;
  }
  try {
    await api.closeRoomSession(config, store, ctx.chat.id, sessionId, trimmed);
    flows.delete(flowKey(ctx.chat.id));
    await ctx.reply('✅ Sessiya qarz bilan yopildi (sabab audit jurnalida saqlandi).', {
      reply_markup: backHome(),
    });
  } catch (error) {
    return handleError(deps, ctx, error);
  }
}

export function shortName(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function stale(ctx: Context): Promise<unknown> {
  return ctx.answerCallbackQuery({ text: 'Sessiya eskirgan — menyuni qayta oching.', show_alert: true });
}

export async function handleError(deps: Deps, ctx: Context, error: unknown): Promise<void> {
  if (error instanceof SessionExpiredError) return expired(deps, ctx);
  const message =
    error instanceof ApiError ? error.message : 'Kutilmagan xatolik. Keyinroq urinib ko‘ring.';
  try {
    await ctx.answerCallbackQuery({ text: `❌ ${message.slice(0, 180)}`, show_alert: true });
  } catch {
    await ctx.reply(`❌ ${message}`);
  }
}
