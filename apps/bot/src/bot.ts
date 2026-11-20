import { Bot, type BotConfig as GrammyBotConfig } from 'grammy';
import { handleCloseReason, registerRooms } from './handlers/rooms.js';
import { registerAuth, replyStaffOnly } from './handlers/auth.js';
import { registerDashboard } from './handlers/dashboard.js';
import {
  handleDeliveryAddressLocation,
  handleDeliveryCashText,
  handleDeliveryText,
  registerDelivery,
} from './handlers/delivery.js';
import { registerKitchen } from './handlers/kitchen.js';
import { handleNoteText, handleQtyText, registerOrder } from './handlers/order.js';
import { handlePayAmountText, registerPayments } from './handlers/payments.js';
import { flowKey, type ChatContext, type Deps, type Flow } from './state.js';

/**
 * Builds the staff bot with every handler and the text/location routers.
 * Kept separate from `main()` so tests can drive it with fake updates.
 */
export function createBot(deps: Deps, botConfig?: GrammyBotConfig<ChatContext>): Bot<ChatContext> {
  const { store, flows } = deps;
  const bot = new Bot<ChatContext>(deps.config.token, botConfig);

  bot.use(async (ctx, next) => {
    if (!ctx.chat) return;
    await next();
  });

  // Global error handler
  bot.catch((err) => {
    console.error('Botda kutilmagan xatolik:', err);
  });

  // Register all staff role handlers
  registerAuth(deps, bot);
  registerRooms(deps, bot);
  registerKitchen(deps, bot);
  registerDelivery(deps, bot);
  registerOrder(deps, bot);
  registerDashboard(deps, bot);
  registerPayments(deps, bot);

  // Telegram location messages for the staff delivery wizard.
  bot.on('message:location', async (ctx) => {
    if (!ctx.chat) return;
    if (!store.get(ctx.chat.id)) return replyStaffOnly(ctx);
    const flow = flows.get(flowKey(ctx.chat.id));
    if (flow?.kind === 'delivery-address') {
      return handleDeliveryAddressLocation(deps, ctx, flow);
    }
  });

  // Router for plain text messages based on active flows
  bot.on('message:text', async (ctx) => {
    if (!ctx.chat) return;
    const text = ctx.message.text.trim();
    const session = store.get(ctx.chat.id);
    if (text.startsWith('/')) {
      // Known commands are handled by bot.command; reject removed/unknown ones.
      if (!session) return replyStaffOnly(ctx);
      return;
    }
    if (!session) return replyStaffOnly(ctx);

    const flow = flows.get(flowKey(ctx.chat.id));
    if (flow) {
      switch (flow.kind) {
        case 'delivery-cash':
          return handleDeliveryCashText(deps, ctx, flow, text);
        case 'close-reason':
          return handleCloseReason(deps, ctx, flow.sessionId, text);
        case 'delivery-name':
        case 'delivery-phone':
        case 'delivery-address':
          return handleDeliveryText(deps, ctx, flow, text);
        case 'pay-amount':
          return handlePayAmountText(deps, ctx, flow, text);
        case 'order':
          if (flow.data.stage === 'note') return handleNoteText(deps, ctx, flow.data, text);
          if (flow.data.stage === 'qty' && flow.data.awaitingQty) {
            return handleQtyText(deps, ctx, flow.data, text);
          }
          await ctx.reply('Iltimos, ekrandagi tugmalardan foydalaning yoki /menu bosing.');
          return;
      }
    }

    await ctx.reply('Bosh menyuni ko‘rish uchun /menu buyrug‘ini bosing.');
  });

  return bot;
}
