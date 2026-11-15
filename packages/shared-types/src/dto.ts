import type {
  DeliveryStatus,
  MeasurementUnit,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentKind,
  ProductStatus,
  Role,
  RoomSessionStatus,
  ServiceFeeMethod,
} from './enums.js';

/** All money is integer UZS. */
export type Uzs = number;

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface EmployeeDto extends AuthUser {
  phone: string | null;
  canCreateDelivery: boolean;
  telegramId: string | null;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Registered remote-order customer (Telegram identity + verified phone). */
export interface CustomerDto {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string;
  lastName: string;
  /** Official name — replaces the Telegram display name in the UI. */
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  /** Default delivery address (text and/or map link) saved from the bot/Mini App. */
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomDto {
  id: string;
  name: string;
  isActive: boolean;
  activeSession: RoomSessionSummaryDto | null;
  createdAt: string;
}

export interface RoomSessionSummaryDto {
  id: string;
  status: RoomSessionStatus;
  openedAt: string;
  orderCount: number;
  totalAmount: Uzs;
  paidAmount: Uzs;
  outstandingAmount: Uzs;
}

export interface CategoryDto {
  id: string;
  name: string;
  sortOrder: number;
  productCount?: number;
}

export interface ProductDto {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  unit: MeasurementUnit;
  /** Integer UZS per unit. */
  price: Uzs;
  /** Purchase cost in integer UZS per unit. */
  costPrice: Uzs;
  status: ProductStatus;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string | null;
  /** Historical snapshots. */
  productName: string;
  productUnit: MeasurementUnit;
  unitPrice: Uzs;
  /** Decimal string to preserve e.g. "0.750" kg. */
  quantity: string;
  lineTotal: Uzs;
  status: OrderItemStatus;
  note: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryDto {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: DeliveryStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  /** Flattened order summary for delivery screens. */
  orderNumber: number;
  orderStatus: OrderStatus;
  itemsTotal: Uzs;
  totalAmount: Uzs;
  paidAmount: Uzs;
  outstandingAmount: Uzs;
  note: string | null;
  items: OrderItemDto[];
  /** Cash the courier collected; null until the courier records it. */
  cashCollectedAmount: Uzs | null;
  cashCollectedAt: string | null;
  /** Set when a cashier/owner confirms the cash handover. */
  cashHandedOverAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  type: OrderType;
  status: OrderStatus;
  roomId: string | null;
  roomName: string | null;
  roomSessionId: string | null;
  numberOfPeople: number;
  note: string | null;
  items: OrderItemDto[];
  delivery: DeliveryDto | null;
  itemsTotal: Uzs;
  /** Snapshotted service fee values. */
  serviceFeeAmount: Uzs;
  serviceFeePerPerson: Uzs;
  serviceFeeMethod: ServiceFeeMethod;
  totalAmount: Uzs;
  paidAmount: Uzs;
  outstandingAmount: Uzs;
  createdById: string;
  createdByName: string;
  /** Registered customer for remote orders (null for staff-created orders). */
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodDto {
  id: string;
  name: string;
  kind: PaymentKind;
  isActive: boolean;
}

export interface PaymentDto {
  id: string;
  orderId: string | null;
  roomSessionId: string | null;
  amount: Uzs;
  methodId: string;
  methodName: string;
  methodKind: PaymentKind;
  note: string | null;
  receivedById: string;
  receivedByName: string;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
}

export interface ExpenseDto {
  id: string;
  title: string;
  amount: Uzs;
  category: string | null;
  note: string | null;
  spentAt: string;
  createdByName: string;
  createdAt: string;
}

export interface ServiceFeeConfigDto {
  enabled: boolean;
  amountPerPerson: Uzs;
  applyToDineIn: boolean;
  applyToDelivery: boolean;
  method: ServiceFeeMethod;
  updatedAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardSummaryDto {
  todayRevenue: Uzs;
  todayOrderCount: number;
  activeRooms: number;
  activeDineInOrders: number;
  activeDeliveryOrders: number;
  paidToday: Uzs;
  todayCostOfGoods: Uzs;
  todayProfit: Uzs;
  unpaidOutstanding: Uzs;
  serviceFeeRevenueToday: Uzs;
  todayExpenses: Uzs;
  popularProducts: Array<{ productName: string; quantity: string; revenue: Uzs; profit?: Uzs }>;
  recentActivity: AuditLogDto[];
  revenueByDay: Array<{ date: string; revenue: Uzs; expenses: Uzs; costOfGoods: Uzs; profit: Uzs }>;
  /** Bugungi soatlik savdo (00–23). Faqat to'lov bo'lgan soatlar qaytariladi. */
  hourlySales: Array<{ hour: number; revenue: Uzs; orderCount: number }>;
  /** Bugungi to'lov usullari kesimi */
  paymentsByMethod: Array<{ methodName: string; kind: PaymentKind; amount: Uzs; count: number }>;
}


export interface ReportDto {
  from: string;
  to: string;
  revenue: Uzs;
  expenses: Uzs;
  costOfGoods: Uzs;
  profit: Uzs;
  serviceFeeTotal: Uzs;
  orderCount: number;
  dineInRevenue: Uzs;
  deliveryRevenue: Uzs;
  paymentsByMethod: Array<{ methodName: string; kind: PaymentKind; amount: Uzs; count: number }>;
  topProducts: Array<{ productName: string; quantity: string; revenue: Uzs }>;
  employeePerformance: Array<{ employeeName: string; role: Role; ordersCreated: number; revenueHandled: Uzs }>;
}
