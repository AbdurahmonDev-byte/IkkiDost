import type { BotConfig } from './config.js';
import type { Refs, Store } from './store.js';
import type { Bot, Context } from 'grammy';

export type ChatContext = Context & { chat: NonNullable<Context['chat']> };
export type AppBot = Bot<ChatContext>;

export interface OrderFlow {
  mode: 'DINE_IN' | 'DELIVERY';
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
  /** True while the wizard waits for a typed exact quantity (e.g. 1.82 kg). */
  awaitingQty?: boolean;
}

export type Flow =
  | { kind: 'delivery-cash'; deliveryId: string; orderNumber: number; outstanding: number }
  | { kind: 'delivery-name' }
  | { kind: 'delivery-phone'; name: string }
  | { kind: 'delivery-address'; name: string; phone: string }
  | { kind: 'order'; data: OrderFlow }
  | { kind: 'close-reason'; sessionId: string }
  | {
      kind: 'pay-amount';
      target: 'session' | 'order';
      targetId: string;
      methodId: string;
      methodName: string;
      outstanding: number;
    };

export interface Deps {
  config: BotConfig;
  store: Store;
  refs: Refs;
  /** In-memory wizard state per chat. */
  flows: Map<string, Flow>;
}

export function flowKey(chatId: number | string): string {
  return String(chatId);
}
