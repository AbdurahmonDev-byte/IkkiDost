'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Database, ExternalLink, Server, Smartphone, Monitor, Info } from 'lucide-react';
import { API_URL, api } from '@/lib/api';
import { Badge, Card, CardHeader, PageHeader, Spinner } from '@/components/ui';
import { formatDateTime, formatUzs } from '@/lib/format';

const ROLE_MATRIX: Array<{ role: string; rights: string[] }> = [
  { role: 'Ega (OWNER)', rights: ['Barcha bo‘limlar', 'Narx va sozlamalar', 'Qarz bilan yopish (sabab bilan)', 'Qaytarish va audit'] },
  { role: 'Ofitsiant (WAITER)', rights: ['Xonalar va buyurtmalar', 'Mahsulot qo‘shish', 'Buyurtma holati', 'Yetkazish (ruxsat bo‘lsa)'] },
  { role: 'Oshpaz (CHEF)', rights: ['Oshxona ekrani', 'Mahsulotni tayyorlash', 'Tayyor deb belgilash'] },
  { role: 'Kassir (CASHIER)', rights: ['To‘lovlar va qaytarishlar', 'Xarajatlar', 'Sessiyani yopish', 'Yetkazish holati'] },
];

export default function SystemSettingsPage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const origin = API_URL.replace(/\/api\/?$/, '');
      const res = await fetch(`${origin}/api/health`);
      if (!res.ok) throw new Error('API javob bermadi');
      return (await res.json()) as { status: string; timestamp?: string };
    },
    refetchInterval: 30_000,
  });

  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: () => api.dashboard() });
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms() });
  const productsQuery = useQuery({ queryKey: ['products', { includeArchived: true }], queryFn: () => api.products({ includeArchived: true }) });
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => api.employees() });
  const feeQuery = useQuery({ queryKey: ['service-fee'], queryFn: () => api.serviceFeeConfig() });

  const loading = roomsQuery.isLoading || productsQuery.isLoading || employeesQuery.isLoading || feeQuery.isLoading;

  return (
    <div>
      <PageHeader title="Tizim" subtitle="Ulanish holati, ma’lumotlar va ruxsatlar matritsasi" />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Tizim holati" subtitle="Real vaqtda tekshiriladi" />
          <div className="divide-y divide-line/60">
            <Row icon={<Server size={16} />} label="API manzili" value={API_URL} />
            <Row
              icon={<Database size={16} />}
              label="Backend va baza"
              value={
                healthQuery.isLoading ? (
                  <Spinner />
                ) : healthQuery.isError ? (
                  <Badge tone="red">Ulanmagan</Badge>
                ) : (
                  <Badge tone="green">
                    <CheckCircle2 size={11} /> {healthQuery.data?.status ?? 'ok'}
                  </Badge>
                )
              }
            />
            <Row icon={<Info size={16} />} label="Oxirgi tekshiruv" value={healthQuery.data?.timestamp ? formatDateTime(healthQuery.data.timestamp) : new Date().toLocaleTimeString('uz-UZ')} />
            <Row icon={<Info size={16} />} label="Ilova versiyasi" value="0.1.0 · MVP" />
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Ma’lumotlar bazasi" />
          {loading || !feeQuery.data ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2 p-4 text-sm">
              <Stat label="Xonalar" value={String(roomsQuery.data?.length ?? 0)} />
              <Stat label="Mahsulotlar" value={`${productsQuery.data?.length ?? 0} ta`} />
              <Stat label="Xodimlar" value={`${employeesQuery.data?.length ?? 0} ta`} />
              <Stat label="Xizmat haqi" value={`${formatUzs(feeQuery.data.amountPerPerson)} / kishi`} />
              <Stat label="Bugungi tushum" value={formatUzs(dashboardQuery.data?.todayRevenue ?? 0)} />
              <Stat label="Ochiq qarz" value={formatUzs(dashboardQuery.data?.unpaidOutstanding ?? 0)} />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Ruxsatlar matritsasi" subtitle="Backend tomonidan majburiy tekshiriladi" />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {ROLE_MATRIX.map((r) => (
            <div key={r.role} className="rounded-xl bg-paper p-3">
              <p className="text-sm font-semibold">{r.role}</p>
              <ul className="mt-1.5 space-y-1">
                {r.rights.map((right) => (
                  <li key={right} className="flex items-start gap-1.5 text-[11px] text-ink-soft">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-primary" />
                    {right}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Ilovalar" subtitle="Ekotizim komponentlari" />
          <div className="space-y-2 p-4">
            <AppRow icon={<Monitor size={16} />} name="Admin panel" detail="Next.js · port 3001" status="Ishlaydi" />
            <AppRow icon={<Server size={16} />} name="Oshxona paneli" detail="Next.js · iPhone Safari uchun · port 3002" status="Ishlaydi" />
            <AppRow icon={<Monitor size={16} />} name="Kassir dasturi" detail="Tauri 2 + React · port 5173" status="Manba tayyor" />
            <AppRow icon={<Smartphone size={16} />} name="Mobil ilova" detail="Expo / React Native · Android" status="Manba tayyor" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Muhim cheklovlar" subtitle="Halol holat" />
          <div className="space-y-2.5 p-4 text-xs text-ink-soft">
            <p>
              <b className="text-ink">APK:</b> ushbu muhitda Android SDK yo‘qligi sababli APK yig‘ilmagan. Build qo‘llanmasi
              <code className="mx-1 rounded bg-paper px-1 py-0.5">DEPLOYMENT.md</code>da.
            </p>
            <p>
              <b className="text-ink">Windows EXE:</b> Linux muhitida Windows installer yig‘ilmagan. Tauri konfiguratsiyasi tayyor,
              CI/Windows muhitida yig‘iladi.
            </p>
            <p className="flex items-center gap-1">
              <ExternalLink size={12} /> Batafsil: <code className="rounded bg-paper px-1 py-0.5">PROJECT_STATUS.md</code>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-ink-soft">{icon}</span>
      <span className="text-ink-soft">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
      <span className="text-xs text-ink-soft">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function AppRow({ icon, name, detail, status }: { icon: React.ReactNode; name: string; detail: string; status: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-[11px] text-ink-faint">{detail}</p>
      </div>
      <Badge tone={status === 'Ishlaydi' ? 'green' : 'amber'}>{status}</Badge>
    </div>
  );
}
