import React from 'react';
import { uzs } from '../lib/format';

export interface HourlySale {
  hour: number;
  revenue: number;
  orderCount: number;
}

interface Props {
  data: HourlySale[];
}

function compact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1).replace('.0', '')}m`;
  }
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return uzs(amount);
}

export const HourlySalesChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return (
      <p className="rounded-2xl border border-stone-800 bg-stone-800/40 px-3 py-5 text-center text-[11px] font-semibold text-stone-500">
        Bugun hali to'lov qilinmagan.
      </p>
    );
  }

  const W = 340;
  const H = 160;
  const PAD_L = 34;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 24;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const maxRev = Math.max(1, ...data.map((d) => d.revenue));
  const minHour = data[0].hour;
  const maxHour = data[data.length - 1].hour;
  const hourSpan = Math.max(1, maxHour - minHour);

  function xOf(hour: number) {
    return PAD_L + ((hour - minHour) / hourSpan) * plotW;
  }
  function yOf(rev: number) {
    return PAD_T + plotH - (rev / maxRev) * plotH;
  }

  const pts = data.map((d) => `${xOf(d.hour)},${yOf(d.revenue)}`);
  const linePath = `M ${pts.join(' L ')}`;
  const fillPath =
    `M ${xOf(minHour)},${PAD_T + plotH} ` +
    `L ${pts.join(' L ')} ` +
    `L ${xOf(maxHour)},${PAD_T + plotH} Z`;

  const ticks = [0, maxRev / 2, maxRev];

  const labelCount = Math.min(data.length, 5);
  const step = Math.max(1, Math.floor(data.length / labelCount));
  const labelPoints = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Bugungi soatlik savdo grafigi"
    >
      <defs>
        <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => {
        const y = yOf(tick);
        return (
          <g key={tick}>
            <line
              x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
              stroke="#3f3a36" strokeDasharray="3 4" strokeWidth={1}
            />
            <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize={8} fontWeight={700} fill="#78716c">
              {compact(tick)}
            </text>
          </g>
        );
      })}

      <path d={fillPath} fill="url(#hourlyGrad)" />
      <path d={linePath} fill="none" stroke="#34d399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {data.map((d) => (
        <g key={d.hour}>
          <title>{d.hour}:00 · {uzs(d.revenue)} so'm · {d.orderCount} ta to'lov</title>
          <circle cx={xOf(d.hour)} cy={yOf(d.revenue)} r={3} fill="#34d399" stroke="#1c1917" strokeWidth={1.5} />
        </g>
      ))}

      {labelPoints.map((d) => (
        <text
          key={d.hour}
          x={xOf(d.hour)}
          y={H - 6}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          fill="#78716c"
        >
          {String(d.hour).padStart(2, '0')}:00
        </text>
      ))}
    </svg>
  );
};
