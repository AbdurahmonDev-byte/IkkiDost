import type { DeliveryStatus, MeasurementUnit, OrderStatus, PaymentKind } from '@ikki-dost/shared-types';

export function formatUzs(value: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(value)) + ' so‘m';
}

/** Kg and litre products are sold by exact mass, not whole units. */
export function isMassUnit(unit: MeasurementUnit): boolean {
  return unit === 'KG' || unit === 'LITER';
}

/** Round a quantity to 3 decimals (the API accepts at most 3). */
export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Decimal quantity string for the API, e.g. 1.82 -> "1.82", 2 -> "2". */
export function quantityForApi(value: number): string {
  return String(roundQty(value));
}

/** Keep only digits and a single decimal separator with up to 3 places. */
export function sanitizeQtyInput(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = normalized.split('.');
  if (rest.length === 0) return whole.slice(0, 6);
  return `${whole.slice(0, 6)}.${rest.join('').slice(0, 3)}`;
}

export function formatQty(qty: string, unit: MeasurementUnit): string {
  const n = Number(qty);
  const u = unit === 'KG' ? 'kg' : unit === 'LITER' ? 'l' : unit === 'PORTION' ? 'porsiya' : unit === 'PIECE' ? 'dona' : '';
  return `${n}${u ? ' ' + u : ''}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

export function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
