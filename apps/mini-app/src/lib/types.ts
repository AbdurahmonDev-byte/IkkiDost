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
export type Role = 'OWNER' | 'WAITER' | 'CHEF' | 'CASHIER';

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  unit: MeasurementUnit;
  price: number;
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  imageUrl: string | null;
  thumbnailUrl: string | null;
}

export interface Room {
  id: string;
  name: string;
  isActive: boolean;
  isOccupied: boolean;
}

export interface ServiceFeeConfig {
  enabled: boolean;
  amountPerPerson: number;
  applyToDineIn: boolean;
  applyToDelivery: boolean;
  method: 'PER_PERSON';
}

export interface CartItem {
  product: Product;
  quantity: number;
  note?: string; // "haligini mini appni yozadigan joyiga yozadi u povarga boradi"
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productUnit: MeasurementUnit;
  unitPrice: number;
  quantity: string;
  lineTotal: number;
  status: OrderItemStatus;
  note: string | null;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  type: OrderType;
  status: OrderStatus;
  roomId: string | null;
  roomName: string | null;
  numberOfPeople: number;
  note: string | null;
  items: OrderItemDto[];
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
}

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  accessToken: string;
}
