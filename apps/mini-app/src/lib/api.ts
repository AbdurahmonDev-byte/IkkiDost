import { tg } from './telegram';
import type {
  Category,
  DeliveryDto,
  DeliveryStatus,
  OrderDto,
  PaymentDto,
  PaymentMethod,
  Product,
  PublicConfig,
  Role,
  Room,
  ServiceFeeConfig,
  StaffUser,
} from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the Telegram account is known but not linked to a staff user yet. */
  get needsLink(): boolean {
    return this.code === 'TELEGRAM_NOT_LINKED' || this.code === 'TELEGRAM_INITDATA_MISSING';
  }
}

function initData(): string {
  return tg.app?.initData ?? '';
}

function telegramHeaders(): Record<string, string> {
  const data = initData();
  return data ? { 'X-Telegram-Init-Data': data } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...telegramHeaders(),
    ...extraHeaders,
  };
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (!res.ok) {
    let msg = res.statusText;
    let code: string | undefined;
    try {
      const data = await res.json();
      if (Array.isArray(data.message)) msg = data.message.join(', ');
      else if (data.message) msg = data.message;
      code = data?.details?.code;
    } catch {
      // non-json body
    }
    throw new ApiError(res.status, msg, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<StaffUser, 'accessToken' | 'refreshToken'>;
}

export const api = {
  // ===== Public / customer =====
  getConfig: () => request<PublicConfig>('/public/config'),

  getMenu: () =>
    request<{ categories: Category[]; products: Product[]; serviceFee: ServiceFeeConfig | null }>(
      '/public/menu',
    ),

  getRooms: () => request<Room[]>('/public/rooms'),

  getStaffRooms: (token: string) => request<Room[]>('/rooms', { method: 'GET' }, token),

  createRoom: (token: string, name: string) =>
    request<Room>('/rooms', { method: 'POST', body: JSON.stringify({ name }) }, token),

  updateRoom: (token: string, id: string, input: { name?: string; isActive?: boolean }) =>
    request<Room>(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, token),

  // ===== Staff auth =====
  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  /** Passwordless Telegram login for all staff roles, including the owner. */
  telegramLogin: () =>
    request<AuthResponse>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData: initData() }),
    }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: (token: string) => request<StaffUser>('/auth/me', { method: 'GET' }, token),

  getEmployees: (token: string) =>
    request<Array<{ id: string; username: string; fullName: string; role: Role; telegramId: string | null; isActive: boolean }>>(
      '/employees',
      { method: 'GET' },
      token,
    ),

  createEmployee: (
    token: string,
    input: { username: string; password: string; fullName: string; phone: string | null; role: Role; telegramId: string },
  ) =>
    request<{ id: string; username: string; fullName: string; role: Role; telegramId: string | null; isActive: boolean }>(
      '/employees',
      { method: 'POST', body: JSON.stringify(input) },
      token,
    ),

  updateEmployeeTelegramId: (token: string, id: string, telegramId: string) =>
    request<{ id: string; telegramId: string | null }>(
      `/employees/${id}`,
      { method: 'PATCH', body: JSON.stringify({ telegramId }) },
      token,
    ),

  updateEmployee: (
    token: string,
    id: string,
    input: { role?: Role; isActive?: boolean; fullName?: string; phone?: string | null },
  ) =>
    request<{
      id: string;
      username: string;
      fullName: string;
      role: Role;
      telegramId: string | null;
      isActive: boolean;
    }>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, token),

  // ===== Staff operations =====
  getKitchenOrders: (token: string) =>
    request<OrderDto[]>('/orders/kitchen', { method: 'GET' }, token),

  getOrders: (token: string, params: { status?: string; type?: string; active?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.type) qs.set('type', params.type);
    if (params.active) qs.set('active', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<OrderDto[]>(`/orders${suffix}`, { method: 'GET' }, token);
  },

  getStaffOrder: (token: string, id: string) => request<OrderDto>(`/orders/${id}`, { method: 'GET' }, token),

  getPaymentMethods: (token: string) => request<PaymentMethod[]>('/payments/methods', { method: 'GET' }, token),

  getPayments: (token: string, from: string, to: string) => {
    const qs = new URLSearchParams({ from, to });
    return request<PaymentDto[]>(`/payments?${qs}`, { method: 'GET' }, token);
  },

  payOrder: (token: string, orderId: string, input: { amount: number; methodId: string; idempotencyKey: string }) =>
    request<PaymentDto>(`/payments/order/${orderId}`, { method: 'POST', body: JSON.stringify(input) }, token),

  payRoomSession: (token: string, sessionId: string, input: { amount: number; methodId: string; idempotencyKey: string }) =>
    request<PaymentDto>(`/payments/session/${sessionId}`, { method: 'POST', body: JSON.stringify(input) }, token),

  createStaffOrder: (
    token: string,
    input:
      | {
          type: 'DINE_IN';
          roomId: string;
          numberOfPeople: number;
          items: Array<{ productId: string; quantity: string; note?: string | null }>;
          note?: string | null;
        }
      | {
          type: 'DELIVERY';
          numberOfPeople: number;
          items: Array<{ productId: string; quantity: string; note?: string | null }>;
          note?: string | null;
          customerName: string;
          customerPhone: string;
          address: string;
        },
  ) => request<OrderDto>('/orders', { method: 'POST', body: JSON.stringify(input) }, token),

  setItemStatus: (
    token: string,
    orderId: string,
    itemId: string,
    status: 'PREPARING' | 'READY' | 'SERVED',
  ) =>
    request<OrderDto>(
      `/orders/${orderId}/items/${itemId}/status`,
      { method: 'POST', body: JSON.stringify({ status }) },
      token,
    ),

  getDeliveries: (token: string) => request<DeliveryDto[]>('/deliveries', { method: 'GET' }, token),

  claimDelivery: (token: string, id: string) =>
    request<DeliveryDto>(`/deliveries/${id}/claim`, { method: 'POST' }, token),

  updateDeliveryStatus: (token: string, id: string, status: DeliveryStatus, cashCollectedAmount?: number) =>
    request<DeliveryDto>(
      `/deliveries/${id}/status`,
      {
        method: 'POST',
        body: JSON.stringify({
          status,
          ...(cashCollectedAmount === undefined ? {} : { cashCollectedAmount }),
        }),
      },
      token,
    ),

  handoverDeliveryCash: (token: string, id: string) =>
    request<DeliveryDto>(`/deliveries/${id}/handover`, { method: 'POST', body: JSON.stringify({}) }, token),

  getDashboard: (token: string) =>
    request<{
      todayRevenue: number;
      todayOrderCount: number;
      activeRooms: number;
      activeDineInOrders: number;
      activeDeliveryOrders: number;
      paidToday: number;
      todayCostOfGoods: number;
      todayProfit: number;
      todayExpenses: number;
      serviceFeeRevenueToday: number;
      unpaidOutstanding: number;
      popularProducts: Array<{ productName: string; quantity: string; revenue: number; profit?: number }>;
      revenueByDay: Array<{
        date: string;
        revenue: number;
        expenses: number;
        costOfGoods: number;
        profit: number;
      }>;
      hourlySales: Array<{ hour: number; revenue: number; orderCount: number }>;
      paymentsByMethod: Array<{ methodName: string; kind: string; amount: number; count: number }>;
    }>('/reports/dashboard', { method: 'GET' }, token),

  // ===== Owner: menu management =====
  getCategories: (token: string) => request<Category[]>('/categories', { method: 'GET' }, token),

  getProducts: (token: string, includeArchived = true) =>
    request<Product[]>(
      `/products${includeArchived ? '?includeArchived=true' : ''}`,
      { method: 'GET' },
      token,
    ),

  createProduct: (
    token: string,
    input: { name: string; categoryId: string; unit: string; price: number; costPrice?: number },
  ) => request<Product>('/products', { method: 'POST', body: JSON.stringify(input) }, token),

  updateProduct: (
    token: string,
    id: string,
    input: Partial<{ name: string; categoryId: string; unit: string; price: number; costPrice: number; status: string }>,
  ) =>
    request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, token),

  uploadProductImage: (token: string, id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return request<Product>(`/products/${id}/image`, { method: 'POST', body: form }, token);
  },

  removeProductImage: (token: string, id: string) =>
    request<Product>(`/products/${id}/image`, { method: 'DELETE' }, token),

  createCategory: (token: string, input: { name: string; sortOrder?: number }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(input) }, token),

  // ===== Owner: maintenance =====
  /** Deletes all sales history (orders, payments, deliveries, sessions) — owner only. */
  clearSalesHistory: (token: string) =>
    request<{ status: 'ok'; deleted: Record<string, number> }>(
      '/maintenance/clear-sales-history',
      { method: 'POST' },
      token,
    ),
};
