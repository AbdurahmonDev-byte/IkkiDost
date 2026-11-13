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
  PORTION: 'por.',
  OTHER: '',
};

export function qty(quantity: number | string, unit: MeasurementUnit): string {
  const n = typeof quantity === 'number' ? quantity : Number(quantity);
  const u = unitShort[unit];
  return `${Number.isFinite(n) ? n : quantity}${u ? ` ${u}` : ''}`;
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
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  PREPARING: 'bg-orange-100 text-orange-800 border-orange-300',
  READY: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  DELIVERED: 'bg-stone-100 text-stone-700 border-stone-300',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-300',
};

/** Delivery statuses a courier can still work on. */
export function isDeliveryActive(status: DeliveryStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

export const statusColor: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  PREPARING: 'bg-orange-100 text-orange-800 border-orange-300',
  PARTIALLY_READY: 'bg-purple-100 text-purple-800 border-purple-300',
  READY: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  SERVED: 'bg-sky-100 text-sky-800 border-sky-300',
  COMPLETED: 'bg-stone-100 text-stone-700 border-stone-300',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-300',
};
