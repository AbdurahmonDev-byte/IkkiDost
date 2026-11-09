import { InlineKeyboard } from 'grammy';
import type { BotRole } from './store.js';

/** Home menu per role. */
export function homeKeyboard(role: BotRole, miniAppUrl: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  // Mini App button on top
  kb.webApp('📱 Universal Mini Appni ochish', miniAppUrl).row();

  if (role === 'OWNER' || role === 'WAITER' || role === 'CASHIER') {
    kb.text('🏠 Xonalar', 'm:rooms');
    kb.text('🛵 Yetkazish', 'm:delivery');
    kb.row();
  }
  if (role === 'OWNER' || role === 'CHEF') {
    kb.text('👨‍🍳 Oshxona', 'm:kitchen').row();
  }
  if (role === 'OWNER' || role === 'WAITER') {
    kb.text('➕ Yangi yetkazish', 'm:newdel').row();
  }
  if (role === 'OWNER') {
    kb.text('📊 Hisobot', 'm:dash').row();
  }
  kb.text('ℹ️ Yordam', 'm:help');
  return kb;
}

/** Customer self-service menu (for any guest / customer) */
export function customerKeyboard(miniAppUrl: string, roomId?: string, roomName?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const url = roomId ? `${miniAppUrl}?room=${roomId}` : miniAppUrl;
  const label = roomName ? `🛍 ${roomName} uchun buyurtma berish` : '📱 Taomlar menyusi (Mini App)';

  kb.webApp(label, url).row();

  if (roomId) {
    kb.text('🔔 Ofitsiant chaqirish', `c:call:${roomId}`).row();
  }

  kb.text('🔐 Xodimlar uchun kirish', 'm:login');
  return kb;
}

export function backHome(label = '⬅️ Bosh menyu'): InlineKeyboard {
  return new InlineKeyboard().text(label, 'm:home');
}

export const roleLabel: Record<BotRole, string> = {
  OWNER: 'Egasi',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
};

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Xayrli tun';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}
