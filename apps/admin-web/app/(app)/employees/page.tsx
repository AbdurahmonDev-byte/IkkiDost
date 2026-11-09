'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, Truck } from 'lucide-react';
import type { EmployeeDto, Role } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { formatDateTime, roleLabel } from '@/lib/format';

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDto | null>(null);

  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => api.employees() });
  const employees = employeesQuery.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: (e: EmployeeDto) => api.updateEmployee(e.id, { isActive: !e.isActive }),
    onSuccess: () => {
      toast.success('Holat yangilandi');
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yangilanmadi'),
  });

  const deliveryMutation = useMutation({
    mutationFn: (e: EmployeeDto) => api.updateEmployee(e.id, { canCreateDelivery: !e.canCreateDelivery }),
    onSuccess: () => {
      toast.success('Yetkazish ruxsati yangilandi');
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yangilanmadi'),
  });

  return (
    <div>
      <PageHeader
        title="Xodimlar"
        subtitle={`${employees.length} ta xodim · ${employees.filter((e) => e.isActive).length} faol`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Xodim qo‘shish
          </Button>
        }
      />

      <Card>
        {employeesQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : employees.length === 0 ? (
          <EmptyState title="Xodimlar yo‘q" hint="Birinchi xodimni qo‘shing." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Xodim</Th>
                <Th>Rol</Th>
                <Th>Telefon</Th>
                <Th>Yetkazish</Th>
                <Th>Holat</Th>
                <Th>Qo‘shilgan</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-paper/60">
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-700">
                        {e.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium leading-tight">{e.fullName}</p>
                        <p className="text-[11px] text-ink-faint">@{e.username}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={e.role === 'OWNER' ? 'primary' : e.role === 'CHEF' ? 'amber' : 'blue'}>{roleLabel[e.role]}</Badge>
                  </Td>
                  <Td className="text-ink-soft">{e.phone || '—'}</Td>
                  <Td>
                    {e.role === 'OWNER' ? (
                      <span className="text-xs text-ink-faint">Barcha huquqlar</span>
                    ) : e.role === 'WAITER' ? (
                      <button
                        onClick={() => deliveryMutation.mutate(e)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          e.canCreateDelivery ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                        }`}
                        title="Yetkazish yaratish ruxsatini almashtirish"
                      >
                        <Truck size={11} /> {e.canCreateDelivery ? 'Ruxsat bor' : 'Ruxsat yo‘q'}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={e.isActive ? 'green' : 'red'}>{e.isActive ? 'Faol' : 'Faolsiz'}</Badge>
                  </Td>
                  <Td className="text-xs text-ink-soft">{formatDateTime(e.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(e)} className="rounded-lg p-1.5 text-ink-soft hover:bg-black/5" title="Tahrirlash">
                        <Pencil size={15} />
                      </button>
                      {e.role !== 'OWNER' && (
                        <button
                          onClick={() => toggleMutation.mutate(e)}
                          className={`rounded-lg p-1.5 hover:bg-black/5 ${e.isActive ? 'text-red-500' : 'text-emerald-600'}`}
                          title={e.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}
                        >
                          <Power size={15} />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <EmployeeFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EmployeeFormModal employee={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EmployeeFormModal({
  employee,
  open,
  onClose,
}: {
  employee?: EmployeeDto | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('WAITER');
  const [canCreateDelivery, setCanCreateDelivery] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(employee?.fullName ?? '');
    setUsername(employee?.username ?? '');
    setPassword('');
    setPhone(employee?.phone ?? '');
    setRole(employee?.role ?? 'WAITER');
    setCanCreateDelivery(employee?.canCreateDelivery ?? false);
  }, [open, employee]);

  const mutation = useMutation({
    mutationFn: () => {
      if (employee) {
        return api.updateEmployee(employee.id, {
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim() || null,
          role,
          canCreateDelivery,
          ...(password ? { password } : {}),
        });
      }
      return api.createEmployee({
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        phone: phone.trim() || null,
        role,
        canCreateDelivery,
      });
    },
    onSuccess: () => {
      toast.success(employee ? 'Xodim yangilandi' : 'Xodim yaratildi');
      void qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Saqlanmadi'),
  });

  const valid =
    fullName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    (!employee ? password.length >= 6 : password === '' || password.length >= 6);

  return (
    <Modal open={open} onClose={onClose} title={employee ? 'Xodimni tahrirlash' : 'Yangi xodim'}>
      <div className="space-y-3">
        <Field label="F.I.Sh.">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ism familiya" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Login">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" placeholder="ofitsiant2" />
          </Field>
          <Field label={employee ? 'Yangi parol (ixtiyoriy)' : 'Parol'} hint="Kamida 6 belgi">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rol">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(roleLabel) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Telefon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998…" />
          </Field>
        </div>
        {role === 'WAITER' && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={canCreateDelivery}
              onChange={(e) => setCanCreateDelivery(e.target.checked)}
              className="accent-primary"
            />
            Yetkazib berish buyurtmasini yaratishga ruxsat
          </label>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button loading={mutation.isPending} disabled={!valid} onClick={() => mutation.mutate()}>
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
