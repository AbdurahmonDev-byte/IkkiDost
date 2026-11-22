import type { ReceiptData } from '../pos/Receipt';
import { formatDateTime, formatQty, formatTime } from './format';

/**
 * Silent receipt printing for the desktop app.
 *
 * The receipt is drawn on a canvas (any alphabet prints exactly as on screen),
 * turned into a 1-bit bitmap and sent to the Rust side, which wraps it in
 * ESC/POS raster commands and writes it to the printer as a RAW job — no print
 * dialog, like dedicated till software. In a plain browser we fall back to the
 * system print dialog.
 */

export interface PrinterInfo {
  name: string;
  is_default: boolean;
}

export interface PrinterSettings {
  name: string;
  /** Printable width in dots: 576 for 80 mm, 384 for 58 mm printers (203 dpi). */
  widthDots: 576 | 384;
}

type TauriInternals = { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };
const tauri = (): TauriInternals | null =>
  ((window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__ ?? null);

export const canPrintSilently = () => tauri() !== null;

const KEY = 'ikki-printer';

export function loadPrinterSettings(): PrinterSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PrinterSettings) : null;
  } catch {
    return null;
  }
}

export function savePrinterSettings(s: PrinterSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable — the choice lasts for this session only
  }
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  const t = tauri();
  if (!t) return [];
  return t.invoke<PrinterInfo[]>('list_printers');
}

/** Receipt printers first (Xprinter, POS-80, …), then the Windows default. */
export function guessReceiptPrinter(printers: PrinterInfo[]): PrinterInfo | null {
  const receipt = /xprinter|xp-?\d|pos-?\d|pos ?printer|receipt|thermal|chek|80mm|58mm|rongta|gprinter/i;
  return printers.find((p) => receipt.test(p.name)) ?? printers.find((p) => p.is_default) ?? printers[0] ?? null;
}

async function resolvePrinter(): Promise<PrinterSettings | null> {
  const saved = loadPrinterSettings();
  if (saved?.name) return saved;
  const guess = guessReceiptPrinter(await listPrinters());
  if (!guess) return null;
  const settings: PrinterSettings = { name: guess.name, widthDots: 576 };
  savePrinterSettings(settings);
  return settings;
}

// ---------- rendering ----------

const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Draws the receipt and returns packed 1-bit rows (MSB first, 1 = black). */
export function renderReceiptBitmap(data: ReceiptData, width: number): { width: number; height: number; bits: number[] } {
  const scale = width / 576;
  const pad = Math.round(6 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 4000;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  let y = Math.round(4 * scale);

  const font = (px: number, bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${Math.round(px * scale)}px Arial, "Segoe UI", sans-serif`;
  };
  const lineH = (px: number) => Math.round(px * scale * 1.3);
  const center = (text: string, px: number, bold = false) => {
    font(px, bold);
    ctx.fillText(text, (width - ctx.measureText(text).width) / 2, y);
    y += lineH(px);
  };
  // Thermal heads print thin strokes faintly, so body text is bold by default.
  const row = (left: string, right: string, px = 24, bold = true) => {
    font(px, bold);
    const rw = ctx.measureText(right).width;
    const lines = wrap(left, width - pad * 2 - rw - 12 * scale);
    lines.forEach((l, i) => {
      ctx.fillText(l, pad, y);
      if (i === 0) ctx.fillText(right, width - pad - rw, y);
      y += lineH(px);
    });
  };
  const wrap = (text: string, max: number): string[] => {
    const words = text.split(/\s+/);
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= max || !cur) cur = next;
      else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  };
  const dashed = () => {
    y += Math.round(4 * scale);
    for (let x = pad; x < width - pad; x += 12 * scale) ctx.fillRect(x, y, 7 * scale, Math.max(1, 2 * scale));
    y += Math.round(10 * scale);
  };

  const items = data.orders.flatMap((o) => o.items.filter((i) => i.status !== 'CANCELLED'));
  const itemsTotal = data.orders.reduce((s, o) => s + o.itemsTotal, 0);
  const fee = data.orders.reduce((s, o) => s + o.serviceFeeAmount, 0);
  const payments = data.payments.filter((p) => !p.reversedAt);

  center('IKKI DO‘ST CHOYXONASI', 34, true);
  center('Hisob-kitob cheki', 22);
  center(formatDateTime(new Date().toISOString()), 22);
  dashed();
  row(data.heading, data.subheading ?? '', 26, true);
  if (data.details) row(data.details, '', 22);
  dashed();
  for (const i of items) {
    row(i.productName, `${formatQty(i.quantity, i.productUnit)}  ${num(i.lineTotal)}`, 24);
  }
  dashed();
  row('Mahsulotlar', num(itemsTotal), 24);
  if (fee > 0) row('Xizmat haqi', num(fee), 24);
  dashed();
  row('JAMI', `${num(data.total)} so‘m`, 32, true);
  if (data.paid > 0) row('To‘langan', num(data.paid), 24);
  if (data.outstanding > 0) row('Qarz', num(data.outstanding), 28, true);
  if (payments.length) {
    dashed();
    for (const p of payments) row(`${p.methodName} · ${formatTime(p.createdAt)}`, num(p.amount), 22);
  }
  dashed();
  center('Xaridingiz uchun rahmat!', 24, true);
  y += Math.round(10 * scale);

  const height = Math.min(canvas.height, y);
  const img = ctx.getImageData(0, 0, width, height).data;
  const rowBytes = Math.ceil(width / 8);
  const bits = new Array<number>(rowBytes * height).fill(0);
  for (let yy = 0; yy < height; yy++) {
    for (let x = 0; x < width; x++) {
      const i = (yy * width + x) * 4;
      const lum = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
      if (lum < 150) bits[yy * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bits };
}

/** Test page for the printer settings dialog. */
export function testReceipt(): ReceiptData {
  return {
    heading: 'Sinov cheki',
    subheading: '',
    orders: [],
    total: 0,
    paid: 0,
    outstanding: 0,
    payments: [],
    details: 'Printer to‘g‘ri ulangan — Оқ балиқ, Қ Ғ Ў Ҳ',
  };
}

/**
 * Prints without a dialog when running in the desktop app. Returns false when
 * silent printing is not available, so the caller can fall back to the dialog.
 */
export async function printSilently(data: ReceiptData, override?: PrinterSettings): Promise<boolean> {
  const t = tauri();
  if (!t) return false;
  const settings = override ?? (await resolvePrinter());
  if (!settings) throw new Error('Printer topilmadi. «Printer» sozlamasidan tanlang.');
  const { width, height, bits } = renderReceiptBitmap(data, settings.widthDots);
  await t.invoke('print_receipt_raster', { printer: settings.name, width, height, bits });
  return true;
}
