'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Spinner, StatCard, Table, Td, Th } from '@/components/ui';
import { formatDate, formatUzs, paymentKindLabel, rangeDefault, roleLabel } from '@/lib/format';

const COLORS = ['#1d5c3f', '#2e7f5b', '#7fbfa0', '#d99434'];

export default function ReportsPage() {
  const [range, setRange] = useState(rangeDefault());

  const { data, isLoading } = useQuery({
    queryKey: ['report', range],
    queryFn: () => api.report(range.from, range.to),
  });

  function exportCsv() {
    if (!data) return;
    const rows: string[][] = [
      ['Ko‘rsatkich', 'Qiymat'],
      ['Davr', `${data.from} — ${data.to}`],
      ['Tushum', String(data.revenue)],
      ['Xarajat', String(data.expenses)],
      ['Foyda', String(data.profit)],
      ['Xizmat haqi', String(data.serviceFeeTotal)],
      ['Buyurtmalar', String(data.orderCount)],
      ['Zal tushumi', String(data.dineInRevenue)],
      ['Yetkazish tushumi', String(data.deliveryRevenue)],
      [],
      ['To‘lov usuli', 'Summa', 'Soni'],
      ...data.paymentsByMethod.map((p) => [p.methodName, String(p.amount), String(p.count)]),
      [],
      ['Mahsulot', 'Miqdor', 'Tushum'],
      ...data.topProducts.map((p) => [p.productName, p.quantity, String(p.revenue)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisobot-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Hisobotlar"
        subtitle="Davr bo‘yicha moliyaviy tahlil"
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!data}>
            <Download size={15} /> CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-2 p-4">
          <Field label="Boshlanish">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-auto" />
          </Field>
          <Field label="Tugash">
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-auto" />
          </Field>
          <div className="flex gap-1.5 pb-0.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const now = new Date();
                setRange({ from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) });
              }}
            >
              Bu oy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const now = new Date();
                setRange({ from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) });
              }}
            >
              Oxirgi 30 kun
            </Button>
          </div>
        </div>
      </Card>

      {isLoading || !data ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tushum" value={formatUzs(data.revenue)} hint={`${data.orderCount} ta buyurtma`} icon={<TrendingUp size={18} />} />
            <StatCard label="Xarajat" value={formatUzs(data.expenses)} hint="Davr xarajatlari" icon={<TrendingDown size={18} />} tone="red" />
            <StatCard label="Foyda" value={formatUzs(data.profit)} hint="Tushum − xarajat" icon={<Wallet size={18} />} tone={data.profit >= 0 ? 'primary' : 'red'} />
            <StatCard label="Xizmat haqi" value={formatUzs(data.serviceFeeTotal)} hint="Buyurtmalardagi fee" icon={<Wallet size={18} />} tone="amber" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Tushum taqsimoti" subtitle={`Zal: ${formatUzs(data.dineInRevenue)} · Yetkazish: ${formatUzs(data.deliveryRevenue)}`} />
              <div className="h-56 px-2 py-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Zalda', value: data.dineInRevenue },
                      { name: 'Yetkazish', value: data.deliveryRevenue },
                    ]}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eceae4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8a958d' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#8a958d' }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip formatter={(v: number) => formatUzs(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e7e4dc', fontSize: 12 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {[0, 1].map((i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="To‘lov usullari" subtitle="Davr bo‘yicha" />
              {data.paymentsByMethod.length === 0 ? (
                <EmptyState title="To‘lov yo‘q" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Usul</Th>
                      <Th>Turi</Th>
                      <Th className="text-right">Soni</Th>
                      <Th className="text-right">Summa</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.paymentsByMethod.map((p) => (
                      <tr key={p.methodName}>
                        <Td className="font-medium">{p.methodName}</Td>
                        <Td className="text-xs text-ink-soft">{paymentKindLabel[p.kind]}</Td>
                        <Td className="text-right">{p.count}</Td>
                        <Td className="text-right font-semibold">{formatUzs(p.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Top mahsulotlar" subtitle="Tushum bo‘yicha" />
              {data.topProducts.length === 0 ? (
                <EmptyState title="Ma’lumot yo‘q" />
              ) : (
                <div className="divide-y divide-line/60">
                  {data.topProducts.slice(0, 10).map((p, i) => (
                    <div key={p.productName} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper text-[11px] font-bold text-ink-soft">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.productName}</p>
                        <p className="text-[11px] text-ink-faint">{Number(p.quantity)} ta</p>
                      </div>
                      <span className="text-xs font-semibold text-primary-700">{formatUzs(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Xodimlar samaradorligi" subtitle="Buyurtma va tushum" />
              {data.employeePerformance.length === 0 ? (
                <EmptyState title="Ma’lumot yo‘q" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Xodim</Th>
                      <Th>Rol</Th>
                      <Th className="text-right">Buyurtma</Th>
                      <Th className="text-right">Tushum</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employeePerformance.map((e) => (
                      <tr key={e.employeeName}>
                        <Td className="font-medium">{e.employeeName}</Td>
                        <Td className="text-xs text-ink-soft">{roleLabel[e.role]}</Td>
                        <Td className="text-right">{e.ordersCreated}</Td>
                        <Td className="text-right font-semibold">{formatUzs(e.revenueHandled)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>

          <p className="mt-4 text-center text-[11px] text-ink-faint">
            Davr: {formatDate(data.from)} — {formatDate(data.to)}
          </p>
        </>
      )}
    </div>
  );
}
