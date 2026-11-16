import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatQtyInput, isMassUnit, roundQty, unitShort } from '../lib/format';
import type { MeasurementUnit } from '../lib/types';

interface Props {
  value: number;
  unit: MeasurementUnit;
  /** Absolute next quantity. 0 means the item should be removed. */
  onChange: (next: number) => void;
  tone?: 'light' | 'dark';
}

/** Mass steps used by the +/- buttons; typing gives exact amounts like 1.82. */
const MASS_STEP = 0.1;

export const QuantityStepper: React.FC<Props> = ({ value, unit, onChange, tone = 'light' }) => {
  const mass = isMassUnit(unit);
  const [draft, setDraft] = useState(() => formatQtyInput(value));
  const focused = useRef(false);

  // Keep the input in sync with the cart unless the user is typing in it.
  useEffect(() => {
    if (!focused.current) setDraft(formatQtyInput(value));
  }, [value]);

  const dark = tone === 'dark';
  const frame = dark
    ? 'border-white/10 bg-white/[0.04] text-white'
    : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100';
  const stepButton = dark
    ? 'bg-white/5 text-white/80 hover:bg-white/10'
    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700';
  const plusButton = dark
    ? 'bg-[#d2b273] text-[#15120d]'
    : 'bg-gradient-to-br from-brand-500 to-brand-700 text-white';

  const update = (next: number) => {
    onChange(Math.max(0, roundQty(next)));
  };

  const handleDraft = (raw: string) => {
    // Accept "1,82" from Uzbek keyboards and keep at most 3 decimals.
    const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    const next = rest.length ? `${whole}.${rest.join('').slice(0, 3)}` : whole;
    setDraft(next);
    const parsed = Number(next);
    // Do not remove the item while the user is still typing "0,5".
    if (Number.isFinite(parsed) && parsed > 0) {
      update(parsed);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border p-0.5 ${frame}`}>
      <button
        type="button"
        onClick={() => update(value - (mass ? MASS_STEP : 1))}
        className={`tap flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${stepButton}`}
        aria-label="Kamaytirish"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      {mass ? (
        <label className="flex items-baseline gap-0.5">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            placeholder="0"
            onChange={(e) => handleDraft(e.target.value)}
            onFocus={() => {
              focused.current = true;
            }}
            onBlur={() => {
              focused.current = false;
              setDraft(formatQtyInput(value));
            }}
            aria-label={`Miqdor (${unitShort[unit] || 'kg'})`}
            className="w-12 bg-transparent text-center text-xs font-black outline-none"
          />
          <span className={`text-[10px] font-bold ${dark ? 'text-white/50' : 'text-stone-500 dark:text-stone-400'}`}>
            {unitShort[unit]}
          </span>
        </label>
      ) : (
        <span className="min-w-8 px-1 text-center text-xs font-black">
          {value}
          <span className={`ml-0.5 text-[10px] font-bold ${dark ? 'text-white/50' : 'text-stone-500 dark:text-stone-400'}`}>
            {unitShort[unit]}
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={() => update(value + (mass ? MASS_STEP : 1))}
        className={`tap flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${plusButton}`}
        aria-label="Qo‘shish"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
