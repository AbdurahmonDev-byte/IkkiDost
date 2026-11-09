import type {
  Category,
  OrderDto,
  Product,
  Room,
  ServiceFeeConfig,
  StaffUser,
} from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      if (Array.isArray(data.message)) msg = data.message.join(', ');
      else if (data.message) msg = data.message;
    } catch {
      // non-json
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Public / Customer
  getMenu: () =>
    request<{ categories: Category[]; products: Product[]; serviceFee: ServiceFeeConfig | null }>(
      '/public/menu',
    ),

  getRooms: () => request<Room[]>('/public/rooms'),

  createOrder: (input: {
    type: 'DINE_IN' | 'DELIVERY';
    roomId?: string;
    numberOfPeople: number;
    items: Array<{ productId: string; quantity: string; note?: string | null }>;
    note?: string | null;
    customerName?: string;
    customerPhone?: string;
    address?: string;
  }) => request<OrderDto>('/public/orders', { method: 'POST', body: JSON.stringify(input) }),

  callWaiter: (roomId: string, note?: string) =>
    request<{ success: boolean; message: string }>('/public/call-waiter', {
      method: 'POST',
      body: JSON.stringify({ roomId, note }),
    }),

  getOrder: (id: string) => request<OrderDto>(`/public/orders/${id}`),

  // Staff auth & operations
  login: (username: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: StaffUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getKitchenOrders: (token: string) =>
    request<OrderDto[]>('/orders/kitchen', { method: 'GET' }, token),

  setItemStatus: (
    token: string,
    orderId: string,
    itemId: string,
    status: 'PREPARING' | 'READY' | 'SERVED',
  ) =>
    request<OrderDto>(
      `/orders/${orderId}/items/${itemId}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
      token,
    ),

  getDashboard: (token: string) =>
    request<{
      todayRevenue: number;
      todayOrderCount: number;
      activeRooms: number;
      activeDineInOrders: number;
      activeDeliveryOrders: number;
      paidToday: number;
      unpaidOutstanding: number;
      popularProducts: Array<{ productName: string; quantity: string; revenue: number }>;
    }>('/reports/dashboard', { method: 'GET' }, token),
};
