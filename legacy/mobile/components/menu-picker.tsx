import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { OrderType, ProductDto } from '@ikki-dost/shared-types';
import { computeServiceFee } from '@ikki-dost/utils';
import { api, SOCKET_URL } from '../lib/api';
import { formatQty, money, unitLabel } from '../lib/format';
import { colors, radius } from '../lib/theme';
import { Badge, Button, EmptyState, Input, Loading, Row, Sheet, Txt } from './ui';

export interface CartLine {
  product: ProductDto;
  quantity: number;
}

function stepFor(product: ProductDto): number {
  return product.unit === 'KG' ? 0.25 : product.unit === 'LITER' ? 0.25 : 1;
}

function minFor(product: ProductDto): number {
  return product.unit === 'KG' || product.unit === 'LITER' ? 0.25 : 1;
}

type Cart = Record<string, number>;

export function MenuPicker({
  visible,
  title = 'Menyu',
  orderType,
  numberOfPeople,
  onClose,
  onConfirm,
  confirmLabel = 'Qo‘shish',
  busy = false,
}: {
  visible: boolean;
  title?: string;
  orderType: OrderType;
  numberOfPeople: number;
  onClose: () => void;
  onConfirm: (lines: CartLine[]) => void;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const [cart, setCart] = useState<Cart>({});
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
    enabled: visible,
  });
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => api.products(),
    enabled: visible,
  });
  const feeQuery = useQuery({
    queryKey: ['service-fee'],
    queryFn: () => api.serviceFeeConfig(),
    enabled: visible,
  });

  // Reset the basket each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setCart({});
      setSearch('');
      setCategoryId(null);
    }
  }, [visible]);

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (product.status !== 'ACTIVE') return false;
      if (categoryId && product.categoryId !== categoryId) return false;
      if (term && !product.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, categoryId, search]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = products.find((item) => item.id === productId);
          return product ? { product, quantity } : null;
        })
        .filter((line): line is CartLine => line !== null),
    [cart, products],
  );

  const itemsTotal = lines.reduce((sum, line) => sum + Math.round(line.product.price * line.quantity), 0);
  const fee = feeQuery.data ? computeServiceFee(feeQuery.data, orderType, numberOfPeople) : null;
  const total = itemsTotal + (fee?.applies ? fee.amount : 0);

  function change(product: ProductDto, delta: number) {
    setCart((current) => {
      const next = { ...current };
      const step = stepFor(product);
      const value = Number(((next[product.id] ?? 0) + delta * step).toFixed(3));
      if (value < minFor(product)) delete next[product.id];
      else next[product.id] = value;
      return next;
    });
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{title}</Txt>
          <Txt variant="caption" tone="soft" style={{ marginTop: 2 }}>
            {numberOfPeople > 0 ? `${numberOfPeople} kishi` : 'Kishi soni kiritilmagan'}
            {fee?.applies ? ` · xizmat haqi ${money(fee.amount)}` : ''}
          </Txt>
        </View>
        <Button label="Yopish" variant="ghost" size="sm" onPress={onClose} />
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input value={search} onChangeText={setSearch} placeholder="Taom qidirish…" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="Barchasi" active={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        {productsQuery.isLoading ? (
          <Loading label="Menyu yuklanmoqda…" />
        ) : visibleProducts.length === 0 ? (
          <EmptyState icon="🍽️" title="Taom topilmadi" message="Qidiruv yoki kategoriyani o‘zgartirib ko‘ring." />
        ) : (
          visibleProducts.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              quantity={cart[product.id] ?? 0}
              onAdd={() => change(product, 1)}
              onRemove={() => change(product, -1)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Row justify="space-between" style={{ marginBottom: 10 }}>
          <View>
            <Txt variant="caption" tone="soft">
              Taomlar: {money(itemsTotal)}
            </Txt>
            {fee?.applies ? (
              <Txt variant="caption" tone="faint">
                Xizmat haqi: {money(fee.amount)}
              </Txt>
            ) : null}
          </View>
          <Txt variant="heading">{money(total)}</Txt>
        </Row>
        <Button
          label={lines.length ? `${confirmLabel} · ${lines.length} xil` : confirmLabel}
          size="lg"
          fullWidth
          disabled={lines.length === 0}
          loading={busy}
          onPress={() => onConfirm(lines)}
        />
      </View>
    </Sheet>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Txt variant="label" tone={active ? 'inverse' : 'soft'}>
        {label}
      </Txt>
    </Pressable>
  );
}

function ProductRow({
  product,
  quantity,
  onAdd,
  onRemove,
}: {
  product: ProductDto;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const image = product.thumbnailUrl || product.imageUrl;
  return (
    <View style={styles.product}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: `${SOCKET_URL}${image}` }} style={styles.thumbImage} />
        ) : (
          <Txt style={{ fontSize: 22 }}>🍵</Txt>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="label" numberOfLines={2}>
          {product.name}
        </Txt>
        <Txt variant="caption" tone="soft" style={{ marginTop: 2 }}>
          {money(product.price)} / {unitLabel[product.unit].toLowerCase()}
        </Txt>
        {quantity > 0 ? (
          <Txt variant="caption" tone="primary" style={{ marginTop: 3, fontWeight: '700' }}>
            {formatQty(quantity, product.unit)} · {money(Math.round(product.price * quantity))}
          </Txt>
        ) : null}
      </View>
      <View style={styles.stepper}>
        {quantity > 0 ? (
          <>
            <StepButton label="−" onPress={onRemove} />
            <Txt variant="label" style={{ minWidth: 34, textAlign: 'center' }}>
              {formatQty(quantity, product.unit).replace(/\s(kg|l|dona|porsiya)$/, '')}
            </Txt>
          </>
        ) : null}
        <StepButton label="+" onPress={onAdd} primary />
      </View>
    </View>
  );
}

function StepButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.stepButton,
        primary && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <Txt variant="heading" tone={primary ? 'inverse' : 'primary'} style={{ lineHeight: 20 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  chips: {
    gap: 8,
    paddingVertical: 10,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  list: {
    maxHeight: 380,
  },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
});
