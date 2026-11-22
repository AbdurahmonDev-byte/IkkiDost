import { useState } from 'react';
import { formatUzs } from '../lib/format';

/** Validated categorical slots (light surface): blue, orange, aqua. */
const SERIES = { income: '#2a78d6', expense: '#eb6834', profit: '#1baf7a' } as const;

const short = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${+(a / 1_000_000).toFixed(1)} mln` : a >= 1000 ? `${Math.round(a / 1000)} ming` : String(a);
  return n < 0 ? `-${s}` : s;
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/** Rect with 4px rounded data end; flat at the baseline. */
function bar(x: number, w: number, y0: number, y1: number): string {
  const top = Math.min(y0, y1);
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  const r = Math.min(4, w / 2, h);
  const up = y1 < y0; // positive value: rounded top
  if (up) {
    return `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${y0}Z`;
  }
  const bottom = top + h;
  return `M${x},${y0}V${bottom - r}Q${x},${bottom} ${x + r},${bottom}H${x + w - r}Q${x + w},${bottom} ${x + w},${bottom - r}V${y0}Z`;
}

export interface DayPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

/** 7 kun: kirim, xarajat va sof foyda (bitta o‘q, guruhlangan ustunlar). */
export function WeekChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 230;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses, d.profit])));
  const minRaw = Math.min(0, ...data.map((d) => d.profit));
  const min = minRaw < 0 ? -niceMax(-minRaw) : 0;
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(18, (band - 16) / 3);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  const keys = [
    ['revenue', 'Kirim', SERIES.income],
    ['expenses', 'Xarajat', SERIES.expense],
    ['profit', 'Sof foyda', SERIES.profit],
  ] as const;
  const label = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}.${m}`;
  };

  return (
    <div className="relative">
      <Legend items={keys.map(([, n, c]) => [n, c])} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="7 kunlik kirim, xarajat va foyda">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c9c4b8' : '#ece9e2'} strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8a958d">{short(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = pad.l + i * band + (band - (bw * 3 + 4)) / 2;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * band} y={pad.t} width={band} height={H - pad.t - pad.b} fill={hover === i ? '#f3f1ec' : 'transparent'} />
              {keys.map(([k, , c], j) => (
                <path key={k} d={bar(x0 + j * (bw + 2), bw, y(0), y(d[k]))} fill={c} />
              ))}
              <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#5e6b62">{label(d.date)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip leftPct={((pad.l + hover * band + band / 2) / W) * 100}>
          <p className="mb-1 font-semibold">{label(data[hover].date)}</p>
          {keys.map(([k, n, c]) => (
            <Line key={k} color={c} name={n} value={formatUzs(data[hover][k])} />
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/** Bugun soatlar bo‘yicha kirim. */
export function HourChart({ data }: { data: Array<{ hour: number; revenue: number; orderCount: number }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const byHour = new Map(data.map((d) => [d.hour, d]));
  const from = Math.min(8, ...data.map((d) => d.hour));
  const to = Math.max(23, ...data.map((d) => d.hour));
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const W = 640;
  const H = 190;
  const pad = { l: 56, r: 12, t: 10, b: 26 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.revenue)));
  const y = (v: number) => pad.t + ((max - v) / max) * (H - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / hours.length;
  const bw = Math.max(4, Math.min(16, band - 6));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bugun soatlar bo‘yicha kirim">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke={t === 0 ? '#c9c4b8' : '#ece9e2'} />
            <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize={11} fill="#8a958d">{short(max * t)}</text>
          </g>
        ))}
        {hours.map((h, i) => {
          const v = byHour.get(h)?.revenue ?? 0;
          const x = pad.l + i * band + (band - bw) / 2;
          return (
            <g key={h} onMouseEnter={() => setHover(h)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * band} y={pad.t} width={band} height={H - pad.t - pad.b} fill={hover === h ? '#f3f1ec' : 'transparent'} />
              <path d={bar(x, bw, y(0), y(v))} fill={SERIES.income} />
              {h % 2 === 0 && (
                <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#5e6b62">{h}:00</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tooltip leftPct={((pad.l + (hover - from) * band + band / 2) / W) * 100}>
          <p className="mb-1 font-semibold">{hover}:00 – {hover + 1}:00</p>
          <Line color={SERIES.income} name="Kirim" value={formatUzs(byHour.get(hover)?.revenue ?? 0)} />
          <p className="text-ink-soft">{byHour.get(hover)?.orderCount ?? 0} ta to‘lov</p>
        </Tooltip>
      )}
    </div>
  );
}

/** Eng ko‘p sotilgan taomlar — gorizontal ustunlar. */
export function TopProducts({ items }: { items: Array<{ productName: string; quantity: string; revenue: number }> }) {
  const top = items.slice(0, 6);
  const max = Math.max(1, ...top.map((p) => p.revenue));
  if (top.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">Bugun hali sotuv yo‘q</p>;
  return (
    <div className="space-y-2.5">
      {top.map((p) => (
        <div key={p.productName}>
          <div className="flex justify-between text-sm">
            <span className="truncate font-medium">{p.productName}</span>
            <span className="ml-2 whitespace-nowrap text-ink-soft">{+Number(p.quantity).toFixed(3)} · <b className="text-ink">{formatUzs(p.revenue)}</b></span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-paper">
            <div className="h-2 rounded-full" style={{ width: `${(p.revenue / max) * 100}%`, background: SERIES.income }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: Array<readonly [string, string]> }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-ink-soft">
      {items.map(([name, color]) => (
        <span key={name} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> {name}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ leftPct, children }: { leftPct: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-6 z-10 min-w-[170px] -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-line"
      style={{ left: `${Math.min(85, Math.max(15, leftPct))}%` }}
    >
      {children}
    </div>
  );
}

function Line({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-ink-soft">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} /> {name}
      </span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
