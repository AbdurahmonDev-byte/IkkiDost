import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, RefreshCw } from 'lucide-react';

type Tone = 'brand' | 'sky' | 'emerald' | 'orange' | 'purple';

const toneClass: Record<Tone, string> = {
  brand: 'bg-brand-500/20 text-brand-100 ring-1 ring-brand-400/30',
  sky: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/30',
  emerald: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30',
  orange: 'bg-orange-500/20 text-orange-100 ring-1 ring-orange-400/30',
  purple: 'bg-purple-500/20 text-purple-100 ring-1 ring-purple-400/30',
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
  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 p-4 text-white shadow-lg shadow-stone-900/10">
    <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/5" />
    <div className="relative flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-400">{eyebrow}</p>
          <h2 className="truncate text-base font-black leading-tight">{title}</h2>
          <p className="truncate text-[11px] font-medium text-stone-400">{subtitle}</p>
        </div>
      </div>
      {right ??
        (onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 rounded-2xl bg-white/10 p-2.5 text-stone-200 transition-all hover:bg-white/20 active:scale-95"
            title="Yangilash"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        ) : null)}
    </div>
  </div>
);
