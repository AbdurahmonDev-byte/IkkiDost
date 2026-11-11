import { api, SessionExpiredError } from './api.js';
import type { AppBot, Deps } from './state.js';
import type { NotificationDto } from './types.js';

function notifIcon(type: string): string {
  switch (type) {
    case 'ORDER_CREATED':
      return '🆕';
    case 'ORDER_ITEM_READY':
      return '🔔';
    case 'WAITER_CALLED':
      return '🛎';
    case 'ORDER_CANCELLED':
      return '❌';
    case 'DELIVERY_ASSIGNED':
    case 'DELIVERY_STATUS_UPDATED':
      return '🛵';
    case 'PAYMENT_RECEIVED':
      return '💵';
    case 'PAYMENT_REVERSED':
      return '⚠️';
    case 'ROOM_SESSION_CLOSED':
      return '🔒';
    default:
      return '📢';
  }
}

export function startNotificationPoller(deps: Deps, bot: AppBot): () => void {
  const { config, store } = deps;
  let running = true;
  let timeoutId: NodeJS.Timeout | null = null;

  async function poll() {
    if (!running) return;

    const sessions = store.all();
    for (const [chatId, session] of sessions) {
      if (!running) break;
      try {
        const notifs = await api.notifications(config, store, chatId);
        const lastTime = new Date(session.lastNotifiedAt || session.linkedAt).getTime();

        const unnotified = notifs
          .filter((n) => new Date(n.createdAt).getTime() > lastTime)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (unnotified.length > 0) {
          let newestTime = session.lastNotifiedAt;

          for (const n of unnotified) {
            const icon = notifIcon(n.type);
            const text = `${icon} ${n.title}\n\n${n.body}`;
            try {
              await bot.api.sendMessage(chatId, text);
            } catch {
              // User may have blocked the bot; continue
            }
            if (new Date(n.createdAt).getTime() > new Date(newestTime).getTime()) {
              newestTime = n.createdAt;
            }
          }

          store.patch(chatId, { lastNotifiedAt: newestTime });
        }
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          try {
            await bot.api.sendMessage(
              chatId,
              '⚠️ Sessiyangiz muddati tugadi. Xabarnomalarni olish uchun qayta /login qiling.',
            );
          } catch {
            // ignore
          }
        }
      }
    }

    if (running) {
      timeoutId = setTimeout(poll, config.pollIntervalMs);
    }
  }

  // Start initial loop
  timeoutId = setTimeout(poll, Math.min(5000, config.pollIntervalMs));

  return () => {
    running = false;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
