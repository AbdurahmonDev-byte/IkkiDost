'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, ImagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { MeasurementUnit, ProductDto, ProductStatus } from '@ikki-dost/shared-types';
import { api } from '@/lib/api';
import { imageSrc } from '@/lib/image';
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
} from '@/components/ui';
import { toast } from '@/components/toast';
import { formatUzs, productStatusLabel, unitLabel } from '@/lib/format';

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [imageFor, setImageFor] = useState<ProductDto | null>(null);

  const productsQuery = useQuery({
    queryKey: ['products', { includeArchived: true }],
    queryFn: () => api.products({ includeArchived: true }),
  });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });

  const all = productsQuery.data ?? [];
  const filtered = all.filter((p) => {
    if (categoryId && p.categoryId !== categoryId) return false;
    if (status && p.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        subtitle={`${all.length} ta mahsulot · ${all.filter((p) => p.status === 'ACTIVE').length} faol`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Mahsulot qo‘shish
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot nomi…" className="bg-white pl-9" />
        </div>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-auto min-w-[160px] bg-white">
          <option value="">Barcha kategoriyalar</option>
          {(categoriesQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[140px] bg-white">
          <option value="">Barcha holatlar</option>
          {(Object.keys(productStatusLabel) as ProductStatus[]).map((s) => (
            <option key={s} value={s}>
              {productStatusLabel[s]}
            </option>
          ))}
        </Select>
      </div>

      {productsQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="Mahsulot topilmadi" hint="Filtrni tozalang yoki yangi mahsulot qo‘shing." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <button className="group relative block h-36 w-full overflow-hidden bg-paper" onClick={() => setImageFor(p)}>
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageSrc(p.thumbnailUrl)!} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-faint">
                    <ImageOff size={26} />
                    <span className="text-[11px]">Rasm yo‘q — qo‘shish</span>
                  </div>
                )}
                <span className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                  <span className="flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
                    <ImagePlus size={12} /> Rasm
                  </span>
                </span>
              </button>

              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-[11px] text-ink-faint">{p.categoryName ?? '—'} · {unitLabel[p.unit]}</p>
                  </div>
                  <Badge tone={p.status === 'ACTIVE' ? 'green' : p.status === 'DISABLED' ? 'amber' : 'neutral'}>
                    {productStatusLabel[p.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-base font-bold text-primary-700">{formatUzs(p.price)}</p>
                <p className="text-[11px] text-ink-soft">Tannarx {formatUzs(p.costPrice)} · foyda {formatUzs(p.price - p.costPrice)}</p>
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                    <Pencil size={13} /> Tahrirlash
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setImageFor(p)} title="Rasm">
                    <ImagePlus size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProductFormModal open={creating} onClose={() => setCreating(false)} />
      <ProductFormModal product={editing} open={!!editing} onClose={() => setEditing(null)} />
      <ImageModal product={imageFor} onClose={() => setImageFor(null)} />
    </div>
  );
}

function ProductFormModal({ product, open, onClose }: { product?: ProductDto | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.categories(), enabled: open });
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState<MeasurementUnit>('PIECE');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [status, setStatus] = useState<ProductStatus>('ACTIVE');

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setCategoryId(product?.categoryId ?? '');
    setUnit(product?.unit ?? 'PIECE');
    setPrice(product ? String(product.price) : '');
    setCostPrice(product ? String(product.costPrice) : '');
    setStatus(product?.status ?? 'ACTIVE');
  }, [open, product]);

  const current = { name, categoryId, unit, price, costPrice, status };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: current.name.trim(),
        categoryId: current.categoryId,
        unit: current.unit,
        price: Number(current.price),
        costPrice: Number(current.costPrice),
        status: current.status,
      };
      return product ? api.updateProduct(product.id, payload) : api.createProduct(payload);
    },
    onSuccess: () => {
      toast.success(product ? 'Mahsulot yangilandi' : 'Mahsulot yaratildi');
      setName('');
      setPrice('');
      void qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Saqlanmadi'),
  });

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} wide>
      <div className="space-y-3">
        <Field label="Nomi">
          <Input value={current.name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Oq choy" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kategoriya">
            <Select value={current.categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tanlang…</option>
              {(categoriesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="O‘lchov birligi">
            <Select value={current.unit} onChange={(e) => setUnit(e.target.value as MeasurementUnit)}>
              {(Object.keys(unitLabel) as MeasurementUnit[]).map((u) => (
                <option key={u} value={u}>
                  {unitLabel[u]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Narx (so‘m)" hint="Butun son — masalan 12000">
            <Input type="number" min={1} value={current.price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Tannarx (so‘m)" hint="Mahsulotni sotib olish narxi">
            <Input type="number" min={0} value={current.costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Holat">
            <Select value={current.status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
              {(Object.keys(productStatusLabel) as ProductStatus[]).map((s) => (
                <option key={s} value={s}>
                  {productStatusLabel[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!current.name.trim() || !current.categoryId || !(Number(current.price) > 0) || !Number.isInteger(Number(current.costPrice)) || Number(current.costPrice) < 0}
            onClick={() => mutation.mutate()}
          >
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImageModal({ product, onClose }: { product: ProductDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!product || !file) throw new Error('Fayl tanlanmagan');
      const fd = new FormData();
      fd.append('image', file);
      return api.uploadProductImage(product.id, fd);
    },
    onSuccess: () => {
      toast.success('Rasm yuklandi');
      setFile(null);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Yuklanmadi'),
  });

  const removeMutation = useMutation({
    mutationFn: () => api.deleteProductImage(product!.id),
    onSuccess: () => {
      toast.success('Rasm o‘chirildi');
      void qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'O‘chirilmadi'),
  });

  if (!product) return null;
  const existing = imageSrc(product.imageUrl);

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <Modal open={!!product} onClose={onClose} title={`Rasm — ${product.name}`}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-paper ring-1 ring-line/70">
          {preview || existing ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview ?? existing!} alt={product.name} className="mx-auto max-h-64 object-contain" />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-ink-faint">
              <ImageOff size={26} />
              <span className="text-xs">Rasm yo‘q</span>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-ink-soft">JPEG, PNG yoki WebP · maksimal 5 MB. Rasm avtomatik siqiladi va thumbnail yaratiladi.</p>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          {existing && !preview && (
            <Button
              variant="ghost"
              className="mr-auto text-red-500"
              loading={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              <Trash2 size={14} /> O‘chirish
            </Button>
          )}
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} /> {existing ? 'Almashtirish' : 'Tanlash'}
          </Button>
          <Button disabled={!file} loading={uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
            Yuklash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
