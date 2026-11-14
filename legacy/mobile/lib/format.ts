import type {
  DeliveryStatus,
  MeasurementUnit,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentKind,
  Role,
} from '@ikki-dost/shared-types';

/** Format integer UZS with thin spaces: 45000 -> "45 000". */
export function formatUzs(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return sign + String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Format integer UZS with suffix: "45 000 so'm". */
export function money(amount: number): string {
  return `${formatUzs(amount)} so‘m`;
}

/** Human quantity for a measurement unit, keeping decimals: "0.75 kg". */
export function formatQty(quantity: string | number, unit: MeasurementUnit): string {
  const n = typeof quantity === 'number' ? quantity : Number(quantity);
  const u = unitShort[unit];
  return `${Number.isFinite(n) ? n : quantity}${u ? ` ${u}` : ''}`;
}

export const unitShort: Record<MeasurementUnit, string> = {
  PIECE: 'dona',
  KG: 'kg',
  LITER: 'l',
  PORTION: 'porsiya',
  OTHER: '',
};

export const unitLabel: Record<MeasurementUnit, string> = {
  PIECE: 'Dona',
  KG: 'Kilogramm',
  LITER: 'Litr',
  PORTION: 'Porsiya',
  OTHER: 'Boshqa',
};

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'hozir';
  if (mins < 60) return `${mins} daq`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat ${mins % 60} daq`;
  return `${Math.floor(hours / 24)} kun`;
}

export function elapsed(iso: string): string {
  const mins = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins} daq`;
  return `${Math.floor(mins / 60)} soat ${mins % 60} daq`;
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: 'Yangi',
  CONFIRMED: 'Tasdiqlangan',
  PREPARING: 'Tayyorlanmoqda',
  PARTIALLY_READY: 'Qisman tayyor',
  READY: 'Tayyor',
  SERVED: 'Berildi',
  COMPLETED: 'Yakunlandi',
  CANCELLED: 'Bekor qilindi',
};

export const itemStatusLabel: Record<OrderItemStatus, string> = {
  PENDING: 'Kutilmoqda',
  PREPARING: 'Tayyorlanmoqda',
  READY: 'Tayyor',
  SERVED: 'Berildi',
  CANCELLED: 'Bekor',
};

export const deliveryStatusLabel: Record<DeliveryStatus, string> = {
  PENDING: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlangan',
  PREPARING: 'Tayyorlanmoqda',
  READY: 'Tayyor',
  OUT_FOR_DELIVERY: 'Yo‘lda',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};

export const orderTypeLabel: Record<OrderType, string> = {
  DINE_IN: 'Zalda',
  DELIVERY: 'Yetkazib berish',
};

export const roleLabel: Record<Role, string> = {
  OWNER: 'Ega',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
};

export const paymentKindLabel: Record<PaymentKind, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  OTHER: 'Boshqa',
};

/** Next delivery status in the allowed workflow, or null at the end. */
export const deliveryNext: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

export function isDeliveryActive(status: DeliveryStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

/** Unique-enough key for payment idempotency (server deduplicates). */
export function idempotencyKey(): string {
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
