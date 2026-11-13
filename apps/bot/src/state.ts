import type { BotConfig } from './config.js';
import type { SystemClient } from './api.js';
import type { Refs, Store } from './store.js';
import type { Bot, Context } from 'grammy';

export type ChatContext = Context & { chat: NonNullable<Context['chat']> };
export type AppBot = Bot<ChatContext>;

export type Actor = 'staff' | 'customer';

export interface OrderFlow {
  mode: 'DINE_IN' | 'DELIVERY';
  actor: Actor;
  roomId?: string;
  roomName?: string;
  customer?: { name: string; phone: string; address: string };
  people: number;
  stage: 'people' | 'menu' | 'qty' | 'note' | 'confirm';
  categoryId?: string;
  currentProductId?: string;
  /** productId -> quantity */
  lines: Record<string, number>;
  note?: string;
}

export type Flow =
  | { kind: 'owner-password' }
  | { kind: 'register-confirm-name'; firstName: string; lastName: string }
  | { kind: 'register-first-name' }
  | { kind: 'register-last-name'; firstName: string }
  | { kind: 'register-phone'; firstName: string; lastName: string }
  | { kind: 'customer-location' }
  | { kind: 'delivery-cash'; deliveryId: string; orderNumber: number; outstanding: number }
  | { kind: 'delivery-name'; actor: Actor }
  | { kind: 'delivery-phone'; actor: Actor; name: string }
  | { kind: 'delivery-address'; actor: Actor; name: string; phone: string }
  | { kind: 'order'; data: OrderFlow }
  | { kind: 'close-reason'; sessionId: string };

export interface Deps {
  config: BotConfig;
  store: Store;
  refs: Refs;
  /** Dedicated staff account for customer self-service orders (may be unset). */
  system: SystemClient | null;
  /** In-memory wizard state per chat. */
  flows: Map<string, Flow>;
  /** Last waiter-call timestamp per chat (throttling). */
  waiterCalls: Map<string, number>;
}

export function flowKey(chatId: number | string): string {
  return String(chatId);
}
