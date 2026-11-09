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
  ProductDto,
  RoomDto,
  RoomSessionDetailDto,
  ServiceFeeConfigDto,
} from './types.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when both the access token and its refresh are dead. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sessiya muddati tugagan. Qayta /login qiling.');
    this.name = 'SessionExpiredError';
  }
}

async function rawRequest<T>(
  config: BotConfig,
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      const msg = payload?.message;
      if (Array.isArray(msg)) message = msg.join(', ');
      else if (typeof msg === 'string') message = msg;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(
  config: BotConfig,
  username: string,
  password: string,
): Promise<AuthTokens & { user: AuthUser }> {
  return rawRequest(config, 'POST', '/auth/login', { username, password });
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

/**
 * Dedicated staff account (e.g. `bot`) used to place orders on behalf of
 * unauthenticated Telegram customers. Keeps backend RBAC and audit intact —
 * every customer order is createdBy "Telegram Bot" and carries the customer's
 * identity in the note / customer fields.
 */
export class SystemClient {
  private tokens: AuthTokens | null = null;
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private config: BotConfig,
    private username: string,
    private password: string,
  ) {}

  get ready(): boolean {
    return this.tokens !== null;
  }

  async ensure(): Promise<boolean> {
    if (this.tokens) return true;
    try {
      const result = await login(this.config, this.username, this.password);
      this.tokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
      return true;
    } catch {
      this.tokens = null;
      return false;
    }
  }

  private async refresh(): Promise<boolean> {
    if (!this.tokens) return this.ensure();
    if (this.refreshing) return this.refreshing;
    const current = this.tokens;
    this.refreshing = (async () => {
      try {
        const tokens = await rawRequest<AuthTokens>(this.config, 'POST', '/auth/refresh', {
          refreshToken: current.refreshToken,
        });
        this.tokens = tokens;
        return true;
      } catch {
        this.tokens = null;
        return this.ensure();
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!(await this.ensure())) throw new ApiError(503, 'Bot xodim hisobi sozlanmagan (BOT_USERNAME/BOT_PASSWORD)');
    try {
      return await rawRequest<T>(this.config, method, path, body, this.tokens!.accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401 && (await this.refresh())) {
        return rawRequest<T>(this.config, method, path, body, this.tokens!.accessToken);
      }
      throw error;
    }
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }
}

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
      customerName: string;
      customerPhone: string;
      address: string;
      note?: string | null;
    },
  ) => post<OrderDto>(c, s, id, '/orders', { type: 'DELIVERY', ...input }),

  setItemStatus: (c: BotConfig, s: Store, id: number | string, orderId: string, itemId: string, status: 'PREPARING' | 'READY' | 'SERVED') =>
    post<OrderDto>(c, s, id, `/orders/${orderId}/items/${itemId}/status`, { status }),

  cancelOrder: (c: BotConfig, s: Store, id: number | string, orderId: string, reason: string) =>
    post<OrderDto>(c, s, id, `/orders/${orderId}/cancel`, { reason }),

  kitchenOrders: (c: BotConfig, s: Store, id: number | string) => get<OrderDto[]>(c, s, id, '/orders/kitchen'),

  deliveries: (c: BotConfig, s: Store, id: number | string) => get<DeliveryDto[]>(c, s, id, '/deliveries'),
  updateDeliveryStatus: (c: BotConfig, s: Store, id: number | string, deliveryId: string, status: DeliveryStatus) =>
    post<DeliveryDto>(c, s, id, `/deliveries/${deliveryId}/status`, { status }),
  order: (c: BotConfig, s: Store, id: number | string, orderId: string) => get<OrderDto>(c, s, id, `/orders/${orderId}`),

  dashboard: (c: BotConfig, s: Store, id: number | string) => get<DashboardSummaryDto>(c, s, id, '/reports/dashboard'),

  notifications: (c: BotConfig, s: Store, id: number | string) => get<NotificationDto[]>(c, s, id, '/notifications'),

  publicRooms: (c: BotConfig) => rawRequest<Array<{ id: string; name: string }>>(c, 'GET', '/public/rooms'),
  callWaiter: (c: BotConfig, roomId: string, note?: string) =>
    rawRequest<{ success: boolean; message: string }>(c, 'POST', '/public/call-waiter', { roomId, note }),
};
