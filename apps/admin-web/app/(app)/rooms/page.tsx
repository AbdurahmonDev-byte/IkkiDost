'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Eye, Pencil, Plus, Power } from 'lucide-react';
import type { RoomDto } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { formatDateTime, formatUzs, orderStatusLabel, timeAgo } from '@/lib/format';

export default function RoomsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RoomDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.rooms(),
    refetchInterval: 20_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (room: RoomDto) => api.updateRoom(room.id, { isActive: !room.isActive }),
    onSuccess: () => {
      toast.success('Xona yangilandi');
      void qc.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yangilanmadi'),
  });

  const rooms = roomsQuery.data ?? [];
  const active = rooms.filter((r) => r.activeSession);
  const occupiedTotal = active.reduce((s, r) => s + (r.activeSession?.outstandingAmount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Xonalar"
        subtitle={`${rooms.length} ta xona · ${active.length} ta band · ochiq qarz ${formatUzs(occupiedTotal)}`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Xona qo‘shish
          </Button>
        }
      />

      {roomsQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState title="Xonalar yo‘q" hint="Birinchi xonani qo‘shing." action={<Button onClick={() => setCreating(true)}>Xona qo‘shish</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const s = room.activeSession;
            return (
              <Card key={room.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s ? 'bg-primary text-white' : 'bg-primary-50 text-primary-700'}`}>
                      <DoorOpen size={19} />
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{room.name}</p>
                      <p className="text-[11px] text-ink-soft">{room.isActive ? 'Faol' : 'O‘chirilgan'}</p>
                    </div>
                  </div>
                  <Badge tone={s ? 'green' : 'neutral'}>{s ? 'Band' : 'Bo‘sh'}</Badge>
                </div>

                {s ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-paper px-3 py-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-ink-faint">Buyurtma</p>
                      <p className="text-sm font-bold">{s.orderCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-ink-faint">Jami</p>
                      <p className="text-sm font-bold">{formatUzs(s.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-ink-faint">Qarz</p>
                      <p className={`text-sm font-bold ${s.outstandingAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {formatUzs(s.outstandingAmount)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-paper px-3 py-4 text-center text-xs text-ink-soft">
                    Hozircha ochiq sessiya yo‘q. Ofitsiant buyurtma yaratganda ochiladi.
                  </p>
                )}

                <div className="mt-auto flex items-center gap-1.5 pt-3">
                  {s && (
                    <Button size="sm" variant="secondary" onClick={() => setDetailId(s.id)}>
                      <Eye size={14} /> Sessiya
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(room)} title="Tahrirlash">
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleMutation.mutate(room)}
                    title={room.isActive ? 'O‘chirish' : 'Faollashtirish'}
                    className={room.isActive ? 'text-red-500' : 'text-emerald-600'}
                  >
                    <Power size={14} />
                  </Button>
                  <span className="ml-auto text-[10px] text-ink-faint">
                    {s ? `${timeAgo(s.openedAt)} ochilgan` : formatDateTime(room.createdAt)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RoomFormModal open={creating} onClose={() => setCreating(false)} />
      <RoomFormModal room={editing} open={!!editing} onClose={() => setEditing(null)} />
      <SessionModal sessionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function RoomFormModal({ room, open, onClose }: { room?: RoomDto | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => (room ? api.updateRoom(room.id, { name }) : api.createRoom({ name })),
    onSuccess: () => {
      toast.success(room ? 'Xona yangilandi' : 'Xona yaratildi');
      setName('');
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Xatolik';
      setError(msg);
      toast.error(msg);
    },
  });

  const value = room ? (name || room.name) : name;

  return (
    <Modal open={open} onClose={onClose} title={room ? 'Xonani tahrirlash' : 'Yangi xona'}>
      <Field label="Xona nomi" error={error}>
        <Input
          value={value}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Masalan: 1-xona"
        />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Bekor qilish
        </Button>
        <Button loading={mutation.isPending} disabled={!value.trim()} onClick={() => mutation.mutate()}>
          Saqlash
        </Button>
      </div>
    </Modal>
  );
}

function SessionModal({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.roomSession(sessionId!),
    enabled: !!sessionId,
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      api.closeRoomSession(sessionId!, {
        overrideReason: overrideReason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Sessiya yopildi');
      setCloseOpen(false);
      setOverrideReason('');
      void qc.invalidateQueries({ queryKey: ['session', sessionId] });
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yopib bo‘lmadi'),
  });

  const hasDebt = (data?.outstandingAmount ?? 0) > 0;

  return (
    <Modal open={!!sessionId} onClose={onClose} title="Xona sessiyasi" wide>
      {isLoading || !data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-paper px-3 py-2">
              <p className="text-[10px] uppercase text-ink-faint">Jami</p>
              <p className="text-sm font-bold">{formatUzs(data.totalAmount)}</p>
            </div>
            <div className="rounded-xl bg-paper px-3 py-2">
              <p className="text-[10px] uppercase text-ink-faint">To‘langan</p>
              <p className="text-sm font-bold text-emerald-700">{formatUzs(data.paidAmount)}</p>
            </div>
            <div className="rounded-xl bg-paper px-3 py-2">
              <p className="text-[10px] uppercase text-ink-faint">Qarz</p>
              <p className={`text-sm font-bold ${hasDebt ? 'text-red-600' : 'text-emerald-700'}`}>{formatUzs(data.outstandingAmount)}</p>
            </div>
            <div className="rounded-xl bg-paper px-3 py-2">
              <p className="text-[10px] uppercase text-ink-faint">Ochilgan</p>
              <p className="text-xs font-semibold">{formatDateTime(data.openedAt)}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Buyurtmalar</p>
            {data.orders.length === 0 ? (
              <p className="text-sm text-ink-soft">Buyurtma yo‘q.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Holat</Th>
                    <Th className="text-right">Jami</Th>
                    <Th className="text-right">Qarz</Th>
                    <Th>Vaqt</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <Td className="font-mono font-semibold">#{o.orderNumber}</Td>
                      <Td>{orderStatusLabel[o.status]}</Td>
                      <Td className="text-right">{formatUzs(o.totalAmount)}</Td>
                      <Td className="text-right">{formatUzs(o.outstandingAmount)}</Td>
                      <Td className="text-xs text-ink-soft">{formatDateTime(o.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">To‘lovlar</p>
            {data.payments.length === 0 ? (
              <p className="text-sm text-ink-soft">To‘lov qilinmagan.</p>
            ) : (
              <div className="divide-y divide-line/60 rounded-xl ring-1 ring-line/70">
                {data.payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-semibold">{formatUzs(p.amount)}</span>
                    <span className="text-xs text-ink-soft">{p.methodName}</span>
                    {p.reversedAt && <Badge tone="red">Qaytarilgan</Badge>}
                    <span className="ml-auto text-[11px] text-ink-faint">{formatDateTime(p.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="secondary" onClick={onClose}>
              Yopish
            </Button>
            <Button variant={hasDebt ? 'danger' : 'primary'} onClick={() => setCloseOpen(true)}>
              Sessiyani yopish
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Sessiyani yopish"
        message={
          hasDebt
            ? 'Diqqat: bu sessiyada qarz mavjud. Yopish uchun sabab kiritishingiz shart — bu audit jurnaliga yoziladi.'
            : 'Barcha buyurtmalar yakunlanadi va xona bo‘shatiladi.'
        }
        confirmLabel="Yopish"
        danger={hasDebt}
        loading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
      >
        {hasDebt && (
          <Field label="Egasi izohi (majburiy)">
            <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Nima uchun qarz bilan yopilmoqda?" />
          </Field>
        )}
      </ConfirmDialog>
    </Modal>
  );
}
