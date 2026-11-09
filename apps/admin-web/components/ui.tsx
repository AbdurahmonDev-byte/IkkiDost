'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===== Button =====
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm',
  secondary: 'bg-white text-ink ring-1 ring-line hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-black/5',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  accent: 'bg-accent-500 text-white hover:bg-accent-600',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
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

// ===== Inputs =====
const fieldClass =
  'h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-paper disabled:text-ink-faint';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, 'h-auto min-h-[80px] py-2 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, 'appearance-none bg-white pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft', className)} {...props}>
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ===== Card =====
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl bg-white shadow-card ring-1 ring-line/70', className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ===== Badge =====
const badgeTones = {
  neutral: 'bg-neutral-100 text-neutral-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-sky-100 text-sky-700',
  purple: 'bg-violet-100 text-violet-700',
  primary: 'bg-primary-50 text-primary-700',
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

// ===== Table =====
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn('whitespace-nowrap border-b border-line/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('border-b border-line/50 px-4 py-3 align-middle', className)}>
      {children}
    </td>
  );
}

// ===== Modal =====
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
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
        className={cn('w-full animate-slide-in rounded-2xl bg-white shadow-xl ring-1 ring-black/5', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-black/5" aria-label="Yopish">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ===== Misc =====
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-ink-soft', className)} size={20} />;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'primary' | 'amber' | 'red' | 'blue';
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-sky-50 text-sky-700',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink-soft">{label}</p>
          <p className="mt-1.5 truncate text-xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-1 truncate text-[11px] text-ink-faint">{hint}</p>}
        </div>
        {icon && <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>}
      </div>
    </Card>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Tasdiqlash',
  danger,
  loading,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-soft">{message}</p>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Bekor qilish
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
