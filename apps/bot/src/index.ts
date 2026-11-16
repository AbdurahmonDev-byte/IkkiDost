import { Bot } from 'grammy';
import { loadConfig } from './config.js';
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
import { registerOrder } from './handlers/order.js';
import { startNotificationPoller } from './poller.js';
import { flowKey, type ChatContext, type Deps, type Flow } from './state.js';
import { Refs, Store } from './store.js';

async function main() {
  const config = loadConfig();

  if (!config.token) {
    console.error('❌ XATOLIK: BOT_TOKEN ko‘rsatilmagan!');
    console.error('');
    console.error('Botni ishga tushirish uchun .env fayliga quyidagini qo‘shing:');
    console.error('  BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    console.error('  API_URL=http://localhost:3000/api');
    console.error('');
    console.error('Token olish: Telegramda @BotFather ga /newbot yozing.');
    process.exit(1);
  }

  const store = new Store(config.storePath);
  const refs = new Refs();
  const flows = new Map<string, Flow>();
  const deps: Deps = { config, store, refs, flows };

  const bot = new Bot<ChatContext>(config.token);

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
        case 'order':
          await ctx.reply('Iltimos, ekrandagi tugmalardan foydalaning yoki /menu bosing.');
          return;
      }
    }

    await ctx.reply('Bosh menyuni ko‘rish uchun /menu buyrug‘ini bosing.');
  });

  // Start background notification polling
  const stopPoller = startNotificationPoller(deps, bot);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nBot to‘xtatilmoqda...');
    stopPoller();
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Command menu shown in Telegram's input field (same list for every role;
  // role checks happen inside each handler).
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Telegram ID orqali kirish' },
      { command: 'menu', description: 'Bosh menyu' },
      { command: 'rooms', description: 'Xonalar va hisoblar' },
      { command: 'kitchen', description: 'Oshxona navbati' },
      { command: 'delivery', description: 'Yetkazish buyurtmalari' },
      { command: 'newdel', description: 'Yangi yetkazish yaratish' },
      { command: 'dash', description: 'Bugungi hisobot (ega)' },
      { command: 'me', description: 'Profil va rol' },
      { command: 'logout', description: 'Hisobni uzish' },
      { command: 'help', description: 'Yordam' },
    ]);
  } catch (error) {
    console.warn('Bot buyruqlar menyusini o‘rnatib bo‘lmadi:', error);
  }

  console.log('🚀 Ikki Do‘st Telegram boti ishga tushdi!');
  console.log(`Backend API: ${config.apiUrl}`);
  console.log(`Mini App: ${config.miniAppUrl}`);
  console.log(`Sessiyalar bazasi: ${config.storePath}`);

  await bot.start({
    onStart: (info) => {
      console.log(`✅ Telegramga ulandi: @${info.username} (${info.first_name})`);
    },
  });
}

main().catch((err) => {
  console.error('Asosiy jarayonda xatolik:', err);
  process.exit(1);
});
