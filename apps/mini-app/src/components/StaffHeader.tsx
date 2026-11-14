import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, RefreshCw } from 'lucide-react';

type Tone = 'brand' | 'sky' | 'emerald' | 'orange' | 'purple';

const tileClass: Record<Tone, string> = {
  brand: 'from-brand-500 to-brand-700 shadow-brand-600/30',
  sky: 'from-sky-500 to-indigo-600 shadow-sky-600/30',
  emerald: 'from-emerald-500 to-teal-700 shadow-emerald-600/30',
  orange: 'from-amber-500 to-orange-600 shadow-orange-500/30',
  purple: 'from-violet-500 to-purple-700 shadow-violet-600/30',
};

const glowClass: Record<Tone, string> = {
  brand: 'bg-brand-400',
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-400',
  orange: 'bg-orange-400',
  purple: 'bg-violet-400',
};

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  eyebrow?: string;
  tone?: Tone;
  onRefresh?: () => void;
  loading?: boolean;
  right?: React.ReactNode;
}

/**
 * Shared header for every staff screen so the panels feel like one product
 * instead of five different apps.
 */
export const StaffHeader: React.FC<Props> = ({
  icon: Icon,
  title,
  subtitle,
  eyebrow = 'Xodim paneli',
  tone = 'brand',
  onRefresh,
  loading = false,
  right,
}) => (
  <div className="surface relative overflow-hidden p-4 animate-rise">
    <div
      className={`pointer-events-none absolute -right-10 -top-14 h-32 w-32 rounded-full ${glowClass[tone]} opacity-20 blur-2xl`}
    />
    <div className="relative flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`icon-tile bg-gradient-to-br ${tileClass[tone]} text-white shadow-lg`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-soft-pulse" />
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-600">
              {eyebrow}
            </p>
          </div>
          <h2 className="truncate text-[17px] font-black leading-tight text-stone-900">{title}</h2>
          <p className="truncate text-[11.5px] font-medium text-stone-500">{subtitle}</p>
        </div>
      </div>
      {right ??
        (onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="tap shrink-0 rounded-2xl border border-stone-200/80 bg-white p-2.5 text-stone-600 shadow-sm hover:bg-stone-50"
            title="Yangilash"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        ) : null)}
    </div>
  </div>
);
