'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { toast } from '@/components/toast';
import { formatDateTime, timeAgo } from '@/lib/format';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    refetchInterval: 30_000,
  });

  const notifications = notificationsQuery.data ?? [];
  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications),
    [notifications, filter],
  );
  const unread = notifications.filter((n) => !n.readAt).length;

  const readMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      toast.success('Barchasi o‘qilgan deb belgilandi');
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Xatolik'),
  });

  return (
    <div>
      <PageHeader
        title="Bildirishnomalar"
        subtitle={`${unread} ta o‘qilmagan`}
        actions={
          <Button variant="secondary" disabled={unread === 0} loading={readAllMutation.isPending} onClick={() => readAllMutation.mutate()}>
            <CheckCheck size={15} /> Barchasini o‘qish
          </Button>
        }
      />

      <div className="mb-3 flex gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === 'all' ? 'bg-primary text-white' : 'bg-white text-ink-soft ring-1 ring-line'}`}
        >
          Barchasi ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === 'unread' ? 'bg-primary text-white' : 'bg-white text-ink-soft ring-1 ring-line'}`}
        >
          O‘qilmagan ({unread})
        </button>
      </div>

      <Card>
        {notificationsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="Bildirishnoma yo‘q" hint="Yangi voqealar shu yerda ko‘rinadi." />
        ) : (
          <div className="divide-y divide-line/60">
            {visible.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.readAt && readMutation.mutate(n.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-paper/60 ${n.readAt ? '' : 'bg-primary-50/30'}`}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.readAt ? 'bg-paper text-ink-faint' : 'bg-primary-50 text-primary-700'}`}>
                  <Bell size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{n.title}</span>
                    <Badge tone={n.type === 'ITEM_READY' ? 'green' : 'primary'}>{n.type}</Badge>
                    {!n.readAt && <Circle size={7} className="fill-primary text-primary" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-ink-faint" title={formatDateTime(n.createdAt)}>
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
