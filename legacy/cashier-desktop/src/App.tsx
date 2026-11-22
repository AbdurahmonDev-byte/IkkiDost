import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, BarChart3, DoorOpen, Loader2, Phone, Printer, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { PrinterSettingsModal } from './pos/PrinterSettings';
import type { PaymentDto } from '@ikki-dost/shared-types';
import { KIOSK_USERNAME, TOKENS_REFRESHED, api, kioskLogin, useAuth } from './lib/api';
import { useRealtime } from './lib/realtime';
import { formatLongDate, formatUzs } from './lib/format';
import { OrderScreen, type OrderTarget } from './pos/OrderScreen';
import { HallScreen, SaboyScreen, TodayScreen, todayTotals } from './pos/Screens';
import { Button, cn } from './ui';

type Screen = { kind: 'hall' } | { kind: 'saboy' } | { kind: 'today' } | { kind: 'order'; target: OrderTarget; from: 'hall' | 'saboy' };

/** No login screen: the terminal connects itself as the `kassa` account. */
export default function App() {
  const user = useAuth((s) => s.user);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await kioskLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Serverga ulanib bo‘lmadi');
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    // Sessions from the old login screen (or a missing one) are replaced by the kiosk account.
    if (!user || user.username !== KIOSK_USERNAME) {
      useAuth.getState().clear();
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep retrying quietly while the server is unreachable.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => void connect(), 10_000);
    return () => clearTimeout(id);
  }, [error, connect]);

  if (user && user.username === KIOSK_USERNAME) return <Pos />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white">
        <Banknote size={30} />
      </div>
      <p className="text-xl font-bold">Ikki Do‘st — Kassa</p>
      {error ? (
        <>
          <p className="flex items-center gap-2 text-sm text-red-600"><WifiOff size={16} /> {error}</p>
          <p className="max-w-md text-xs text-ink-soft">
            Internetni tekshiring. Agar xabar takrorlansa, serverda kassa terminali yoqilmagan (CASHIER_KIOSK) yoki ega «Kassa» xodimini o‘chirib qo‘ygan.
          </p>
          <Button onClick={() => void connect()} loading={connecting}>
            <RefreshCw size={15} /> Qayta urinish
          </Button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" /> Serverga ulanmoqda…</p>
      )}
    </div>
  );
}

function startOfDay(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function Pos() {
  const qc = useQueryClient();
  const [screen, setScreen] = useState<Screen>({ kind: 'hall' });
  const [notice, setNotice] = useState<string | null>(null);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const notify = useCallback((m: string) => {
    setNotice(m);
    setTimeout(() => setNotice((cur) => (cur === m ? null : cur)), 4000);
  }, []);

  const refetchAll = useCallback(() => void qc.invalidateQueries(), [qc]);
  const { connected } = useRealtime(refetchAll);
  useEffect(() => {
    window.addEventListener(TOKENS_REFRESHED, refetchAll);
    return () => window.removeEventListener(TOKENS_REFRESHED, refetchAll);
  }, [refetchAll]);

  // Clock + midnight rollover of the working day.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const dayStart = startOfDay(now);

  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms(), refetchInterval: 15_000 });
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: () => api.orders(), refetchInterval: 15_000 });
  const methodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.paymentMethods() });
  const paymentsQuery = useQuery({
    queryKey: ['payments-today', dayStart],
    queryFn: () => api.payments({ from: dayStart }),
    refetchInterval: 20_000,
  });
  const totals = useMemo(() => todayTotals(paymentsQuery.data ?? []), [paymentsQuery.data]);

  const reverseMutation = useMutation({
    mutationFn: (v: { payment: PaymentDto; reason: string }) => api.reversePayment(v.payment.id, { reason: v.reason }),
    onSuccess: () => {
      notify('To‘lov qaytarildi');
      refetchAll();
    },
    onError: (e) => notify(e instanceof Error ? e.message : 'Qaytarib bo‘lmadi'),
  });

  const rooms = roomsQuery.data ?? [];
  const busyRooms = rooms.filter((r) => r.isActive && r.activeSession).length;
  const openSaboy = (ordersQuery.data ?? []).filter(
    (o) => o.type === 'DELIVERY' && o.status !== 'CANCELLED' && o.outstandingAmount > 0,
  ).length;
  const section = screen.kind === 'order' ? screen.from : screen.kind;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-16 shrink-0 items-center gap-1 border-b border-line bg-white px-4">
        <NavButton active={section === 'hall'} onClick={() => setScreen({ kind: 'hall' })} icon={<DoorOpen size={18} />} label="XONALAR" badge={busyRooms} />
        <NavButton active={section === 'saboy'} onClick={() => setScreen({ kind: 'saboy' })} icon={<Phone size={18} />} label="SABOYLAR" badge={openSaboy} />
        <NavButton active={section === 'today'} onClick={() => setScreen({ kind: 'today' })} icon={<BarChart3 size={18} />} label="KASSA" />

        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white"><Banknote size={18} /></div>
          <span className="text-lg font-extrabold tracking-wide text-primary">IKKI DO‘ST</span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-sm font-semibold xl:inline" title="Bugun kassaga tushgan pul">{formatUzs(totals.cash + totals.card + totals.other)}</span>
          <button onClick={() => setPrinterOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-paper" title="Chek printeri">
            <Printer size={19} />
          </button>
          <button onClick={refetchAll} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-paper" title="Yangilash">
            <RefreshCw size={19} />
          </button>
          <span title={connected ? 'Internet bor' : 'Qayta ulanmoqda'} className={connected ? 'text-ink-soft' : 'text-amber-500'}>
            {connected ? <Wifi size={20} /> : <WifiOff size={20} />}
          </span>
          <div className="border-l border-line pl-4 text-right leading-tight">
            <p className="text-base font-bold">{time}</p>
            <p className="text-[11px] text-ink-faint">{formatLongDate(now)}</p>
          </div>
        </div>
      </header>

      {notice && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">{notice}</div>}

      <main className="min-h-0 flex-1">
        {screen.kind === 'hall' && (
          <HallScreen
            rooms={rooms}
            loading={roomsQuery.isLoading}
            onOpen={(roomId, people) => setScreen({ kind: 'order', target: { kind: 'room', roomId, people }, from: 'hall' })}
          />
        )}
        {screen.kind === 'saboy' && (
          <SaboyScreen
            orders={ordersQuery.data ?? []}
            loading={ordersQuery.isLoading}
            onOpen={(orderId) => setScreen({ kind: 'order', target: { kind: 'saboy', orderId }, from: 'saboy' })}
            onNew={() => setScreen({ kind: 'order', target: { kind: 'saboy', orderId: null }, from: 'saboy' })}
          />
        )}
        {screen.kind === 'today' && (
          <TodayScreen
            payments={paymentsQuery.data ?? []}
            loading={paymentsQuery.isLoading}
            reversing={reverseMutation.isPending}
            onReverse={(payment, reason) => reverseMutation.mutate({ payment, reason })}
          />
        )}
        {screen.kind === 'order' && (
          <OrderScreen
            target={screen.target}
            rooms={rooms}
            methods={methodsQuery.data ?? []}
            notify={notify}
            onBack={() => setScreen({ kind: screen.from })}
            onTargetChange={(target) => setScreen({ ...screen, target })}
          />
        )}
      </main>
      <PrinterSettingsModal open={printerOpen} onClose={() => setPrinterOpen(false)} notify={notify} />
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold tracking-wide transition active:scale-95',
        active ? 'bg-[#243b31] text-white' : 'text-ink hover:bg-paper',
      )}
    >
      {icon} {label}
      {badge ? (
        <span className={cn('rounded-full px-2 text-xs', active ? 'bg-white/20' : 'bg-paper')}>{badge}</span>
      ) : null}
    </button>
  );
}
