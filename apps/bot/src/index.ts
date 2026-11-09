import { Bot } from 'grammy';
import { loadConfig } from './config.js';
import { SystemClient } from './api.js';
import { customerKeyboard } from './keyboards.js';
import { handleCloseReason, registerRooms } from './handlers/rooms.js';
import { handleLoginText, registerAuth } from './handlers/auth.js';
import { registerCustomer } from './handlers/customer.js';
import { registerDashboard } from './handlers/dashboard.js';
import {
  handleDeliveryAddress,
  handleDeliveryName,
  handleDeliveryPhone,
  registerDelivery,
} from './handlers/delivery.js';
import { registerKitchen } from './handlers/kitchen.js';
import { handleNoteText, registerOrder } from './handlers/order.js';
import { startNotificationPoller } from './poller.js';
import { flowKey, type Deps, type Flow } from './state.js';
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
  const system =
    config.systemUsername && config.systemPassword
      ? new SystemClient(config, config.systemUsername, config.systemPassword)
      : null;
  const deps: Deps = {
    config,
    store,
    refs,
    flows,
    system,
    waiterCalls: new Map<string, number>(),
  };

  if (!system) {
    console.warn('⚠️ BOT_USERNAME/BOT_PASSWORD sozlanmagan: mijozlarning mustaqil buyurtmalari o‘chiq.');
  }

  const bot = new Bot(config.token);

  // Global error handler
  bot.catch((err) => {
    console.error('Botda kutilmagan xatolik:', err);
  });

  // Register all staff and customer handlers
  registerAuth(deps, bot);
  registerCustomer(deps, bot);
  registerRooms(deps, bot);
  registerKitchen(deps, bot);
  registerDelivery(deps, bot);
  registerOrder(deps, bot);
  registerDashboard(deps, bot);

  // Router for plain text messages based on active flows
  bot.on('message:text', async (ctx) => {
    if (!ctx.chat) return;
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return; // Commands handled by bot.command

    const flow = flows.get(flowKey(ctx.chat.id));
    if (flow) {
      switch (flow.kind) {
        case 'login':
          return handleLoginText(deps, ctx, text);
        case 'close-reason':
          return handleCloseReason(deps, ctx, flow.sessionId, text);
        case 'delivery-name':
          return handleDeliveryName(deps, ctx, text);
        case 'delivery-phone':
          return handleDeliveryPhone(deps, ctx, flow.name, text);
        case 'delivery-address':
          return handleDeliveryAddress(deps, ctx, flow.name, flow.phone, text);
        case 'order':
          if (flow.data.stage === 'note') {
            return handleNoteText(deps, ctx, flow.data, text);
          }
          await ctx.reply('Iltimos, ekrandagi tugmalardan foydalaning yoki /menu bosing.');
          return;
      }
    }

    const session = store.get(ctx.chat.id);
    if (!session) {
      await ctx.reply(
        '🍵 Ikki Do‘st choyxonasi botiga xush kelibsiz!\n\n' +
          'Taomlar menyusi, buyurtma berish va ofitsiant chaqirish uchun quyidagi tugmani bosing:',
        { reply_markup: customerKeyboard(config.miniAppUrl) },
      );
    } else {
      await ctx.reply('Bosh menyuni ko‘rish uchun /menu buyrug‘ini bosing.');
    }
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

  console.log('🚀 Ikki Do‘st Telegram boti ishga tushdi!');
  console.log(`Backend API: ${config.apiUrl}`);
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
