import type { BotConfig } from './config.js';
import type { Store, Session } from './store.js';
import type {
  AuthTokens,
  AuthUser,
  CategoryDto,
  DashboardSummaryDto,
  DeliveryDto,
  DeliveryStatus,
  NotificationDto,
  OrderDto,
  PaymentDto,
  PaymentMethodDto,
  ProductDto,
  RoomDto,
  RoomSessionDetailDto,
  ServiceFeeConfigDto,
} from './types.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when both the access token and its refresh are dead. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sessiya muddati tugagan. Telegram ID ni qayta tekshirish uchun /start bosing.');
    this.name = 'SessionExpiredError';
  }
}

async function rawRequest<T>(
  config: BotConfig,
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const payload = (await res.json()) as { message?: string | string[]; details?: { code?: string } };
      const msg = payload?.message;
      if (Array.isArray(msg)) message = msg.join(', ');
      else if (typeof msg === 'string') message = msg;
      code = payload?.details?.code;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Bot-authenticated call — the shared bot token acts as the secret. */
async function botRequest<T>(config: BotConfig, method: string, path: string, body?: unknown): Promise<T> {
  return rawRequest<T>(config, method, path, body, undefined, { 'x-bot-secret': config.token });
}

/** Staff login by the Telegram ID assigned to the employee by the owner. */
export async function telegramBotLogin(
  config: BotConfig,
  telegramId: string,
): Promise<AuthTokens & { user: AuthUser }> {
  return botRequest(config, 'POST', '/auth/telegram/bot', { telegramId });
}

export async function logout(config: BotConfig, session: Session): Promise<void> {
  try {
    await rawRequest(config, 'POST', '/auth/logout', { refreshToken: session.refreshToken });
  } catch {
    // best effort
  }
}

async function refreshTokens(config: BotConfig, store: Store, chatId: number | string, session: Session): Promise<boolean> {
  try {
    const tokens = await rawRequest<AuthTokens>(config, 'POST', '/auth/refresh', {
      refreshToken: session.refreshToken,
    });
    store.patch(chatId, tokens);
    return true;
  } catch {
    store.remove(chatId);
    return false;
  }
}

/** Authenticated call on behalf of a linked user, with transparent refresh. */
export async function call<T>(
  config: BotConfig,
  store: Store,
  chatId: number | string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const session = store.get(chatId);
  if (!session) throw new SessionExpiredError();
  try {
    return await rawRequest<T>(config, method, path, body, session.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      const ok = await refreshTokens(config, store, chatId, session);
      if (!ok) throw new SessionExpiredError();
      const fresh = store.get(chatId);
      if (!fresh) throw new SessionExpiredError();
      return rawRequest<T>(config, method, path, body, fresh.accessToken);
    }
    throw error;
  }
}

const get = <T>(c: BotConfig, s: Store, id: number | string, p: string) => call<T>(c, s, id, 'GET', p);
const post = <T>(c: BotConfig, s: Store, id: number | string, p: string, b?: unknown) => call<T>(c, s, id, 'POST', p, b);

// ===== Typed wrappers used by the flows =====

export interface OrderItemInput {
  productId: string;
  quantity: string;
  note?: string | null;
}

export const api = {
  rooms: (c: BotConfig, s: Store, id: number | string) => get<RoomDto[]>(c, s, id, '/rooms'),
  roomSession: (c: BotConfig, s: Store, id: number | string, sessionId: string) =>
    get<RoomSessionDetailDto>(c, s, id, `/rooms/sessions/${sessionId}`),
  closeRoomSession: (c: BotConfig, s: Store, id: number | string, sessionId: string, overrideReason?: string) =>
    post<RoomSessionDetailDto>(c, s, id, `/rooms/sessions/${sessionId}/close`, overrideReason ? { overrideReason } : {}),

  categories: (c: BotConfig, s: Store, id: number | string) => get<CategoryDto[]>(c, s, id, '/categories'),
  products: (c: BotConfig, s: Store, id: number | string) => get<ProductDto[]>(c, s, id, '/products'),
  serviceFeeConfig: (c: BotConfig, s: Store, id: number | string) =>
    get<ServiceFeeConfigDto>(c, s, id, '/settings/service-fee'),

  createDineInOrder: (
    c: BotConfig,
    s: Store,
    id: number | string,
    input: { roomId: string; numberOfPeople: number; items: OrderItemInput[]; note?: string | null },
  ) => post<OrderDto>(c, s, id, '/orders', { type: 'DINE_IN', ...input }),

  createDeliveryOrder: (
    c: BotConfig,
    s: Store,
    id: number | string,
    input: {
      numberOfPeople: number;
      items: OrderItemInput[];
      customerName?: string;
      customerPhone?: string;
      address?: string;
      note?: string | null;
    },
  ) => post<OrderDto>(c, s, id, '/orders', { type: 'DELIVERY', ...input }),

  addOrderItems: (c: BotConfig, s: Store, id: number | string, orderId: string, items: OrderItemInput[]) =>
    post<OrderDto>(c, s, id, `/orders/${orderId}/items`, { items }),

  setItemStatus: (c: BotConfig, s: Store, id: number | string, orderId: string, itemId: string, status: 'PREPARING' | 'READY' | 'SERVED') =>
    post<OrderDto>(c, s, id, `/orders/${orderId}/items/${itemId}/status`, { status }),

  cancelOrder: (c: BotConfig, s: Store, id: number | string, orderId: string, reason: string) =>
    post<OrderDto>(c, s, id, `/orders/${orderId}/cancel`, { reason }),

  kitchenOrders: (c: BotConfig, s: Store, id: number | string) => get<OrderDto[]>(c, s, id, '/orders/kitchen'),

  deliveries: (c: BotConfig, s: Store, id: number | string) => get<DeliveryDto[]>(c, s, id, '/deliveries'),
  claimDelivery: (c: BotConfig, s: Store, id: number | string, deliveryId: string) =>
    post<DeliveryDto>(c, s, id, `/deliveries/${deliveryId}/claim`),
  updateDeliveryStatus: (
    c: BotConfig,
    s: Store,
    id: number | string,
    deliveryId: string,
    status: DeliveryStatus,
    cashCollectedAmount?: number,
  ) =>
    post<DeliveryDto>(c, s, id, `/deliveries/${deliveryId}/status`, {
      status,
      ...(cashCollectedAmount === undefined ? {} : { cashCollectedAmount }),
    }),
  handoverDeliveryCash: (c: BotConfig, s: Store, id: number | string, deliveryId: string) =>
    post<DeliveryDto>(c, s, id, `/deliveries/${deliveryId}/handover`, {}),
  order: (c: BotConfig, s: Store, id: number | string, orderId: string) => get<OrderDto>(c, s, id, `/orders/${orderId}`),

  paymentMethods: (c: BotConfig, s: Store, id: number | string) =>
    get<PaymentMethodDto[]>(c, s, id, '/payments/methods'),
  pay: (
    c: BotConfig,
    s: Store,
    id: number | string,
    target: 'session' | 'order',
    targetId: string,
    input: { amount: number; methodId: string; idempotencyKey: string; note?: string | null },
  ) => post<PaymentDto>(c, s, id, `/payments/${target}/${targetId}`, input),

  payments: (c: BotConfig, s: Store, id: number | string, from: string) =>
    get<PaymentDto[]>(c, s, id, `/payments?from=${encodeURIComponent(from)}`),

  dashboard: (c: BotConfig, s: Store, id: number | string) => get<DashboardSummaryDto>(c, s, id, '/reports/dashboard'),

  notifications: (c: BotConfig, s: Store, id: number | string) => get<NotificationDto[]>(c, s, id, '/notifications'),
};
