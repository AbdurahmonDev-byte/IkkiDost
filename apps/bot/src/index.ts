import { createBot } from './bot.js';
import { loadConfig } from './config.js';
import { startNotificationPoller } from './poller.js';
import type { Deps, Flow } from './state.js';
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

  const bot = createBot(deps);

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
      { command: 'delivery', description: 'Saboy (telefon orqali buyurtmalar)' },
      { command: 'newdel', description: 'Yangi saboy' },
      { command: 'bugun', description: 'Bugungi kassa (ega, kassir)' },
      { command: 'kitchen', description: 'Oshxona navbati' },
      { command: 'dash', description: 'Hisobot (ega, kassir)' },
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
