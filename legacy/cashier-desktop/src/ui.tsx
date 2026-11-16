import { clsx, type ClassValue } from 'clsx';
import { Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm',
  secondary: 'bg-white text-ink ring-1 ring-line hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-black/5',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  accent: 'bg-accent-500 text-white hover:bg-accent-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

const field =
  'h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-paper';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, 'h-auto min-h-[76px] py-2', className)} {...props} />;
}
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(field, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  );
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl bg-white shadow-card ring-1 ring-line/70', className)}>{children}</div>;
}

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'primary';
const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-sky-100 text-sky-700',
  primary: 'bg-primary-50 text-primary-700',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tones[tone], className)}>{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  xl,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  xl?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8" onMouseDown={onClose}>
      <div
        className={cn(
          'w-full animate-[fade-in_.15s_ease-out] rounded-2xl bg-white shadow-xl',
          xl ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-lg',
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-ink-soft', className)} size={20} />;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="max-w-xs text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
