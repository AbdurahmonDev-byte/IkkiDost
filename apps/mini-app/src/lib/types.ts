export type MeasurementUnit = 'PIECE' | 'KG' | 'LITER' | 'PORTION' | 'OTHER';
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
export type Role = 'OWNER' | 'WAITER' | 'CHEF' | 'CASHIER' | 'DELIVERY';
export type DeliveryStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  unit: MeasurementUnit;
  price: number;
  costPrice: number;
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  imageUrl: string | null;
  thumbnailUrl: string | null;
}

export interface Room {
  id: string;
  name: string;
  isActive: boolean;
  isOccupied: boolean;
  activeSession?: {
    id: string;
    orderCount: number;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  } | null;
}

export interface ServiceFeeConfig {
  enabled: boolean;
  amountPerPerson: number;
  applyToDineIn: boolean;
  applyToDelivery: boolean;
  method: 'PER_PERSON';
}

export interface PublicConfig {
  botUsername: string;
  botUrl: string;
  registrationUrl: string;
  remoteOrdering: boolean;
  dineInOrdering: boolean;
}

export interface Customer {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string;
  lastName: string;
  /** Official name — replaces the Telegram display name in the UI. */
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  /** Saved default address (text and/or Google Maps link). */
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  note?: string;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string | null;
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
  orderNumber: number;
  orderStatus: OrderStatus;
  itemsTotal: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  note: string | null;
  items: OrderItemDto[];
  cashCollectedAmount: number | null;
  cashCollectedAt: string | null;
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
  roomSessionId: string | null;
  roomName: string | null;
  numberOfPeople: number;
  note: string | null;
  items: OrderItemDto[];
  delivery: DeliveryDto | null;
  itemsTotal: number;
  serviceFeeAmount: number;
  serviceFeePerPerson: number;
  serviceFeeMethod: 'PER_PERSON' | 'NONE';
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  kind: 'CASH' | 'CARD' | 'OTHER';
  isActive: boolean;
}

export interface PaymentDto {
  id: string;
  orderId: string | null;
  roomSessionId: string | null;
  amount: number;
  methodId: string;
  methodName: string;
  methodKind: PaymentMethod['kind'];
  note: string | null;
  receivedByName: string;
  reversedAt: string | null;
  createdAt: string;
}

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive?: boolean;
  accessToken: string;
  refreshToken?: string;
}
