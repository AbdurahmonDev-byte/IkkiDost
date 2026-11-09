'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bell,
  BookOpenText,
  Boxes,
  ChefHat,
  ClipboardList,
  CreditCard,
  DoorOpen,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings2,
  ShieldCheck,
  Truck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { cn, Spinner } from '@/components/ui';

const nav = [
  {
    group: 'Asosiy',
    items: [
      { href: '/dashboard', label: 'Boshqaruv paneli', icon: LayoutDashboard },
      { href: '/orders', label: 'Buyurtmalar', icon: ClipboardList },
      { href: '/rooms', label: 'Xonalar', icon: DoorOpen },
      { href: '/delivery', label: 'Yetkazib berish', icon: Truck },
    ],
  },
  {
    group: 'Katalog',
    items: [
      { href: '/products', label: 'Mahsulotlar', icon: ChefHat },
      { href: '/categories', label: 'Kategoriyalar', icon: Boxes },
    ],
  },
  {
    group: 'Moliya',
    items: [
      { href: '/payments', label: 'To‘lovlar', icon: CreditCard },
      { href: '/expenses', label: 'Xarajatlar', icon: Wallet },
      { href: '/reports', label: 'Hisobotlar', icon: TrendingUp },
    ],
  },
  {
    group: 'Boshqaruv',
    items: [
      { href: '/employees', label: 'Xodimlar', icon: Users },
      { href: '/notifications', label: 'Bildirishnomalar', icon: Bell },
      { href: '/audit-logs', label: 'Audit jurnali', icon: ShieldCheck },
      { href: '/settings/service-fee', label: 'Xizmat haqi', icon: Receipt },
      { href: '/settings/delivery', label: 'Yetkazish sozlamalari', icon: Truck },
      { href: '/settings/system', label: 'Tizim', icon: Settings2 },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const clear = useAuth((s) => s.clear);
  const { connected } = useRealtime();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'OWNER') router.replace('/login');
  }, [hydrated, user, router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  function logout() {
    clear();
    router.replace('/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <Gauge size={21} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">Ikki Do‘st</p>
          <p className="truncate text-[11px] text-ink-soft">Boshqaruv paneli</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {nav.map((section) => (
          <div key={section.group} className="mb-4">
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">{section.group}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition',
                        active ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-black/5 hover:text-ink',
                      )}
                    >
                      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
            {user.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user.fullName}</p>
            <p className="truncate text-[11px] text-ink-faint">@{user.username}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-1.5 text-ink-soft hover:bg-black/5" title="Chiqish">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-white lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <button className="absolute right-2 top-2 rounded-lg p-1.5 text-ink-soft hover:bg-black/5" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur lg:px-6">
          <button className="rounded-lg p-1.5 text-ink-soft hover:bg-black/5 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-500')} />
            {connected ? 'Real vaqt rejimi' : 'Ulanmoqda…'}
          </div>
          <div className="hidden text-xs text-ink-faint sm:block">
            {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
