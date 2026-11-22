import type {
  ApiError,
  AuditLogDto,
  AuthTokens,
  AuthUser,
  CategoryDto,
  DashboardSummaryDto,
  DeliveryDto,
  EmployeeDto,
  ExpenseDto,
  NotificationDto,
  OrderDto,
  PaymentDto,
  PaymentMethodDto,
  ProductDto,
  ReportDto,
  RoomDto,
  RoomSessionSummaryDto,
  ServiceFeeConfigDto,
} from '@ikki-dost/shared-types';
import type {
  AddOrderItemsInput,
  AssignDeliveryInput,
  CancelOrderInput,
  CloseSessionInput,
  CreateCategoryInput,
  CreateEmployeeInput,
  CreateExpenseInput,
  CreateOrderInput,
  CreatePaymentInput,
  CreatePaymentMethodInput,
  CreateProductInput,
  CreateRoomInput,
  ItemStatusInput,
  LoginInput,
  ReversePaymentInput,
  UpdateCategoryInput,
  UpdateDeliveryStatusInput,
  UpdateEmployeeInput,
  UpdateOrderItemInput,
  UpdatePaymentMethodInput,
  UpdateProductInput,
  UpdateRoomInput,
  UpdateServiceFeeConfigInput,
} from '@ikki-dost/validation';

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
}

/**
 * Typed API client shared by admin-web, chef-web, cashier-desktop and mobile.
 * Thin wrapper over fetch with auth header injection and typed errors.
 */
export class ApiClient {
  constructor(private opts: ApiClientOptions) {}

  private async request<T>(method: string, path: string, body?: unknown, formData?: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.opts.getAccessToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });

    if (res.status === 401) this.opts.onUnauthorized?.();

    if (!res.ok) {
      let payload: ApiError | undefined;
      try {
        payload = (await res.json()) as ApiError;
      } catch {
        /* non-JSON error body */
      }
      const msg = Array.isArray(payload?.message) ? payload!.message.join(', ') : payload?.message;
      throw new ApiClientError(res.status, msg || res.statusText, payload?.details);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private get<T>(p: string) { return this.request<T>('GET', p); }
  private post<T>(p: string, b?: unknown) { return this.request<T>('POST', p, b); }
  private patch<T>(p: string, b?: unknown) { return this.request<T>('PATCH', p, b); }
  private del<T>(p: string) { return this.request<T>('DELETE', p); }

  // ===== Auth =====
  login(input: LoginInput) { return this.post<AuthTokens & { user: AuthUser }>('/auth/login', input); }
  refresh(refreshToken: string) { return this.post<AuthTokens>('/auth/refresh', { refreshToken }); }
  logout(refreshToken: string) { return this.post<void>('/auth/logout', { refreshToken }); }
  me() { return this.get<AuthUser>('/auth/me'); }

  // ===== Dashboard / reports (OWNER) =====
  dashboard() { return this.get<DashboardSummaryDto>('/reports/dashboard'); }
  report(from: string, to: string) { return this.get<ReportDto>(`/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); }
  auditLogs(limit = 100) { return this.get<AuditLogDto[]>(`/audit-logs?limit=${limit}`); }

  // ===== Employees (OWNER) =====
  employees() { return this.get<EmployeeDto[]>('/employees'); }
  createEmployee(input: CreateEmployeeInput) { return this.post<EmployeeDto>('/employees', input); }
  updateEmployee(id: string, input: UpdateEmployeeInput) { return this.patch<EmployeeDto>(`/employees/${id}`, input); }

  // ===== Rooms =====
  rooms() { return this.get<RoomDto[]>('/rooms'); }
  createRoom(input: CreateRoomInput) { return this.post<RoomDto>('/rooms', input); }
  updateRoom(id: string, input: UpdateRoomInput) { return this.patch<RoomDto>(`/rooms/${id}`, input); }
  roomSession(sessionId: string) { return this.get<RoomSessionSummaryDto & { orders: OrderDto[]; payments: PaymentDto[] }>(`/rooms/sessions/${sessionId}`); }
  closeRoomSession(sessionId: string, input: CloseSessionInput = {}) { return this.post<RoomSessionSummaryDto>(`/rooms/sessions/${sessionId}/close`, input); }

  // ===== Categories & products =====
  categories() { return this.get<CategoryDto[]>('/categories'); }
  createCategory(input: CreateCategoryInput) { return this.post<CategoryDto>('/categories', input); }
  updateCategory(id: string, input: UpdateCategoryInput) { return this.patch<CategoryDto>(`/categories/${id}`, input); }
  products(opts?: { includeArchived?: boolean; categoryId?: string }) {
    const q = new URLSearchParams();
    if (opts?.includeArchived) q.set('includeArchived', 'true');
    if (opts?.categoryId) q.set('categoryId', opts.categoryId);
    const qs = q.toString();
    return this.get<ProductDto[]>(`/products${qs ? `?${qs}` : ''}`);
  }
  createProduct(input: CreateProductInput) { return this.post<ProductDto>('/products', input); }
  updateProduct(id: string, input: UpdateProductInput) { return this.patch<ProductDto>(`/products/${id}`, input); }
  uploadProductImage(id: string, formData: FormData) { return this.request<ProductDto>('POST', `/products/${id}/image`, undefined, formData); }
  deleteProductImage(id: string) { return this.del<ProductDto>(`/products/${id}/image`); }

  // ===== Orders =====
  orders(opts?: { status?: string; type?: string; active?: boolean }) {
    const q = new URLSearchParams();
    if (opts?.status) q.set('status', opts.status);
    if (opts?.type) q.set('type', opts.type);
    if (opts?.active) q.set('active', 'true');
    const qs = q.toString();
    return this.get<OrderDto[]>(`/orders${qs ? `?${qs}` : ''}`);
  }
  kitchenOrders() { return this.get<OrderDto[]>('/orders/kitchen'); }
  order(id: string) { return this.get<OrderDto>(`/orders/${id}`); }
  createOrder(input: CreateOrderInput) { return this.post<OrderDto>('/orders', input); }
  addOrderItems(orderId: string, input: AddOrderItemsInput) { return this.post<OrderDto>(`/orders/${orderId}/items`, input); }
  updateOrderItem(orderId: string, itemId: string, input: UpdateOrderItemInput) { return this.patch<OrderDto>(`/orders/${orderId}/items/${itemId}`, input); }
  setItemStatus(orderId: string, itemId: string, input: ItemStatusInput) { return this.post<OrderDto>(`/orders/${orderId}/items/${itemId}/status`, input); }
  cancelOrder(orderId: string, input: CancelOrderInput) { return this.post<OrderDto>(`/orders/${orderId}/cancel`, input); }
  orderHistory(orderId: string) { return this.get<Array<{ id: string; fromStatus: string | null; toStatus: string; actorName: string; note: string | null; createdAt: string }>>(`/orders/${orderId}/history`); }

  // ===== Delivery =====
  deliveries(opts?: { status?: string }) {
    const qs = opts?.status ? `?status=${encodeURIComponent(opts.status)}` : '';
    return this.get<DeliveryDto[]>(`/deliveries${qs}`);
  }
  updateDeliveryStatus(id: string, input: UpdateDeliveryStatusInput) { return this.post<DeliveryDto>(`/deliveries/${id}/status`, input); }
  assignDelivery(id: string, input: AssignDeliveryInput) { return this.post<DeliveryDto>(`/deliveries/${id}/assign`, input); }
  /** Cashier/owner confirms the courier handed over the collected cash (“To‘lov qilindi”). */
  handoverDeliveryCash(id: string) { return this.post<DeliveryDto>(`/deliveries/${id}/handover`, {}); }

  // ===== Payments =====
  payments(opts?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (opts?.from) q.set('from', opts.from);
    if (opts?.to) q.set('to', opts.to);
    const qs = q.toString();
    return this.get<PaymentDto[]>(`/payments${qs ? `?${qs}` : ''}`);
  }
  paymentMethods() { return this.get<PaymentMethodDto[]>('/payments/methods'); }
  createPaymentMethod(input: CreatePaymentMethodInput) { return this.post<PaymentMethodDto>('/payments/methods', input); }
  updatePaymentMethod(id: string, input: UpdatePaymentMethodInput) { return this.patch<PaymentMethodDto>(`/payments/methods/${id}`, input); }
  payOrder(orderId: string, input: CreatePaymentInput) { return this.post<PaymentDto>(`/payments/order/${orderId}`, input); }
  payRoomSession(sessionId: string, input: CreatePaymentInput) { return this.post<PaymentDto>(`/payments/session/${sessionId}`, input); }
  reversePayment(paymentId: string, input: ReversePaymentInput) { return this.post<PaymentDto>(`/payments/${paymentId}/reverse`, input); }

  // ===== Expenses =====
  expenses(opts?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (opts?.from) q.set('from', opts.from);
    if (opts?.to) q.set('to', opts.to);
    const qs = q.toString();
    return this.get<ExpenseDto[]>(`/expenses${qs ? `?${qs}` : ''}`);
  }
  createExpense(input: CreateExpenseInput) { return this.post<ExpenseDto>('/expenses', input); }
  deleteExpense(id: string) { return this.del<void>(`/expenses/${id}`); }

  // ===== Settings =====
  serviceFeeConfig() { return this.get<ServiceFeeConfigDto>('/settings/service-fee'); }
  updateServiceFeeConfig(input: UpdateServiceFeeConfigInput) { return this.patch<ServiceFeeConfigDto>('/settings/service-fee', input); }

  // ===== Notifications =====
  notifications() { return this.get<NotificationDto[]>('/notifications'); }
  markNotificationRead(id: string) { return this.post<void>(`/notifications/${id}/read`); }
  markAllNotificationsRead() { return this.post<void>('/notifications/read-all'); }
  savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.post<void>('/notifications/push-subscription', subscription);
  }
  deletePushSubscription(endpoint: string) {
    return this.request<void>('DELETE', '/notifications/push-subscription', { endpoint });
  }
}
