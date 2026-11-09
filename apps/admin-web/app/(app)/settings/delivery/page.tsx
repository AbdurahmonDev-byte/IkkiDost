'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Save, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, CardHeader, PageHeader, Spinner, Table, Td, Th } from '@/components/ui';
import { toast } from '@/components/toast';
import { deliveryStatusLabel, roleLabel } from '@/lib/format';

const FLOW = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export default function DeliverySettingsPage() {
  const qc = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['service-fee'], queryFn: () => api.serviceFeeConfig() });
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => api.employees() });

  const [applyToDelivery, setApplyToDelivery] = useState(false);
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState('5000');
  useEffect(() => {
    if (settingsQuery.data) {
      setApplyToDelivery(settingsQuery.data.applyToDelivery);
      setDeliveryFeeAmount(String(settingsQuery.data.deliveryFeeAmount ?? 5000));
    }
  }, [settingsQuery.data]);

  const feeMutation = useMutation({
    mutationFn: () => api.updateServiceFeeConfig({ applyToDelivery, deliveryFeeAmount: Number(deliveryFeeAmount) }),
    onSuccess: () => {
      toast.success('Saqlandi');
      void qc.invalidateQueries({ queryKey: ['service-fee'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Saqlanmadi'),
  });

  const permissionMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => api.updateEmployee(id, { canCreateDelivery: value }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Ruxsat yangilandi');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yangilanmadi'),
  });

  const staff = (employeesQuery.data ?? []).filter((e) => e.role === 'WAITER' || e.role === 'CASHIER');

  return (
    <div>
      <PageHeader title="Yetkazib berish sozlamalari" subtitle="Xizmat haqi, ruxsatlar va jarayon" />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Yetkazib berish jarayoni" subtitle="Holatlar faqat quyidagi tartibda o‘zgaradi" />
          <div className="flex flex-wrap items-center gap-1.5 p-5">
            {FLOW.map((status, i) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                  {deliveryStatusLabel[status]}
                </span>
                {i < FLOW.length - 1 && <ArrowRight size={13} className="text-ink-faint" />}
              </span>
            ))}
            <span className="ml-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">Bekor qilindi</span>
          </div>
          <div className="border-t border-line px-5 py-4 text-xs text-ink-soft">
            <p>
              Buyurtma yaratilganda holat avtomatik <b>CONFIRMED</b> bo‘ladi. Har bir o‘tish audit jurnaliga yoziladi. Yetkazilgandan keyin
              to‘lov to‘liq bo‘lsa, buyurtma yakunlanadi.
            </p>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Xizmat haqi" subtitle="Yetkazib berish buyurtmalari uchun" />
          <div className="space-y-4 p-5">
            <Field label="Yetkazib berish narxi (so‘m)" hint="Har bir delivery buyurtmasiga bir marta qo‘shiladi">
              <Input type="number" min={0} value={deliveryFeeAmount} onChange={(e) => setDeliveryFeeAmount(e.target.value)} />
            </Field>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Xizmat haqi qo‘llansin</p>
                <p className="mt-0.5 text-xs text-ink-soft">Har bir buyurtmaga snapshot sifatida qo‘shiladi</p>
              </div>
              <input
                type="checkbox"
                checked={applyToDelivery}
                onChange={(e) => setApplyToDelivery(e.target.checked)}
                className="h-5 w-5 accent-primary"
              />
            </label>
            <Button className="w-full" loading={feeMutation.isPending} disabled={!Number.isInteger(Number(deliveryFeeAmount)) || Number(deliveryFeeAmount) < 0} onClick={() => feeMutation.mutate()}>
              <Save size={15} /> Saqlash
            </Button>
            <p className="text-[11px] text-ink-faint">
              Umumiy xizmat haqi miqdori «Xizmat haqi» bo‘limida sozlanadi.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Yetkazish yaratish ruxsati" subtitle="Qaysi xodimlar yetkazib berish buyurtmasini ocha oladi" />
        {employeesQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Xodim</Th>
                <Th>Rol</Th>
                <Th>Ruxsat</Th>
                <Th>Holat</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <p className="font-medium">{e.fullName}</p>
                    <p className="text-[11px] text-ink-faint">@{e.username}</p>
                  </Td>
                  <Td className="text-xs text-ink-soft">{roleLabel[e.role]}</Td>
                  <Td>
                    <button
                      onClick={() => permissionMutation.mutate({ id: e.id, value: !e.canCreateDelivery })}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        e.canCreateDelivery ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      <Truck size={11} />
                      {e.canCreateDelivery ? 'Ruxsat bor' : 'Ruxsat yo‘q'}
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={e.isActive ? 'green' : 'red'}>{e.isActive ? 'Faol' : 'Faolsiz'}</Badge>
                  </Td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <Td colSpan={4} className="py-10 text-center text-sm text-ink-soft">
                    Ofitsiant yoki kassir yo‘q.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
