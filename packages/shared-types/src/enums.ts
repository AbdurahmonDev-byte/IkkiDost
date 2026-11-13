/** Shared enums — must stay in sync with prisma/schema.prisma (apps/api). */

export const Role = {
  OWNER: 'OWNER',
  WAITER: 'WAITER',
  CHEF: 'CHEF',
  CASHIER: 'CASHIER',
  DELIVERY: 'DELIVERY',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const OrderType = {
  DINE_IN: 'DINE_IN',
  DELIVERY: 'DELIVERY',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  PARTIALLY_READY: 'PARTIALLY_READY',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderItemStatus = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderItemStatus = (typeof OrderItemStatus)[keyof typeof OrderItemStatus];

export const DeliveryStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const MeasurementUnit = {
  PIECE: 'PIECE',
  KG: 'KG',
  LITER: 'LITER',
  PORTION: 'PORTION',
  OTHER: 'OTHER',
} as const;
export type MeasurementUnit = (typeof MeasurementUnit)[keyof typeof MeasurementUnit];

export const PaymentKind = {
  CASH: 'CASH',
  CARD: 'CARD',
  OTHER: 'OTHER',
} as const;
export type PaymentKind = (typeof PaymentKind)[keyof typeof PaymentKind];

export const RoomSessionStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type RoomSessionStatus = (typeof RoomSessionStatus)[keyof typeof RoomSessionStatus];

export const ProductStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

/** How the service fee is calculated. PER_PERSON is the default. */
export const ServiceFeeMethod = {
  PER_PERSON: 'PER_PERSON',
} as const;
export type ServiceFeeMethod = (typeof ServiceFeeMethod)[keyof typeof ServiceFeeMethod];

/** Realtime event names (Socket.IO namespace /rt). */
export const RtEvent = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_CANCELLED: 'order:cancelled',
  ITEM_PREPARING: 'item:preparing',
  ITEM_READY: 'item:ready',
  ITEM_SERVED: 'item:served',
  ORDER_READY: 'order:ready',
  PAYMENT_RECEIVED: 'payment:received',
  PAYMENT_REVERSED: 'payment:reversed',
  ROOM_BALANCE_CHANGED: 'room:balance-changed',
  ROOM_SESSION_CLOSED: 'room:session-closed',
  ROOM_SESSION_OPENED: 'room:session-opened',
  DELIVERY_STATUS_CHANGED: 'delivery:status-changed',
  PRODUCT_UPDATED: 'product:updated',
} as const;
export type RtEvent = (typeof RtEvent)[keyof typeof RtEvent];
