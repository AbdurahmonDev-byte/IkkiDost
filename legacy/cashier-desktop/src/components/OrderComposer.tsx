import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Minus, Plus, Search, ShoppingBag, Trash2, Truck, UtensilsCrossed } from 'lucide-react';
import type { OrderDto, ProductDto, RoomDto, ServiceFeeConfigDto } from '@ikki-dost/shared-types';
import { computeServiceFee, lineTotalUzs } from '@ikki-dost/utils';
import { api } from '../lib/api';
import {
  formatQty,
  formatUzs,
  isMassUnit,
  quantityForApi,
  sanitizeQtyInput,
} from '../lib/format';
import { Badge, Button, Field, Input, Modal, Select, Spinner, Textarea, cn } from '../ui';

export type ComposerMode = 'DINE_IN' | 'DELIVERY';

interface Props {
  mode: ComposerMode;
  rooms: RoomDto[];
  /** When set, new items are appended to this existing order. */
  targetOrder?: OrderDto;
  onClose: () => void;
  onCreated: (order: OrderDto) => void;
}

export function OrderComposer({ mode, rooms, targetOrder, onClose, onCreated }: Props) {
  const isDelivery = mode === 'DELIVERY';
  const isAdding = Boolean(targetOrder);
  const [roomId, setRoomId] = useState('');
  const [people, setPeople] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => api.products() });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });
  const feeQuery = useQuery({ queryKey: ['service-fee'], queryFn: () => api.serviceFeeConfig() });

  const products = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.status === 'ACTIVE'),
    [productsQuery.data],
  );
  const categories = categoriesQuery.data ?? [];
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, categoryId, search]);

  const cart = cartIds
    .map((id) => byId.get(id))
    .filter((p): p is ProductDto => Boolean(p))
    .map((product) => ({ product, qty: qtyMap[product.id] ?? '' }));

  const itemsTotal = cart.reduce((sum, line) => {
    const qty = Number(line.qty);
    if (!(qty > 0)) return sum;
    return sum + lineTotalUzs(line.product.price, qty);
  }, 0);

  const numberOfPeople = Math.max(0, Math.floor(Number(people) || 0));
  const feeConfig: ServiceFeeConfigDto | undefined = feeQuery.data;
  const fee = !isAdding && feeConfig ? computeServiceFee(feeConfig, mode, numberOfPeople) : null;
  const feeAmount = fee?.amount ?? 0;

  const saveMutation = useMutation({
    mutationFn: (items: Array<{ productId: string; quantity: string }>) =>
      targetOrder
        ? api.addOrderItems(targetOrder.id, { items })
        : api.createOrder(
            isDelivery
              ? {
                  type: 'DELIVERY',
                  numberOfPeople,
                  note: note.trim() || null,
                  items,
                  customerName: customerName.trim(),
                  customerPhone: customerPhone.trim(),
                  address: address.trim(),
                }
              : {
                  type: 'DINE_IN',
                  roomId,
                  numberOfPeople,
                  note: note.trim() || null,
                  items,
                },
          ),
    onSuccess: (order) => onCreated(order),
    onError: (e) => setError(e instanceof Error ? e.message : 'Buyurtmani saqlab bo‘lmadi'),
  });

  const addProduct = (product: ProductDto) => {
    setError(null);
    const step = isMassUnit(product.unit) ? 0.5 : 1;
    const current = Number(qtyMap[product.id] ?? 0) || 0;
    const next = quantityForApi(current + step);
    setCartIds((ids) => (ids.includes(product.id) ? ids : [...ids, product.id]));
    setQtyMap((map) => ({ ...map, [product.id]: next }));
  };

  const changeQty = (product: ProductDto, delta: number) => {
    const current = Number(qtyMap[product.id] ?? 0) || 0;
    const next = quantityForApi(Math.max(0, current + delta));
    if (!(Number(next) > 0)) {
      removeProduct(product.id);
      return;
    }
    setQtyMap((map) => ({ ...map, [product.id]: next }));
  };

  const typeQty = (product: ProductDto, value: string) => {
    setError(null);
    const next = isMassUnit(product.unit) ? sanitizeQtyInput(value) : value.replace(/[^\d]/g, '').slice(0, 4);
    setCartIds((ids) => (ids.includes(product.id) ? ids : [...ids, product.id]));
    setQtyMap((map) => ({ ...map, [product.id]: next }));
  };

  const removeProduct = (productId: string) => {
    setCartIds((ids) => ids.filter((id) => id !== productId));
    setQtyMap((map) => {
      const next = { ...map };
      delete next[productId];
      return next;
    });
  };

  const submit = () => {
    setError(null);
    if (cart.length === 0) {
      setError('Kamida bitta mahsulot qo‘shing');
      return;
    }
    for (const line of cart) {
      const qty = Number(line.qty);
      if (!(qty > 0)) {
        setError(`«${line.product.name}» miqdorini to‘g‘rilang`);
        return;
      }
      if (!isMassUnit(line.product.unit) && !Number.isInteger(qty)) {
        setError(`«${line.product.name}» dona bilan sotiladi — butun son kiriting`);
        return;
      }
    }
    if (!isAdding) {
      if (!isDelivery && !roomId) {
        setError('Xonani tanlang');
        return;
      }
      if (isDelivery) {
        if (customerName.trim().length < 2) {
          setError('Mijoz ismini kiriting');
          return;
        }
        if (customerPhone.trim().length < 4) {
          setError('Mijoz telefon raqamini kiriting');
          return;
        }
        if (address.trim().length < 3) {
          setError('Manzilni kiriting');
          return;
        }
      }
    }

    const items = cart.map((line) => ({
      productId: line.product.id,
      quantity: quantityForApi(Number(line.qty)),
    }));

    saveMutation.mutate(items);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        isAdding
          ? `#${targetOrder!.orderNumber} ga mahsulot qo‘shish`
          : isDelivery
            ? 'Yangi saboy — uydan buyurtma'
            : 'Yangi buyurtma — zalga'
      }
      xl
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="min-w-0">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish…"
              className="h-9 pl-8 text-xs"
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <CategoryChip active={!categoryId} onClick={() => setCategoryId(null)}>
              Hammasi
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </CategoryChip>
            ))}
          </div>

          <div className="mt-2 h-[360px] overflow-y-auto rounded-xl ring-1 ring-line/70">
            {productsQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : visibleProducts.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-ink-soft">Mahsulot topilmadi</p>
            ) : (
              <div className="divide-y divide-line/60">
                {visibleProducts.map((p) => {
                  const qty = qtyMap[p.id];
                  const inCart = cartIds.includes(p.id) && Number(qty) > 0;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2',
                        inCart ? 'bg-primary-50/60' : 'hover:bg-paper/60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-[11px] text-ink-soft">
                          {formatUzs(p.price)} / {unitLabel(p.unit)}
                        </p>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              changeQty(p, -(isMassUnit(p.unit) ? 0.1 : 1))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white ring-1 ring-line hover:bg-paper"
                            title="Kamaytirish"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            value={qty}
                            onChange={(e) => typeQty(p, e.target.value)}
                            inputMode={isMassUnit(p.unit) ? 'decimal' : 'numeric'}
                            aria-label={`Miqdor: ${p.name}`}
                            className="h-7 w-14 rounded-lg border border-line bg-white text-center text-xs outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => changeQty(p, isMassUnit(p.unit) ? 0.1 : 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white ring-1 ring-line hover:bg-paper"
                            title="Ko‘paytirish"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => addProduct(p)}>
                          <Plus size={13} /> Qo‘shish
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0">
          {isAdding ? (
            <div className="rounded-xl bg-paper/70 px-3 py-2.5 text-xs text-ink-soft">
              <p className="font-semibold text-ink">Buyurtma #{targetOrder!.orderNumber}</p>
              <p className="mt-0.5">
                {targetOrder!.type === 'DELIVERY'
                  ? `${targetOrder!.delivery?.customerName ?? 'Mijoz'} · ${targetOrder!.delivery?.address ?? ''}`
                  : targetOrder!.roomName ?? 'Zal buyurtmasi'}
              </p>
              <p className="mt-0.5">
                Mavjud summa: <span className="font-semibold text-ink">{formatUzs(targetOrder!.totalAmount)}</span>
              </p>
            </div>
          ) : isDelivery ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mijoz ismi">
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ism" />
                </Field>
                <Field label="Telefon">
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+998 90 000 00 00"
                    inputMode="tel"
                  />
                </Field>
              </div>
              <Field label="Manzil">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Uy, ko‘cha, mo‘ljal" />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Xona">
                <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Xonani tanlang…</option>
                  {rooms
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.activeSession ? ' — hisob ochiq' : ''}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Odam soni">
                <Input
                  type="number"
                  min={0}
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  inputMode="numeric"
                />
              </Field>
            </div>
          )}

          {!isAdding && (
            <div className="mt-3 flex items-center gap-2">
              {isDelivery ? (
                <>
                  <Badge tone="blue">
                    <Truck size={11} /> Saboy
                  </Badge>
                  <label className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-soft">
                    Odam soni
                    <input
                      type="number"
                      min={0}
                      value={people}
                      onChange={(e) => setPeople(e.target.value)}
                      className="h-7 w-14 rounded-lg border border-line bg-white text-center text-xs outline-none focus:border-primary"
                    />
                  </label>
                </>
              ) : (
                <Badge tone="amber">
                  <UtensilsCrossed size={11} /> Zal buyurtmasi
                </Badge>
              )}
            </div>
          )}

          <div className="mt-3 rounded-xl bg-paper/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                <ShoppingBag size={13} /> Savat
              </p>
              <span className="text-[11px] text-ink-soft">{cart.length} ta mahsulot</span>
            </div>

            {cart.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-soft">
                Chapdan mahsulot tanlang. Kg/litr mahsulotlar uchun aniq miqdor kiritiladi.
              </p>
            ) : (
              <div className="max-h-[190px] space-y-1.5 overflow-y-auto pr-1">
                {cart.map(({ product, qty }) => {
                  const qtyNum = Number(qty) || 0;
                  const total = qtyNum > 0 ? lineTotalUzs(product.price, qtyNum) : 0;
                  return (
                    <div key={product.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-line/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{product.name}</p>
                        <p className="text-[10px] text-ink-faint">
                          {formatQty(qty || '0', product.unit)} × {formatUzs(product.price)}
                        </p>
                      </div>
                      <span className="w-20 text-right text-xs font-semibold">{formatUzs(total)}</span>
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        title="Olib tashlash"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-ink-soft">
              <span>Mahsulotlar</span>
              <span>{formatUzs(itemsTotal)}</span>
            </div>
            {!isAdding && (
              <div className="flex justify-between text-ink-soft">
                <span>Xizmat haqi</span>
                <span>{formatUzs(feeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1 text-sm font-bold">
              <span>{isAdding ? 'Qo‘shimcha jami' : 'Jami'}</span>
              <span>{formatUzs(itemsTotal + feeAmount)}</span>
            </div>
            {isAdding && (
              <p className="text-[11px] text-ink-faint">Xizmat haqi buyurtma yaratilganda hisoblangan.</p>
            )}
          </div>

          <div className="mt-3">
            <Field label="Izoh (ixtiyoriy)">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isDelivery ? 'Masalan: 18:30 ga yetkazilsin' : 'Masalan: achchiq bo‘lmasin'}
                className="min-h-[56px]"
              />
            </Field>
          </div>

          {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="secondary" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button loading={saveMutation.isPending} onClick={submit} disabled={cart.length === 0}>
              {isAdding ? 'Mahsulotlarni qo‘shish' : isDelivery ? 'Saboyni saqlash' : 'Buyurtma yaratish'}
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
        active ? 'bg-primary text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:bg-paper',
      )}
    >
      {children}
    </button>
  );
}

function unitLabel(unit: ProductDto['unit']): string {
  if (unit === 'KG') return 'kg';
  if (unit === 'LITER') return 'litr';
  if (unit === 'PIECE') return 'dona';
  return 'porsiya';
}
