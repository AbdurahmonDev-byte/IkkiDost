import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Repeat } from 'lucide-react';
import type { PaymentMethodDto } from '@ikki-dost/shared-types';
import { formatUzs } from '../lib/format';
import { Button, Modal, cn } from '../ui';
import { Keypad } from './Keypad';

type Focus = 'amount' | 'given';

export interface PayInput {
  amount: number;
  methodId: string;
  closeAfter: boolean;
}

/**
 * POS payment screen: method buttons, amount on a keypad (defaults to the
 * whole balance), and for cash the amount handed over with the change due.
 */
export function PaymentDialog({
  open,
  title,
  outstanding,
  methods,
  canCloseAfter,
  loading,
  onClose,
  onPay,
}: {
  open: boolean;
  title: string;
  outstanding: number;
  methods: PaymentMethodDto[];
  /** Rooms: offer to close the table after a full payment. */
  canCloseAfter: boolean;
  loading: boolean;
  onClose: () => void;
  onPay: (input: PayInput) => void;
}) {
  const active = methods.filter((m) => m.isActive);
  const [methodId, setMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [given, setGiven] = useState('');
  const [focus, setFocus] = useState<Focus>('amount');
  const [closeAfter, setCloseAfter] = useState(true);

  useEffect(() => {
    if (!open) return;
    const cash = active.find((m) => m.kind === 'CASH') ?? active[0];
    setMethodId(cash?.id ?? '');
    setAmount(String(outstanding));
    setGiven('');
    setFocus('amount');
    setCloseAfter(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outstanding]);

  const method = active.find((m) => m.id === methodId);
  const isCash = method?.kind === 'CASH';
  const amountN = Number(amount) || 0;
  const givenN = Number(given) || 0;
  const change = isCash && givenN > amountN ? givenN - amountN : 0;
  const tooMuch = amountN > outstanding;
  const short = isCash && given !== '' && givenN < amountN;
  const valid = amountN > 0 && !tooMuch && !!methodId && !short;
  const full = amountN === outstanding;

  const submit = () => {
    if (!valid || loading) return;
    onPay({ amount: amountN, methodId, closeAfter: canCloseAfter && full && closeAfter });
  };

  const icon = (m: PaymentMethodDto) =>
    m.kind === 'CASH' ? <Banknote size={20} /> : m.kind === 'CARD' ? <CreditCard size={20} /> : <Repeat size={20} />;

  return (
    <Modal open={open} onClose={onClose} title={title} xl>
      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {active.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMethodId(m.id);
                  if (m.kind !== 'CASH') {
                    setGiven('');
                    setFocus('amount');
                  }
                }}
                className={cn(
                  'flex h-16 items-center justify-center gap-2 rounded-xl text-base font-semibold ring-1 transition',
                  m.id === methodId ? 'bg-primary text-white ring-primary' : 'bg-white text-ink ring-line hover:bg-paper',
                )}
              >
                {icon(m)} {m.name}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
            <div className="flex items-center justify-between text-sm text-ink-soft">
              <span>Qarz</span>
              <span className="font-semibold text-ink">{formatUzs(outstanding)}</span>
            </div>
            <button
              type="button"
              onClick={() => setFocus('amount')}
              className={cn(
                'mt-3 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left ring-2',
                focus === 'amount' ? 'ring-primary' : 'ring-transparent',
              )}
            >
              <span className="text-sm text-ink-soft">To‘lanadigan summa</span>
              <span className={cn('text-2xl font-bold', tooMuch && 'text-red-600')}>{formatUzs(amountN)}</span>
            </button>
            {isCash && (
              <button
                type="button"
                onClick={() => setFocus('given')}
                className={cn(
                  'mt-2 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left ring-2',
                  focus === 'given' ? 'ring-primary' : 'ring-transparent',
                )}
              >
                <span className="text-sm text-ink-soft">Mijoz berdi</span>
                <span className={cn('text-2xl font-bold', short && 'text-red-600')}>{given ? formatUzs(givenN) : '—'}</span>
              </button>
            )}
            {isCash && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
                <span className="text-sm font-semibold text-emerald-800">Qaytim</span>
                <span className="text-2xl font-bold text-emerald-700">{formatUzs(change)}</span>
              </div>
            )}
            {tooMuch && <p className="mt-2 text-sm text-red-600">Summa qarzdan oshmasligi kerak.</p>}
            {short && <p className="mt-2 text-sm text-red-600">Mijoz bergan pul to‘lov summasidan kam.</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <QuickButton onClick={() => { setAmount(String(outstanding)); setFocus('amount'); }}>To‘liq</QuickButton>
            {isCash &&
              [50_000, 100_000, 200_000, 500_000].map((v) => (
                <QuickButton key={v} onClick={() => { setGiven(String(v)); setFocus('given'); }}>
                  {formatUzs(v)}
                </QuickButton>
              ))}
          </div>

          {canCloseAfter && (
            <label className={cn('flex items-center gap-3 rounded-xl px-1 text-sm', !full && 'opacity-50')}>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#1d5c3f]"
                checked={closeAfter && full}
                disabled={!full}
                onChange={(e) => setCloseAfter(e.target.checked)}
              />
              To‘lovdan keyin xonani yopish
            </label>
          )}
        </div>

        <div className="space-y-3">
          <Keypad
            value={focus === 'amount' ? amount : given}
            onChange={(v) => (focus === 'amount' ? setAmount(v) : setGiven(v))}
            onEnter={submit}
          />
          <Button size="lg" variant="success" className="h-16 w-full text-lg" disabled={!valid} loading={loading} onClick={submit}>
            Qabul qilish · {formatUzs(amountN)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function QuickButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-line hover:bg-paper active:scale-95"
    >
      {children}
    </button>
  );
}
