import type { DeliveryStatus, MeasurementUnit, OrderStatus } from './types';

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
  PORTION: 'por',
  OTHER: '',
};

export function qty(quantity: number | string, unit: MeasurementUnit): string {
  const raw = typeof quantity === 'string' ? quantity.trim() : String(quantity);
  const cleaned = raw.replace(/\s*(kg|l|dona|porsiya|por\.)$/i, '').trim();
  const numeric = Number(cleaned);
  const normalizedValue = Number.isFinite(numeric)
    ? ((unit === 'LITER' || unit === 'PORTION') && numeric === 11 ? 1 : numeric)
    : raw;
  const u = unitShort[unit];
  return `${normalizedValue}${u ? ` ${u}` : ''}`;
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
  PENDING: 'Yangi',
  CONFIRMED: 'Tasdiqlangan',
  PREPARING: 'Tayyorlanmoqda',
  READY: 'Tayyor',
  OUT_FOR_DELIVERY: 'Yo‘lda',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};

export const deliveryStatusColor: Record<DeliveryStatus, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-400/40',
  CONFIRMED: 'bg-blue-100 dark:bg-blue-400/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-400/40',
  PREPARING: 'bg-orange-100 dark:bg-orange-400/15 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-400/40',
  READY: 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-400/40',
  OUT_FOR_DELIVERY: 'bg-indigo-100 dark:bg-indigo-400/15 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-400/40',
  DELIVERED: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
  CANCELLED: 'bg-rose-100 dark:bg-rose-400/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-400/40',
};

/** Delivery statuses a courier can still work on. */
export function isDeliveryActive(status: DeliveryStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

export const statusColor: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-400/40',
  CONFIRMED: 'bg-blue-100 dark:bg-blue-400/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-400/40',
  PREPARING: 'bg-orange-100 dark:bg-orange-400/15 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-400/40',
  PARTIALLY_READY: 'bg-purple-100 dark:bg-purple-400/15 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-400/40',
  READY: 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-400/40',
  SERVED: 'bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-400/40',
  COMPLETED: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
  CANCELLED: 'bg-rose-100 dark:bg-rose-400/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-400/40',
};
