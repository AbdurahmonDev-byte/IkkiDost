/**
 * DTO mirrors of packages/shared-types. The bot intentionally does NOT import
 * the workspace packages at runtime (they ship TypeScript sources), so it
 * keeps its own type copies. Keep these in sync with packages/shared-types.
 */

export type Role = 'OWNER' | 'WAITER' | 'CHEF' | 'CASHIER';
export type OrderType = 'DINE_IN' | 'DELIVERY';
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'PARTIALLY_READY'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED';
export type OrderItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type DeliveryStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';
export type MeasurementUnit = 'PIECE' | 'KG' | 'LITER' | 'PORTION' | 'OTHER';
export type PaymentKind = 'CASH' | 'CARD' | 'OTHER';
export type RoomSessionStatus = 'OPEN' | 'CLOSED';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RoomSessionSummaryDto {
  id: string;
  status: RoomSessionStatus;
  openedAt: string;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

export interface RoomDto {
  id: string;
  name: string;
  isActive: boolean;
  activeSession: RoomSessionSummaryDto | null;
  createdAt: string;
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
  unit: MeasurementUnit;
  price: number;
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productName: string;
  productUnit: MeasurementUnit;
  unitPrice: number;
  quantity: string;
  lineTotal: number;
  status: OrderItemStatus;
  note: string | null;
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
  itemsTotal: number;
  serviceFeeAmount: number;
  serviceFeePerPerson: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDto {
  id: string;
  amount: number;
  methodName: string;
  methodKind: PaymentKind;
  receivedByName: string;
  reversedAt: string | null;
  createdAt: string;
}

export interface RoomSessionDetailDto extends RoomSessionSummaryDto {
  orders: OrderDto[];
  payments: PaymentDto[];
}

export interface ServiceFeeConfigDto {
  enabled: boolean;
  amountPerPerson: number;
  applyToDineIn: boolean;
  applyToDelivery: boolean;
  method: 'PER_PERSON';
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

export interface DashboardSummaryDto {
  todayRevenue: number;
  todayOrderCount: number;
  activeRooms: number;
  activeDineInOrders: number;
  activeDeliveryOrders: number;
  paidToday: number;
  unpaidOutstanding: number;
  serviceFeeRevenueToday: number;
  todayExpenses: number;
  popularProducts: Array<{ productName: string; quantity: string; revenue: number }>;
}
