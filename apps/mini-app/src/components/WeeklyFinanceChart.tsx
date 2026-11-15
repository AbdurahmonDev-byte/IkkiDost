import React from 'react';
import { money, uzs } from '../lib/format';

export interface FinanceDay {
  date: string;
  revenue: number;
  expenses: number;
  costOfGoods: number;
  profit: number;
}

interface Props {
  data: FinanceDay[];
}

const SERIES = [
  { key: 'revenue' as const, label: 'Kirim', color: '#34d399', tile: 'bg-emerald-400' },
  { key: 'expenses' as const, label: 'Chiqim', color: '#fb7185', tile: 'bg-rose-400' },
  { key: 'profit' as const, label: 'Foyda', color: '#d9a05f', tile: 'bg-brand-400' },
];

const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

/** 1000 → 1k, 1 250 000 → 1.3 mln. Used for the compact y-axis labels. */
function compact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const value = amount / 1_000_000;
    return `${Math.abs(value) >= 10 ? Math.round(value) : value.toFixed(1).replace('.0', '')} mln`;
  }
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return uzs(amount);
}

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date.slice(5) : WEEKDAYS[parsed.getDay()];
}

function fullDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
}

export const WeeklyFinanceChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return (
      <p className="rounded-2xl border border-stone-800 bg-stone-800/40 px-3 py-4 text-center text-[11px] font-semibold text-stone-400">
        Haftalik ma’lumot hali yo‘q.
      </p>
    );
  }

  const width = 340;
  const height = 196;
  const left = 36;
  const right = 6;
  const top = 14;
  const bottom = 26;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const values = data.flatMap((day) => [day.revenue, day.expenses, day.profit]);
  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(0, ...values);
  const span = maxValue - minValue || 1;
  const scale = plotHeight / span;
  const zeroY = top + maxValue * scale;

  const slot = plotWidth / data.length;
  const barWidth = 8;
  const barGap = 2;
  const groupWidth = barWidth * SERIES.length + barGap * (SERIES.length - 1);
  const groupOffset = (slot - groupWidth) / 2;

  const ticks = [0, maxValue / 2, maxValue];
  const totals = SERIES.map((series) => ({
    ...series,
    total: data.reduce((sum, day) => sum + day[series.key], 0),
  }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400">
            <span className={`h-2 w-2 rounded-full ${series.tile}`} />
            {series.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Oxirgi 7 kunlik kirim, chiqim va foyda grafigi"
      >
        {ticks.map((tick) => {
          const y = zeroY - tick * scale;
          return (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#3f3a36"
                strokeDasharray="3 4"
                strokeWidth={1}
              />
              <text x={left - 5} y={y + 3} textAnchor="end" fontSize={8.5} fontWeight={700} fill="#78716c">
                {compact(tick)}
              </text>
            </g>
          );
        })}

        <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} stroke="#57534e" strokeWidth={1} />

        {data.map((day, index) => {
          const groupX = left + index * slot + groupOffset;
          return (
            <g key={day.date}>
              <title>
                {fullDate(day.date)} · Kirim: {money(day.revenue)} · Chiqim: {money(day.expenses)} ·
                Foyda: {money(day.profit)}
              </title>
              {SERIES.map((series, seriesIndex) => {
                const value = day[series.key];
                const barHeight = Math.abs(value) * scale;
                const x = groupX + seriesIndex * (barWidth + barGap);
                const y = value >= 0 ? zeroY - barHeight : zeroY;
                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, value === 0 ? 0 : 1)}
                    rx={2}
                    fill={series.color}
                    opacity={series.key === 'profit' ? 0.95 : 0.9}
                  />
                );
              })}
              <text
                x={left + index * slot + slot / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill="#a8a29e"
              >
                {dayLabel(day.date)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {totals.map((series) => (
          <div key={series.key} className="rounded-xl border border-stone-800/80 bg-stone-800/40 px-2 py-2">
            <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-stone-500">
              <span className={`h-1.5 w-1.5 rounded-full ${series.tile}`} />
              {series.label}
            </p>
            <p
              className={`mt-0.5 truncate text-[11.5px] font-black tabular-nums ${
                series.key === 'profit' && series.total < 0 ? 'text-rose-300' : 'text-stone-100'
              }`}
            >
              {uzs(series.total)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
