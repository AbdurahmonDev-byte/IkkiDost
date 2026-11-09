'use client';

import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToast.getState().push('success', m),
  error: (m: string) => useToast.getState().push('error', m),
  info: (m: string) => useToast.getState().push('info', m),
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  const styles: Record<ToastKind, string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-ink text-white',
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto animate-slide-in rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg ${styles[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
