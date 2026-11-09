import type { MeasurementUnit, OrderItemStatus, OrderStatus } from '@ikki-dost/shared-types';

export const unitLabel: Record<MeasurementUnit, string> = {
  PIECE: 'dona',
  KG: 'kg',
  LITER: 'l',
  PORTION: 'porsiya',
  OTHER: '',
};

export const itemStatusLabel: Record<OrderItemStatus, string> = {
  PENDING: 'Kutilmoqda',
  PREPARING: 'Tayyorlanmoqda',
  READY: 'Tayyor',
  SERVED: 'Berildi',
  CANCELLED: 'Bekor',
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

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'hozir';
  if (mins < 60) return `${mins} daq`;
  const hours = Math.floor(mins / 60);
  return `${hours} soat ${mins % 60} daq`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

/** Plays a short kitchen chime using Web Audio (no asset required). */
export function playChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1174.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio is best-effort */
  }
}
