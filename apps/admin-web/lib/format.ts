import type {
  DeliveryStatus,
  MeasurementUnit,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentKind,
  ProductStatus,
  Role,
  ServiceFeeMethod,
} from '@ikki-dost/shared-types';

export function formatUzs(value: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(value)) + ' so‘m';
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('uz-UZ').format(value);
}

export function formatQty(qty: string, unit: MeasurementUnit): string {
  const n = Number(qty);
  const u = unit === 'KG' ? 'kg' : unit === 'LITER' ? 'l' : unit === 'PORTION' ? 'porsiya' : unit === 'PIECE' ? 'dona' : '';
  return `${n}${u ? ' ' + u : ''}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'hozir';
  if (mins < 60) return `${mins} daq oldin`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat oldin`;
  return `${Math.floor(hours / 24)} kun oldin`;
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeDefault(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateInput(first), to: toDateInput(now) };
}

export const roleLabel: Record<Role, string> = {
  OWNER: 'Egasi',
  WAITER: 'Ofitsiant',
  CHEF: 'Oshpaz',
  CASHIER: 'Kassir',
  DELIVERY: 'Yetkazib beruvchi',
};

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

export const orderTypeLabel: Record<OrderType, string> = {
  DINE_IN: 'Zalda',
  DELIVERY: 'Yetkazib berish',
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

export const productStatusLabel: Record<ProductStatus, string> = {
  ACTIVE: 'Faol',
  DISABLED: 'O‘chirilgan',
  ARCHIVED: 'Arxivlangan',
};

export const unitLabel: Record<MeasurementUnit, string> = {
  PIECE: 'dona',
  KG: 'kg',
  LITER: 'l',
  PORTION: 'porsiya',
  OTHER: 'boshqa',
};

export const paymentKindLabel: Record<PaymentKind, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  OTHER: 'Boshqa',
};

export const feeMethodLabel: Record<ServiceFeeMethod, string> = {
  PER_PERSON: 'Har bir kishi uchun',
};
