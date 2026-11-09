'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Receipt, Save } from 'lucide-react';
import type { ServiceFeeMethod } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { toast } from '@/components/toast';
import { feeMethodLabel, formatDateTime, formatUzs } from '@/lib/format';

export default function ServiceFeePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['service-fee'], queryFn: () => api.serviceFeeConfig() });

  const [enabled, setEnabled] = useState(true);
  const [amount, setAmount] = useState('4000');
  const [dineIn, setDineIn] = useState(true);
  const [delivery, setDelivery] = useState(true);
  const [method, setMethod] = useState<ServiceFeeMethod>('PER_PERSON');

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setAmount(String(data.amountPerPerson));
    setDineIn(data.applyToDineIn);
    setDelivery(data.applyToDelivery);
    setMethod(data.method);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      api.updateServiceFeeConfig({
        enabled,
        amountPerPerson: Number(amount),
        applyToDineIn: dineIn,
        applyToDelivery: delivery,
        method,
      }),
    onSuccess: () => {
      toast.success('Xizmat haqi sozlamalari saqlandi');
      void qc.invalidateQueries({ queryKey: ['service-fee'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Saqlanmadi'),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const example = method === 'PER_PERSON' ? Number(amount) * 4 : Number(amount);

  return (
    <div>
      <PageHeader title="Xizmat haqi" subtitle="Har bir buyurtmaga qo‘shiladigan xizmat haqi" />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sozlamalar" subtitle={`Oxirgi o‘zgarish: ${formatDateTime(data.updatedAt)}`} />
          <div className="space-y-4 p-5">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-paper px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Xizmat haqi yoqilgan</p>
                <p className="text-xs text-ink-soft">O‘chirilsa, yangi buyurtmalarga haq qo‘shilmaydi</p>
              </div>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-primary" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bir kishi uchun (so‘m)" hint="Butun son, masalan 4 000">
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Hisoblash usuli">
                <Select value={method} onChange={(e) => setMethod(e.target.value as ServiceFeeMethod)}>
                  {(Object.keys(feeMethodLabel) as ServiceFeeMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {feeMethodLabel[m]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
                <span className="text-sm font-medium">Zal buyurtmalariga</span>
                <input type="checkbox" checked={dineIn} onChange={(e) => setDineIn(e.target.checked)} className="h-5 w-5 accent-primary" />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
                <span className="text-sm font-medium">Yetkazib berishga</span>
                <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="h-5 w-5 accent-primary" />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-4">
              <p className="text-xs text-ink-soft">
                Misol: 4 kishilik buyurtma → <span className="font-semibold text-ink">{formatUzs(example)}</span>
              </p>
              <Button loading={mutation.isPending} disabled={Number(amount) < 0} onClick={() => mutation.mutate()}>
                <Save size={15} /> Saqlash
              </Button>
            </div>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Muhim eslatma" />
          <div className="space-y-3 p-5 text-sm text-ink-soft">
            <p className="flex gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-primary" />
              Har bir buyurtma yaratilganda xizmat haqi hisoblanadi va <b className="text-ink">saqlanadi (snapshot)</b>.
            </p>
            <p>Keyinchalik bu sozlamani o‘zgartirsangiz, eski buyurtmalarning cheki va summasi o‘zgarmaydi.</p>
            <p>Mahsulot qo‘shilganda xizmat haqi qayta hisoblanmaydi — u buyurtma yaratilganda bir marta olinadi.</p>
            <div className="rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-700">
              <Receipt size={13} className="mr-1 inline" />
              Joriy holat: {enabled ? 'yoqilgan' : 'o‘chirilgan'} · {formatUzs(data.amountPerPerson)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
