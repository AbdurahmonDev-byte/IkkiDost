'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus } from 'lucide-react';
import type { CategoryDto } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Table, Td, Th } from '@/components/ui';
import { toast } from '@/components/toast';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });
  const categories = categoriesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Kategoriyalar"
        subtitle="Mahsulotlarni guruhlash va tartiblash"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Kategoriya qo‘shish
          </Button>
        }
      />

      <Card>
        {categoriesQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState title="Kategoriya yo‘q" hint="Masalan: Choylar, Salatlar, Taomlar." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tartib</Th>
                <Th>Nomi</Th>
                <Th>Mahsulotlar</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-paper/60">
                  <Td>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                      <GripVertical size={14} /> {c.sortOrder}
                    </span>
                  </Td>
                  <Td className="font-medium">{c.name}</Td>
                  <Td className="text-ink-soft">{c.productCount ?? 0} ta</Td>
                  <Td>
                    <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-ink-soft hover:bg-black/5" title="Tahrirlash">
                      <Pencil size={15} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CategoryFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <CategoryFormModal category={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CategoryFormModal({
  category,
  open,
  onClose,
}: {
  category?: CategoryDto | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setSortOrder(String(category?.sortOrder ?? 0));
  }, [open, category]);

  const mutation = useMutation({
    mutationFn: () =>
      category
        ? api.updateCategory(category.id, { name: name.trim(), sortOrder: Number(sortOrder) })
        : api.createCategory({ name: name.trim(), sortOrder: Number(sortOrder) }),
    onSuccess: () => {
      toast.success(category ? 'Kategoriya yangilandi' : 'Kategoriya yaratildi');
      void qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Saqlanmadi'),
  });

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}>
      <div className="space-y-3">
        <Field label="Nomi">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Choylar" />
        </Field>
        <Field label="Tartib raqami" hint="Kichik raqam avval ko‘rinadi">
          <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button loading={mutation.isPending} disabled={!name.trim()} onClick={() => mutation.mutate()}>
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
