import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { money, uzs } from '../lib/format';
import type { FinanceDay } from './WeeklyFinanceChart';
import { HourlySalesChart, type HourlySale } from './HourlySalesChart';

export interface OptimoStats {
  todayRevenue: number;
  todayOrderCount: number;
  activeRooms: number;
  activeDineInOrders: number;
  activeDeliveryOrders: number;
  paidToday: number;
  todayExpenses: number;
  todayCostOfGoods: number;
  todayProfit: number;
  unpaidOutstanding: number;
  popularProducts: Array<{
    productName: string;
    quantity: string;
    revenue: number;
    profit?: number;
  }>;
  revenueByDay: FinanceDay[];
  hourlySales?: HourlySale[];
  paymentsByMethod?: Array<{
    methodName: string;
    kind: string;
    amount: number;
    count: number;
  }>;
}

interface Props {
  stats: OptimoStats;
  title?: string;
}

export const OptimoDashboard: React.FC<Props> = ({ stats, title = 'Asosiy' }) => {
  const [productTab, setProductTab] = useState<'revenue' | 'profit'>('revenue');
  const [showHourly, setShowHourly] = useState(false);

  // Formatted date string in Uzbek (e.g., "15 noy. 2026")
  const todayFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  // Top metric calculations
  const totalCost = stats.todayExpenses + stats.todayCostOfGoods;
  const grossSales = stats.todayRevenue;
  const marginPercent = grossSales > 0 ? (stats.todayProfit / grossSales) * 100 : 0;

  // Day-over-day trends from revenueByDay
  const { revTrend, profitTrend } = useMemo(() => {
    const days = stats.revenueByDay ?? [];
    if (days.length < 2) return { revTrend: 0, profitTrend: 0 };
    const today = days[days.length - 1];
    const yest = days[days.length - 2];
    return {
      revTrend: (today?.revenue ?? 0) - (yest?.revenue ?? 0),
      profitTrend: (today?.profit ?? 0) - (yest?.profit ?? 0),
    };
  }, [stats.revenueByDay]);

  // Payment method breakdowns (Cash, Non-cash/Card, Credit/Debt)
  const cashAmount = useMemo(() => {
    const cash = stats.paymentsByMethod?.find((m) => m.kind === 'CASH');
    return cash ? cash.amount : stats.paidToday;
  }, [stats.paymentsByMethod, stats.paidToday]);

  const cardAmount = useMemo(() => {
    const card = stats.paymentsByMethod?.find((m) => m.kind === 'CARD');
    return card ? card.amount : 0;
  }, [stats.paymentsByMethod]);

  const creditAmount = stats.unpaidOutstanding ?? 0;

  // Donut chart calculation
  const donutTotal = Math.max(1, cashAmount + cardAmount + creditAmount);
  const cashDeg = (cashAmount / donutTotal) * 360;
  const cardDeg = (cardAmount / donutTotal) * 360;
  const creditDeg = (creditAmount / donutTotal) * 360;

  // Sorted popular products
  const sortedProducts = useMemo(() => {
    const list = [...(stats.popularProducts ?? [])];
    if (productTab === 'revenue') {
      return list.sort((a, b) => b.revenue - a.revenue);
    }
    return list.sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  }, [stats.popularProducts, productTab]);

  return (
    <div className="space-y-3.5">
      {/* ── Top Header Bar (Optimo style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-3.5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black tracking-tight text-stone-900 dark:text-stone-100">
              {title}
            </h2>
            <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-bold text-stone-500">
              Optimo POS
            </span>
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-stone-400">
            &ldquo;IKKI DO‘ST&rdquo; CHOYXONASI
          </p>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 px-2.5 py-1.5 text-[11px] font-bold text-stone-700 dark:text-stone-300">
          <button type="button" className="tap text-stone-400 hover:text-stone-200">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <Calendar className="mx-1 h-3.5 w-3.5 text-stone-400" />
          <span>{todayFormatted}</span>
          <button type="button" className="tap text-stone-400 hover:text-stone-200">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Top Summary Metrics (Umumiy xarajat, Umumiy sotish narxi, Marja) ── */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-stone-200/70 dark:border-stone-800/80 bg-white dark:bg-stone-900/80 p-3 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold text-stone-500 dark:text-stone-400">
            Umumiy xarajat
          </p>
          <p className="mt-0.5 truncate text-[13px] font-black tabular-nums text-stone-900 dark:text-stone-100">
            {uzs(totalCost)} <span className="text-[10px] font-bold text-stone-400">so‘m</span>
          </p>
        </div>

        <div className="min-w-0 border-x border-stone-200/60 dark:border-stone-800/60 px-2">
          <p className="truncate text-[10px] font-bold text-stone-500 dark:text-stone-400">
            Umumiy sotish narxi
          </p>
          <p className="mt-0.5 truncate text-[13px] font-black tabular-nums text-stone-900 dark:text-stone-100">
            {uzs(grossSales)} <span className="text-[10px] font-bold text-stone-400">so‘m</span>
          </p>
        </div>

        <div className="min-w-0 pl-1">
          <p className="truncate text-[10px] font-bold text-stone-500 dark:text-stone-400">
            Marja
          </p>
          <p
            className={`mt-0.5 truncate text-[13px] font-black tabular-nums ${
              marginPercent >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'
            }`}
          >
            {marginPercent > 0 ? '+' : ''}
            {marginPercent.toFixed(2)} %
          </p>
        </div>
      </div>

      {/* ── Row 1: 3 Optimo Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Umumiy daromad */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
            Umumiy daromad
          </p>
          <p className="mt-1 text-[22px] font-black tracking-tight tabular-nums text-stone-900 dark:text-stone-100">
            {money(stats.todayRevenue)}
          </p>

          {/* Mini Bar Chart (Blue) */}
          <div className="mt-3 flex h-14 items-end gap-1.5 border-b border-stone-200 dark:border-stone-800 pb-1">
            {(stats.revenueByDay ?? []).map((day, idx) => {
              const max = Math.max(1, ...stats.revenueByDay.map((d) => d.revenue));
              const heightPct = Math.max(8, Math.round((day.revenue / max) * 100));
              const isToday = idx === stats.revenueByDay.length - 1;
              return (
                <div key={day.date} className="group relative flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isToday ? 'bg-sky-500' : 'bg-sky-400/50 hover:bg-sky-400/80'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${day.date}: ${money(day.revenue)}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Trend Indicator */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-stone-400">Kechagiga nisbatan</span>
            <span
              className={`flex items-center gap-0.5 tabular-nums ${
                revTrend >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {revTrend >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {revTrend >= 0 ? '+' : '-'} {uzs(Math.abs(revTrend))}
            </span>
          </div>
        </div>

        {/* Card 2: Marja (Profit) */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
            Marja
          </p>
          <p className="mt-1 text-[22px] font-black tracking-tight tabular-nums text-stone-900 dark:text-stone-100">
            {money(stats.todayProfit)}{' '}
            <span className="text-xs font-bold text-stone-400">({marginPercent.toFixed(1)}%)</span>
          </p>

          {/* Mini Bar Chart (Pink/Red) */}
          <div className="mt-3 flex h-14 items-end gap-1.5 border-b border-stone-200 dark:border-stone-800 pb-1">
            {(stats.revenueByDay ?? []).map((day, idx) => {
              const max = Math.max(1, ...stats.revenueByDay.map((d) => Math.abs(d.profit)));
              const heightPct = Math.max(8, Math.round((Math.max(0, day.profit) / max) * 100));
              const isToday = idx === stats.revenueByDay.length - 1;
              return (
                <div key={day.date} className="group relative flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isToday ? 'bg-rose-500' : 'bg-rose-400/50 hover:bg-rose-400/80'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${day.date}: ${money(day.profit)}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Trend Indicator */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-stone-400">Kechagiga nisbatan</span>
            <span
              className={`flex items-center gap-0.5 tabular-nums ${
                profitTrend >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {profitTrend >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {profitTrend >= 0 ? '+' : '-'} {uzs(Math.abs(profitTrend))}
            </span>
          </div>
        </div>

        {/* Card 3: Daromad (Hisoblash bo‘yicha) + Donut Chart */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-4 shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
              Daromad
            </p>
            <p className="text-[9.5px] font-semibold text-stone-400">
              Hisoblash bo‘yicha
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            {/* List with colored bullets */}
            <div className="min-w-0 flex-1 space-y-2 text-[11px]">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Naqd pul</span>
                </div>
                <p className="ml-3.5 font-black tabular-nums text-stone-900 dark:text-stone-100">
                  {uzs(cashAmount)}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  <span>Naqd pulsiz</span>
                </div>
                <p className="ml-3.5 font-black tabular-nums text-stone-900 dark:text-stone-100">
                  {uzs(cardAmount)}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Kredit (Qarz)</span>
                </div>
                <p className="ml-3.5 font-black tabular-nums text-stone-900 dark:text-stone-100">
                  {uzs(creditAmount)}
                </p>
              </div>
            </div>

            {/* SVG Donut Chart */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90 transform">
                {/* Background Ring */}
                <circle cx="18" cy="18" r="14" fill="none" stroke="#292524" strokeWidth="4.5" />
                {/* Cash Arc */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4.5"
                  strokeDasharray={`${(cashDeg / 360) * 88} 88`}
                  strokeDashoffset="0"
                />
                {/* Card Arc */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="4.5"
                  strokeDasharray={`${(cardDeg / 360) * 88} 88`}
                  strokeDashoffset={`-${(cashDeg / 360) * 88}`}
                />
                {/* Credit Arc */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="4.5"
                  strokeDasharray={`${(creditDeg / 360) * 88} 88`}
                  strokeDashoffset={`-${((cashDeg + cardDeg) / 360) * 88}`}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[9px] font-black text-stone-400">To‘lov</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Ommabop mahsulotlar & Minimal zaxira miqdori ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Ommabop mahsulotlar */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 dark:text-stone-200">
              Ommabop mahsulotlar
            </h3>

            {/* Toggle Tabs: [Daromad] / [Foyda] */}
            <div className="flex rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setProductTab('revenue')}
                className={`tap rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  productTab === 'revenue'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Daromad
              </button>
              <button
                type="button"
                onClick={() => setProductTab('profit')}
                className={`tap rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  productTab === 'profit'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                Foyda
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800/60 text-[10px] font-bold text-stone-400">
                  <th className="py-2 pr-2 w-8">#</th>
                  <th className="py-2 px-2">Ism</th>
                  <th className="py-2 px-2 text-right">Miqdori</th>
                  <th className="py-2 pl-2 text-right">
                    {productTab === 'revenue' ? 'Daromad' : 'Foyda'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/40 font-semibold text-stone-700 dark:text-stone-300">
                {sortedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-stone-400">
                      Bugun hali buyurtma bo‘lmadi
                    </td>
                  </tr>
                ) : (
                  sortedProducts.map((p, idx) => (
                    <tr key={p.productName} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                      <td className="py-2.5 pr-2 font-mono text-[10px] text-stone-400">{idx + 1}</td>
                      <td className="py-2.5 px-2 font-bold text-stone-900 dark:text-stone-100">
                        {p.productName}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-stone-500 dark:text-stone-400">
                        {p.quantity}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-black tabular-nums text-stone-900 dark:text-stone-100">
                        {uzs(productTab === 'revenue' ? p.revenue : p.profit ?? p.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Minimal zaxira miqdori */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 dark:text-stone-200">
                Minimal zaxira miqdori
              </h3>
            </div>

            <table className="w-full text-left text-[11px] mt-2">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800/60 text-[10px] font-bold text-stone-400">
                  <th className="py-2 pr-2 w-8">#</th>
                  <th className="py-2 px-2">Ism</th>
                  <th className="py-2 pl-2 text-right">Miqdori</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Empty State / Icon (Matching Optimo Screenshot) */}
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-2.5 text-xs font-bold text-stone-500 dark:text-stone-400">
              Ma’lumotlar mavjud emas
            </p>
            <p className="mt-0.5 text-[10px] text-stone-400">
              Minimal zaxiradan kam mahsulotlar yo‘q
            </p>
          </div>
        </div>
      </div>

      {/* ── Soatlik / Haftalik tahlil (Qo‘shimcha qulaylik) ── */}
      <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-900/90 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 dark:text-stone-200">
              {showHourly ? 'Bugungi soatlik savdo dinamikasi' : '7 kunlik kirim, chiqim va sof foyda'}
            </h3>
            <p className="mt-0.5 text-[10px] font-medium text-stone-400">
              {showHourly ? 'Har bir soatlik to‘lovlar va tushum' : 'Kundalik moliya tahlili'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHourly(!showHourly)}
            className="tap rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 text-[10px] font-bold text-brand-700 dark:text-brand-300"
          >
            {showHourly ? 'Haftalik ko‘rinish' : 'Soatlik grafik'}
          </button>
        </div>

        {showHourly ? (
          <HourlySalesChart data={stats.hourlySales ?? []} />
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-stone-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Kirim
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Chiqim
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-400" /> Foyda
              </span>
            </div>
            {/* Small daily summary rows */}
            <div className="mt-2 divide-y divide-stone-100 dark:divide-stone-800/60">
              {(stats.revenueByDay ?? []).map((day) => (
                <div key={day.date} className="flex items-center justify-between py-1.5 text-[11px]">
                  <span className="font-bold text-stone-500">{day.date}</span>
                  <div className="flex items-center gap-3 font-mono text-[10.5px]">
                    <span className="text-emerald-500">+{uzs(day.revenue)}</span>
                    <span className="text-rose-500">-{uzs(day.expenses + (day.costOfGoods ?? 0))}</span>
                    <span
                      className={`font-black ${
                        day.profit >= 0 ? 'text-brand-300' : 'text-rose-400'
                      }`}
                    >
                      ={uzs(day.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
