import { InlineKeyboard } from 'grammy';
import type { BotRole } from './store.js';

/** Home menu per role. */
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

/**
 * Customer menu. On-site guests may only call a waiter — ordering happens
 * remotely through the Mini App (delivery only).
 */
export function customerKeyboard(miniAppUrl: string, roomId?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.webApp('🛵 Uyga yetkazish buyurtmasi', miniAppUrl).row();

  if (roomId) {
    kb.text('🔔 Ofitsiant chaqirish', `c:call:${roomId}`).row();
  }

  kb.text('📝 Ro‘yxatdan o‘tish', 'c:register').row();
  return kb;
}

/** Shown after a guest registers — straight to the Mini App. */
export function registeredCustomerKeyboard(miniAppUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('🛵 Uyga buyurtma berish', miniAppUrl)
    .row()
    .text('📍 Manzilni o‘zgartirish', 'c:location')
    .row()
    .text('👤 Profilim', 'c:profile');
}

/** Reply keyboard that asks for a Telegram location, with a manual fallback. */
export function locationRequestKeyboard() {
  return {
    keyboard: [
      [{ text: '📍 Lokatsiyani yuborish', request_location: true }],
      [{ text: '✍️ Manzilni qo‘lda yozish' }],
      [{ text: '⏭ O‘tkazib yuborish' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function backHome(label = '⬅️ Bosh menyu'): InlineKeyboard {
  return new InlineKeyboard().text(label, 'm:home');
}

export const roleLabel: Record<BotRole, string> = {
  OWNER: 'Egasi',
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
