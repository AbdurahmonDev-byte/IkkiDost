'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  DoorOpen,
  Receipt,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner, StatCard } from '@/components/ui';
import { formatDateTime, formatNumber, formatQty, formatUzs, timeAgo } from '@/lib/format';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard(),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const chart = data.revenueByDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }),
    revenue: d.revenue,
    expenses: d.expenses,
  }));

  return (
    <div>
      <PageHeader title="Boshqaruv paneli" subtitle="Bugungi holat va oxirgi 7 kunlik dinamika" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Bugungi tushum"
          value={formatUzs(data.todayRevenue)}
          hint={`${data.todayOrderCount} buyurtma · qarz ${formatUzs(data.unpaidOutstanding)}`}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Sof foyda"
          value={formatUzs(data.todayProfit)}
          hint="Tushum − xarajat − tannarx"
          icon={<TrendingUp size={18} />}
          tone={data.todayProfit >= 0 ? 'primary' : 'red'}
        />
        <StatCard
          label="Mahsulot tannarxi"
          value={formatUzs(data.todayCostOfGoods)}
          hint="Bugun sotilgan mahsulotlar"
          icon={<Wallet size={18} />}
          tone="blue"
        />
        <StatCard
          label="Xizmat haqi (bugun)"
          value={formatUzs(data.serviceFeeRevenueToday)}
          hint="Buyurtmalarga qo‘shilgan"
          icon={<Receipt size={18} />}
          tone="amber"
        />
        <StatCard
          label="Bugungi xarajat"
          value={formatUzs(data.todayExpenses)}
          hint="Kiritilgan xarajatlar"
          icon={<Wallet size={18} />}
          tone="red"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <DoorOpen size={18} />
          </div>
          <div>
            <p className="text-xs text-ink-soft">Faol xonalar</p>
            <p className="text-lg font-bold">{data.activeRooms}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Users size={18} />
          </div>
          <div>
            <p className="text-xs text-ink-soft">Zaldagi buyurtmalar</p>
            <p className="text-lg font-bold">{data.activeDineInOrders}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Truck size={18} />
          </div>
          <div>
            <p className="text-xs text-ink-soft">Yetkazib berish</p>
            <p className="text-lg font-bold">{data.activeDeliveryOrders}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <ClipboardList size={18} />
          </div>
          <div>
            <p className="text-xs text-ink-soft">Ochiq qarz</p>
            <p className="text-lg font-bold">{formatUzs(data.unpaidOutstanding)}</p>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Tushum va xarajat" subtitle="Oxirgi 7 kun" />
          <div className="h-64 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d5c3f" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1d5c3f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d99434" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#d99434" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceae4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a958d' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8a958d' }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatUzs(value), name === 'revenue' ? 'Tushum' : 'Xarajat']}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e7e4dc', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#1d5c3f" strokeWidth={2} fill="url(#rev)" />
                <Area type="monotone" dataKey="expenses" stroke="#d99434" strokeWidth={2} fill="url(#exp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Mashhur mahsulotlar" subtitle="Bugun bo‘yicha" />
          <div className="divide-y divide-line/60">
            {data.popularProducts.length === 0 ? (
              <EmptyState title="Ma’lumot yo‘q" hint="Bugun hali buyurtma berilmagan." />
            ) : (
              data.popularProducts.slice(0, 7).map((p, i) => (
                <div key={p.productName} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-bold text-ink-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.productName}</p>
                    <p className="text-[11px] text-ink-faint">{formatNumber(Number(p.quantity))} ta</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-primary-700">{formatUzs(p.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="So‘nggi harakatlar" subtitle="Audit jurnalidan" action={<ArrowUpRight size={16} className="text-ink-faint" />} />
        <div className="divide-y divide-line/60">
          {data.recentActivity.length === 0 ? (
            <EmptyState title="Harakatlar yo‘q" />
          ) : (
            data.recentActivity.slice(0, 8).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <Badge tone="primary">{a.entity}</Badge>
                <span className="font-medium">{a.action}</span>
                <span className="text-xs text-ink-soft">{a.actorName}</span>
                <span className="ml-auto text-[11px] text-ink-faint" title={formatDateTime(a.createdAt)}>
                  {timeAgo(a.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
