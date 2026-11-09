import { InlineKeyboard, type Context } from 'grammy';
import { ApiError, api, SessionExpiredError } from '../api.js';
import { money, orderStatusLabel, time } from '../format.js';
import { backHome } from '../keyboards.js';
import { receiptMessage, sessionReceipt } from '../receipt.js';
import { flowKey, type Deps } from '../state.js';
import { expired } from './auth.js';
import type { RoomDto } from '../types.js';

const canTakeOrders = (role: string) => role === 'OWNER' || role === 'WAITER';
const canClose = (role: string) => role === 'OWNER' || role === 'CASHIER';

function roomLine(room: RoomDto): string {
  if (!room.activeSession) return `🫖 ${room.name} — bo‘sh`;
  const s = room.activeSession;
  const debt = s.outstandingAmount > 0 ? ` · qarz ${money(s.outstandingAmount)}` : '';
  return `🪑 ${room.name} — ${s.orderCount} buyurtma · ${money(s.totalAmount)}${debt}`;
}

export function registerRooms(deps: Deps, bot: import('grammy').Bot) {
  const { config, store, refs, flows } = deps;

  async function showRooms(ctx: Context, edit: boolean) {
    if (!ctx.chat) return;
    const session = store.get(ctx.chat.id);
    if (!session) return expired(deps, ctx);
    try {
      const rooms = await api.rooms(config, store, ctx.chat.id);
      const kb = new InlineKeyboard();
      for (const room of rooms) {
        kb.text(roomLine(room), `r:open:${refs.ref(ctx.chat.id, room.id)}`).row();
      }
      kb.text('🔄 Yangilash', 'm:rooms').row().text('⬅️ Bosh menyu', 'm:home');
      const text = rooms.length
        ? '🏠 Xonalar\n\nBand xonani tanlang yoki bo‘sh xonaga buyurtma oching:'
        : '🏠 Xonalar topilmadi. Egasi admin panelda qo‘shishi mumkin.';
      if (edit) await ctx.editMessageText(text, { reply_markup: kb });
      else await ctx.reply(text, { reply_markup: kb });
    } catch (error) {
      return handleError(deps, ctx, error);
    }
  }

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
      const rooms = await api.rooms(config, store, ctx.chat.id);
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return stale(ctx);

      const kb = new InlineKeyboard();
      let text = `🚪 ${room.name}\n\n`;

      if (!room.activeSession) {
        text += 'Xona bo‘sh. Yangi sessiya ochish uchun buyurtma yarating.';
        if (canTakeOrders(session.role)) kb.text('➕ Buyurtma ochish', `o:start:${ctx.match[1]}`).row();
      } else {
        const detail = await api.roomSession(config, store, ctx.chat.id, room.activeSession.id);
        text +=
          `📋 Sessiya (${time(detail.openedAt)} dan)\n` +
          `Umumiy: ${money(detail.totalAmount)}\n` +
          `To‘langan: ${money(detail.paidAmount)}\n` +
          `Qarz: ${money(detail.outstandingAmount)}\n`;

        const orders = detail.orders
          .slice()
          .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
          .slice(-3);

        for (const order of orders) {
          text += `\n#${order.orderNumber} · ${orderStatusLabel[order.status]} · ${money(order.totalAmount)}`;
          const readyItems = order.items.filter((item) => item.status === 'READY');
          if (canTakeOrders(session.role) && readyItems.length > 0) {
            for (const item of readyItems.slice(0, 4)) {
              kb
                .text(
                  `✅ ${shortName(item.productName)} · berildi`,
                  `r:svc:${refs.ref(ctx.chat.id, order.id)}:${refs.ref(ctx.chat.id, item.id)}`,
                )
                .row();
            }
          }
        }
        if (detail.orders.length > 3) text += `\n… va yana ${detail.orders.length - 3} ta buyurtma`;
        if (detail.outstandingAmount > 0) text += '\n\n⚠️ To‘lov kassada qabul qilinadi.';

        if (canTakeOrders(session.role)) kb.text('➕ Taom qo‘shish', `o:start:${ctx.match[1]}`).row();
        kb.text('🧾 Chek', `r:rcpt:${refs.ref(ctx.chat.id, detail.id)}`);
        if (canClose(session.role)) {
          kb.text('🔒 Hisobni yopish', `r:close:${refs.ref(ctx.chat.id, detail.id)}`).row();
        } else {
          kb.row();
        }
      }

      kb.text('⬅️ Xonalar', 'm:rooms');
      await ctx.editMessageText(text, { reply_markup: kb });
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
      if (detail.outstandingAmount > 0 && session.role !== 'OWNER') {
        await ctx.answerCallbackQuery({
          text: `Qarz ${money(detail.outstandingAmount)}. Faqat egasi yopishi mumkin.`,
          show_alert: true,
        });
        return;
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
