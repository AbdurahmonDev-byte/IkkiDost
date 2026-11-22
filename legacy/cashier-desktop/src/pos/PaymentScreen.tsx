import { useState } from 'react';
import { ArrowLeft, ChevronsRight, CreditCard, Delete } from 'lucide-react';
import type { PaymentMethodDto } from '@ikki-dost/shared-types';
import { api } from '../lib/api';
import { uuid } from '../lib/format';
import { Spinner, cn } from '../ui';

const num = (n: number) => new Intl.NumberFormat('ru-RU').format(n).replace(/ /g, ' ');

/**
 * Full-screen payment: cash typed on the keypad (with change), or a cashless
 * method for the rest. A mixed payment records the cashless part first, then cash.
 */
export function PaymentScreen({
  title,
  outstanding,
  methods,
  isRoom,
  target,
  onBack,
  onDone,
  notify,
}: {
  title: string;
  outstanding: number;
  methods: PaymentMethodDto[];
  isRoom: boolean;
  target: { kind: 'session' | 'order'; id: string };
  onBack: () => void;
  onDone: (r: { fullyPaid: boolean; printCheck: boolean }) => void | Promise<void>;
  notify: (m: string) => void;
}) {
  const active = methods.filter((m) => m.isActive);
  const cash = active.find((m) => m.kind === 'CASH');
  const cashless = active.filter((m) => m.kind !== 'CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [cardMethod, setCardMethod] = useState<PaymentMethodDto | null>(null);
  const [printCheck, setPrintCheck] = useState(true);
  const [busy, setBusy] = useState(false);

  const cashN = Number(cashGiven) || 0;
  const cardAmount = cardMethod ? Math.max(0, outstanding - Math.min(cashN, outstanding)) : 0;
  const cashPart = Math.min(cashN, outstanding - cardAmount);
  const change = cashN - cashPart;
  const covered = cashPart + cardAmount;
  const diff = cashN + cardAmount - outstanding; // shown as "Qaytim" (negative = still owed)
  const canPay = !busy && !!target.id && covered > 0 && outstanding > 0;

  const press = (k: string) => {
    if (k === 'C') return setCashGiven('');
    if (k === '⌫') return setCashGiven((v) => v.slice(0, -1));
    if (k === '.') return;
    setCashGiven((v) => (v.length >= 9 ? v : v === '0' ? k : v + k));
  };
  const add = (n: number) => setCashGiven((v) => String((Number(v) || 0) + n));

  const confirm = async () => {
    if (!canPay) return;
    if (covered < outstanding && !window.confirm(`To‘liq emas: ${num(outstanding - covered)} so‘m qarz qoladi. Qisman to‘lansinmi?`)) return;
    setBusy(true);
    const pay = (amount: number, methodId: string) => {
      const body = { amount, methodId, note: null, idempotencyKey: uuid() };
      return target.kind === 'session' ? api.payRoomSession(target.id, body) : api.payOrder(target.id, body);
    };
    try {
      if (cardMethod && cardAmount > 0) await pay(cardAmount, cardMethod.id);
      if (cashPart > 0) {
        if (!cash) throw new Error('Naqd to‘lov usuli topilmadi');
        await pay(cashPart, cash.id);
      }
      notify(`To‘lov qabul qilindi: ${num(covered)} so‘m${change > 0 ? ` · qaytim ${num(change)} so‘m` : ''}`);
      await onDone({ fullyPaid: covered >= outstanding, printCheck });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'To‘lov amalga oshmadi');
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <button onClick={onBack} disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-paper" title="Orqaga">
          <ArrowLeft size={22} />
        </button>
        <p className="text-lg font-bold">{title} — to‘lov</p>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-4">
        <div className="mb-6 flex justify-center gap-20 text-center">
          <div>
            <p className="text-sm font-semibold text-ink-soft">Jami to‘lov (UZS)</p>
            <p className="mt-1 text-3xl font-bold">{target.id ? num(outstanding) : <Spinner />}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-soft">Qaytim (UZS)</p>
            <p className={cn('mt-1 text-3xl font-bold', diff < 0 ? 'text-red-600' : 'text-emerald-700')}>{num(diff)}</p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Naqd pul to‘lovi</p>
              <div className="flex h-16 items-center rounded-lg px-4 ring-2 ring-primary">
                <span className={cn('flex-1 text-2xl', cashGiven ? 'font-bold' : 'text-ink-faint')}>{cashGiven ? num(cashN) : '0'}</span>
                <button
                  onClick={() => setCashGiven(String(Math.max(0, outstanding - cardAmount) || outstanding))}
                  className="h-11 rounded-md bg-[#eceef2] px-4 text-sm font-semibold hover:bg-[#e1e4e9]"
                >
                  Aniq summa
                </button>
              </div>
            </div>
            <label className="flex h-14 items-center justify-between rounded-lg bg-primary-50 px-4 text-sm font-semibold">
              Chekni chop etish
              <input type="checkbox" className="h-6 w-6 accent-[#1d5c3f]" checked={printCheck} onChange={(e) => setPrintCheck(e.target.checked)} />
            </label>

            <div>
              <p className="mb-2 mt-2 text-sm font-semibold">Naqd pulsiz to‘lov</p>
              <div className="grid grid-cols-3 gap-2">
                {cashless.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setCardMethod(cardMethod?.id === m.id ? null : m)}
                    className={cn(
                      'flex h-16 items-center justify-center gap-2 rounded-lg text-base font-semibold ring-1',
                      cardMethod?.id === m.id ? 'bg-primary text-white ring-primary' : 'bg-white ring-line hover:bg-paper',
                    )}
                  >
                    <CreditCard size={20} /> {m.name}
                  </button>
                ))}
              </div>
              {cardMethod && (
                <p className="mt-2 text-sm text-ink-soft">
                  {cardMethod.name}: <b className="text-ink">{num(cardAmount)} so‘m</b>
                  {cashPart > 0 ? ` · naqd: ${num(cashPart)} so‘m` : ''}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="grid grid-cols-4 gap-2">
              {['1', '2', '3'].map((k) => <PadKey key={k} onClick={() => press(k)}>{k}</PadKey>)}
              <QuickKey onClick={() => add(50_000)}>+50 000</QuickKey>
              {['4', '5', '6'].map((k) => <PadKey key={k} onClick={() => press(k)}>{k}</PadKey>)}
              <QuickKey onClick={() => add(100_000)}>+100 000</QuickKey>
              {['7', '8', '9'].map((k) => <PadKey key={k} onClick={() => press(k)}>{k}</PadKey>)}
              <QuickKey onClick={() => add(200_000)}>+200 000</QuickKey>
              <PadKey onClick={() => press('⌫')}><Delete size={20} /></PadKey>
              <PadKey onClick={() => press('0')}>0</PadKey>
              <PadKey onClick={() => press('000')}>000</PadKey>
              <PadKey onClick={() => press('C')}>C</PadKey>
            </div>
            <button
              onClick={() => void confirm()}
              disabled={!canPay}
              className="mt-3 flex h-16 w-full items-center justify-center gap-3 rounded-lg bg-primary text-lg font-bold text-white hover:bg-primary-700 disabled:bg-primary/40"
            >
              {busy ? <Spinner className="text-white" /> : null}
              {covered < outstanding && covered > 0 ? 'Qisman to‘lash' : 'Tasdiqlash'}
              <ChevronsRight size={24} />
            </button>
            {isRoom && <p className="mt-2 text-center text-xs text-ink-soft">To‘liq to‘lansa xona avtomatik yopiladi.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PadKey({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-16 items-center justify-center rounded-lg bg-[#eceef2] text-xl font-medium hover:bg-[#e1e4e9] active:scale-95">
      {children}
    </button>
  );
}

function QuickKey({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-16 items-center justify-center rounded-lg bg-[#243b31] text-base font-semibold text-white hover:bg-[#1b2d25] active:scale-95">
      {children}
    </button>
  );
}
