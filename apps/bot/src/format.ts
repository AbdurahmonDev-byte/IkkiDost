import type {
  DeliveryStatus,
  MeasurementUnit,
  OrderItemStatus,
  OrderStatus,
  PaymentKind,
} from './types.js';

/** 45000 -> "45 000" */
export function uzs(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return sign + String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function money(amount: number): string {
  return `${uzs(amount)} so‘m`;
}

export const unitShort: Record<MeasurementUnit, string> = {
  PIECE: 'dona',
  KG: 'kg',
  LITER: 'l',
  PORTION: 'porsiya',
  OTHER: '',
};

export function qty(quantity: string | number, unit: MeasurementUnit): string {
  const n = typeof quantity === 'number' ? quantity : Number(quantity);
  const normalizedN =
    Number.isFinite(n) && (unit === 'LITER' || unit === 'PORTION') && n === 11 ? 1 : n;
  const u = unitShort[unit];
  return `${Number.isFinite(n) ? normalizedN : quantity}${u ? ` ${u}` : ''}`;
}

export function time(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${time(iso)}`;
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

export const paymentKindLabel: Record<PaymentKind, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  OTHER: 'Boshqa',
};

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
