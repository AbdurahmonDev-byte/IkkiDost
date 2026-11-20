import { Delete } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '../ui';

/**
 * Large on-screen number pad for touch screens. Physical keyboard digits,
 * comma/dot, Backspace and Enter work too.
 */
export function Keypad({
  value,
  onChange,
  decimals = 0,
  maxLength = 12,
  onEnter,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Allowed fraction digits (0 = integers only, 3 = kg/litre). */
  decimals?: number;
  maxLength?: number;
  onEnter?: () => void;
  className?: string;
}) {
  const press = (key: string) => {
    if (key === 'C') return onChange('');
    if (key === '⌫') return onChange(value.slice(0, -1));
    if (key === '.') {
      if (decimals === 0 || value.includes('.')) return;
      return onChange(value === '' ? '0.' : `${value}.`);
    }
    if (key === '00') {
      if (value === '' || value.includes('.')) return;
      return onChange(`${value}00`.slice(0, maxLength));
    }
    const dot = value.indexOf('.');
    if (dot >= 0 && value.length - dot > decimals) return;
    const next = value === '0' ? key : value + key;
    if (next.length > maxLength) return;
    onChange(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === '.' || e.key === ',') press('.');
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Delete') press('C');
      else if (e.key === 'Enter' && onEnter) onEnter();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', decimals > 0 ? '.' : '00', '0', '⌫'];
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className={cn(
            'flex h-14 items-center justify-center rounded-xl text-xl font-semibold shadow-sm ring-1 ring-line transition active:scale-95',
            k === '⌫' ? 'bg-paper text-ink-soft' : 'bg-white text-ink hover:bg-paper',
          )}
        >
          {k === '⌫' ? <Delete size={22} /> : k === '.' ? ',' : k}
        </button>
      ))}
      <button
        type="button"
        onClick={() => press('C')}
        className="col-span-3 h-10 rounded-xl bg-paper text-sm font-semibold text-ink-soft ring-1 ring-line active:scale-95"
      >
        Tozalash
      </button>
    </div>
  );
}
