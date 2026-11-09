'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wallet } from 'lucide-react';
import type { ExpenseDto } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { formatDate, formatDateTime, formatUzs, rangeDefault } from '@/lib/format';

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState(rangeDefault());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ExpenseDto | null>(null);

  const expensesQuery = useQuery({
    queryKey: ['expenses', range],
    queryFn: () => api.expenses({ from: `${range.from}T00:00:00.000Z`, to: `${range.to}T23:59:59.999Z` }),
  });

  const expenses = expensesQuery.data ?? [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const key = e.category || 'Boshqa';
      map.set(key, (map.get(key) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteExpense(deleting!.id),
    onSuccess: () => {
      toast.success('Xarajat o‘chirildi');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'O‘chirilmadi'),
  });

  return (
    <div>
      <PageHeader
        title="Xarajatlar"
        subtitle="Kunlik xarajatlarni kiritish va nazorat qilish"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Xarajat qo‘shish
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Davr xarajati" value={formatUzs(total)} hint={`${expenses.length} ta yozuv`} icon={<Wallet size={18} />} tone="red" />
        {byCategory.slice(0, 2).map(([cat, amount]) => (
          <StatCard key={cat} label={cat} value={formatUzs(amount)} hint="Kategoriya bo‘yicha" icon={<Wallet size={18} />} tone="amber" />
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-end gap-2 border-b border-line/70 px-4 py-3">
          <Field label="Boshlanish">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-auto" />
          </Field>
          <Field label="Tugash">
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-auto" />
          </Field>
        </div>

        {expensesQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState title="Xarajat yo‘q" hint="Tanlangan davrda xarajat kiritilmagan." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sana</Th>
                <Th>Nomi</Th>
                <Th>Kategoriya</Th>
                <Th>Izoh</Th>
                <Th className="text-right">Summa</Th>
                <Th>Kiritgan</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-paper/60">
                  <Td className="text-xs text-ink-soft">{formatDate(e.spentAt)}</Td>
                  <Td className="font-medium">{e.title}</Td>
                  <Td>{e.category || '—'}</Td>
                  <Td className="max-w-[220px] truncate text-xs text-ink-soft">{e.note || '—'}</Td>
                  <Td className="text-right font-semibold text-red-600">{formatUzs(e.amount)}</Td>
                  <Td className="text-xs text-ink-soft">{e.createdByName}</Td>
                  <Td>
                    <button onClick={() => setDeleting(e)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="O‘chirish">
                      <Trash2 size={15} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateExpenseModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Xarajatni o‘chirish">
        <p className="text-sm text-ink-soft">{deleting ? `“${deleting.title}” — ${formatUzs(deleting.amount)} o‘chiriladi.` : ''}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Bekor qilish
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            O‘chirish
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: () =>
      api.createExpense({
        title: title.trim(),
        amount: Number(amount),
        category: category.trim() || null,
        note: note.trim() || null,
        spentAt: new Date(`${spentAt}T12:00:00`).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Xarajat kiritildi');
      setTitle('');
      setAmount('');
      setCategory('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Kiritilmadi'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi xarajat">
      <div className="space-y-3">
        <Field label="Nomi">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Go‘sht xaridi" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa (so‘m)">
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Kategoriya">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Masalan: Oziq-ovqat" list="expense-categories" />
            <datalist id="expense-categories">
              <option value="Oziq-ovqat" />
              <option value="Kommunal" />
              <option value="Ijara" />
              <option value="Ish haqi" />
              <option value="Ta’mirlash" />
            </datalist>
          </Field>
        </div>
        <Field label="Sana">
          <Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </Field>
        <Field label="Izoh (ixtiyoriy)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button loading={mutation.isPending} disabled={!title.trim() || !(Number(amount) > 0)} onClick={() => mutation.mutate()}>
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
