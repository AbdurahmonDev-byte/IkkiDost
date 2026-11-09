'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, Input, PageHeader, Select, Spinner, Table, Td, Th } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [limit, setLimit] = useState(200);

  const logsQuery = useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: () => api.auditLogs(limit),
  });

  const logs = logsQuery.data ?? [];
  const entities = useMemo(() => [...new Set(logs.map((l) => l.entity))].sort(), [logs]);
  const filtered = logs.filter((l) => {
    if (entity && l.entity !== entity) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.action.toLowerCase().includes(q) ||
      l.actorName.toLowerCase().includes(q) ||
      JSON.stringify(l.details ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader title="Audit jurnali" subtitle="Tizimdagi barcha muhim amallar tarixi" />

      <Card>
        <div className="flex flex-wrap items-end gap-2 border-b border-line/70 px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Amal, xodim yoki tafsilot…"
              className="pl-9"
            />
          </div>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Barcha obyektlar</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} className="w-auto">
            <option value="100">100 yozuv</option>
            <option value="200">200 yozuv</option>
            <option value="500">500 yozuv</option>
          </Select>
        </div>

        {logsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Yozuv topilmadi" hint="Filtrni o‘zgartirib ko‘ring." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Vaqt</Th>
                <Th>Xodim</Th>
                <Th>Amal</Th>
                <Th>Obyekt</Th>
                <Th>Tafsilotlar</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-paper/60">
                  <Td className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(l.createdAt)}</Td>
                  <Td className="font-medium">{l.actorName}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-primary" />
                      <span className="font-mono text-xs">{l.action}</span>
                    </span>
                  </Td>
                  <Td>
                    <Badge tone="primary">{l.entity}</Badge>
                  </Td>
                  <Td className="max-w-[360px]">
                    <code className="block truncate text-[11px] text-ink-soft" title={JSON.stringify(l.details ?? {})}>
                      {l.details ? JSON.stringify(l.details) : '—'}
                    </code>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
