import { InlineKeyboard } from 'grammy';
import type { BotRole } from './store.js';

/** Home menu per staff role. */
export function homeKeyboard(role: BotRole, miniAppUrl: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  // Mini App button on top
  kb.webApp('📱 Universal Mini Appni ochish', miniAppUrl).row();

  if (role === 'DELIVERY') {
    kb.text('🛵 Mening yetkazishlarim', 'm:delivery').row();
    kb.text('ℹ️ Yordam', 'm:help');
    return kb;
  }

  if (role === 'OWNER' || role === 'WAITER' || role === 'CASHIER') {
    kb.text('🏠 Xonalar', 'm:rooms').text('📞 Saboy', 'm:delivery').row();
    kb.text('➕ Yangi saboy', 'm:newdel').row();
  }
  if (role === 'OWNER' || role === 'CASHIER') {
    kb.text('💵 Bugungi kassa', 'm:today').text('📊 Hisobot', 'm:dash').row();
  }
  if (role === 'OWNER' || role === 'CHEF') {
    kb.text('👨‍🍳 Oshxona', 'm:kitchen').row();
  }
  kb.text('ℹ️ Yordam', 'm:help');
  return kb;
}

export const MANUAL_ADDRESS = '✍️ Manzilni qo‘lda yozish';
export const SKIP_ADDRESS = '⏭ O‘tkazib yuborish';

/** Reply keyboard for the staff delivery-address wizard. */
export function locationRequestKeyboard() {
  return {
    keyboard: [
      [{ text: '📍 Lokatsiyani yuborish', request_location: true }],
      [{ text: MANUAL_ADDRESS }],
      [{ text: SKIP_ADDRESS }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function backHome(label = '⬅️ Bosh menyu'): InlineKeyboard {
  return new InlineKeyboard().text(label, 'm:home');
}

export const roleLabel: Record<BotRole, string> = {
  OWNER: 'Ega',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
  DELIVERY: 'Yetkazib beruvchi',
};

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Xayrli tun';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}
