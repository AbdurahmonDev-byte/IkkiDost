import type { Bot } from 'grammy';
import { api, SessionExpiredError } from './api.js';
import type { Deps } from './state.js';

const iconByType: Record<string, string> = {
  ORDER_CREATED: '🧾',
  ITEM_READY: '✅',
  ORDER_READY: '✅',
  PAYMENT_RECEIVED: '💵',
  PAYMENT_REVERSED: '↩️',
  DELIVERY_CREATED: '🛵',
  DELIVERY_STATUS: '📍',
  ROOM_CLOSED: '🔒',
  SESSION_CLOSE_OVERRIDE: '⚠️',
};

/**
 * Polls the notifications API for every linked staff chat and forwards new
 * ones into Telegram. Works on every device, no app store, no push keys.
 */
export function startNotificationLoop(deps: Deps, bot: Bot): NodeJS.Timeout {
  const { config, store } = deps;

  async function tick(): Promise<void> {
    for (const [chatId, session] of store.all()) {
      try {
        const items = await api.notifications(config, store, chatId);
        const fresh = items
          .filter((n) => n.createdAt > session.lastNotifiedAt)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (fresh.length === 0) continue;

        // Send at most 5 per tick to avoid floods after downtime.
        for (const n of fresh.slice(-5)) {
          const icon = iconByType[n.type] ?? '🔔';
          try {
            await bot.api.sendMessage(chatId, `${icon} ${n.title}\n${n.body}`);
          } catch {
            // User blocked the bot — drop the session silently later.
          }
        }
        store.patch(chatId, { lastNotifiedAt: fresh[fresh.length - 1].createdAt });
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          try {
            await bot.api.sendMessage(chatId, '⚠️ Sessiya muddati tugadi. Qayta /login qiling.');
          } catch {
            // ignore
          }
        }
        // Network hiccups: retry next tick.
      }
    }
  }

  void tick();
  return setInterval(() => {
    void tick();
  }, deps.config.pollIntervalMs);
}
