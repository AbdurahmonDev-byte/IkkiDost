import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import type { DeliveryStatus } from '@ikki-dost/shared-types';
import { toast } from '../../components/toast';
import {
  AppBar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Loading,
  Row,
  Screen,
  SectionTitle,
  Txt,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import {
  deliveryNext,
  deliveryStatusLabel,
  formatDateTime,
  formatQty,
  itemStatusLabel,
  money,
} from '../../lib/format';
import { colors, radius } from '../../lib/theme';

const tone: Record<DeliveryStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PREPARING: 'accent',
  READY: 'success',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

const flow: DeliveryStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function DeliveryDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const deliveryId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const deliveriesQuery = useQuery({ queryKey: ['deliveries'], queryFn: () => api.deliveries() });
  const delivery = deliveriesQuery.data?.find((item) => item.id === deliveryId);

  const orderQuery = useQuery({
    queryKey: ['order', delivery?.orderId],
    queryFn: () => api.order(delivery?.orderId as string),
    enabled: Boolean(delivery?.orderId),
  });
  const order = orderQuery.data;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['deliveries'] }),
      queryClient.invalidateQueries({ queryKey: ['order', delivery?.orderId] }),
      queryClient.invalidateQueries({ queryKey: ['rooms'] }),
    ]);
  }

  async function advance(status: DeliveryStatus) {
    if (!delivery) return;
    setBusy(true);
    try {
      await api.updateDeliveryStatus(delivery.id, { status });
      toast.success('Holat yangilandi', deliveryStatusLabel[status]);
      await refresh();
    } catch (error) {
      toast.error('Holatni yangilab bo‘lmadi', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (!delivery) return;
    Alert.alert('Yetkazishni bekor qilish', 'Buyurtmani bekor qilmoqchimisiz?', [
      { text: 'Yo‘q', style: 'cancel' },
      { text: 'Bekor qilish', style: 'destructive', onPress: () => void advance('CANCELLED') },
    ]);
  }

  if (deliveriesQuery.isLoading || orderQuery.isLoading) {
    return (
      <Screen>
        <AppBar title="Yetkazish" onBack={() => router.back()} />
        <Loading label="Yuklanmoqda…" />
      </Screen>
    );
  }

  if (!delivery) {
    return (
      <Screen>
        <AppBar title="Yetkazish" onBack={() => router.back()} />
        <EmptyState
          icon="🛵"
          title="Buyurtma topilmadi"
          message="Ushbu yetkazish buyurtmasi mavjud emas."
          action={<Button label="Ro‘yxatga qaytish" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const next = deliveryNext[delivery.status];
  const currentIndex = flow.indexOf(delivery.status);
  const cancelled = delivery.status === 'CANCELLED';

  return (
    <Screen scroll refreshing={deliveriesQuery.isRefetching} onRefresh={() => void refresh()}>
      <AppBar
        title={`Yetkazish #${order?.orderNumber ?? ''}`}
        subtitle={formatDateTime(delivery.createdAt)}
        onBack={() => router.back()}
        right={<Badge label={deliveryStatusLabel[delivery.status]} tone={tone[delivery.status]} />}
      />

      <Card>
        <Row gap={10}>
          <View style={styles.avatar}>
            <Txt style={{ fontSize: 22 }}>👤</Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="heading" numberOfLines={1}>
              {delivery.customerName}
            </Txt>
            <Pressable onPress={() => void Linking.openURL(`tel:${delivery.customerPhone}`)} hitSlop={6}>
              <Txt variant="label" tone="primary" style={{ marginTop: 2 }}>
                📞 {delivery.customerPhone}
              </Txt>
            </Pressable>
          </View>
        </Row>
        <Divider />
        <Txt variant="caption" tone="soft">
          Manzil
        </Txt>
        <Txt variant="body" style={{ marginTop: 2 }}>
          {delivery.address}
        </Txt>
        {delivery.assignedToName ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 8 }}>
            Kuryer: {delivery.assignedToName}
          </Txt>
        ) : null}
      </Card>

      <SectionTitle>Holat</SectionTitle>
      <Card>
        {cancelled ? (
          <Txt variant="label" tone="danger">
            Buyurtma bekor qilingan
          </Txt>
        ) : (
          <View style={{ gap: 10 }}>
            {flow.map((status, index) => {
              const passed = index < currentIndex;
              const current = index === currentIndex;
              return (
                <Row key={status} gap={10}>
                  <View
                    style={[
                      styles.dot,
                      passed && { backgroundColor: colors.success, borderColor: colors.success },
                      current && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    {passed ? <Txt variant="caption" tone="inverse">✓</Txt> : null}
                  </View>
                  <Txt
                    variant="label"
                    tone={current ? 'primary' : passed ? 'success' : 'faint'}
                    style={{ flex: 1 }}
                  >
                    {deliveryStatusLabel[status]}
                  </Txt>
                  {current ? <Badge label="Hozir" tone="primary" /> : null}
                </Row>
              );
            })}
          </View>
        )}
      </Card>

      {order ? (
        <>
          <SectionTitle>Buyurtma tarkibi</SectionTitle>
          <Card>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt variant="label" numberOfLines={2}>
                    {item.productName}
                  </Txt>
                  <Txt variant="caption" tone="soft">
                    {formatQty(item.quantity, item.productUnit)} × {money(item.unitPrice)}
                  </Txt>
                  <Badge
                    label={itemStatusLabel[item.status]}
                    tone={item.status === 'CANCELLED' ? 'danger' : item.status === 'READY' ? 'success' : 'neutral'}
                  />
                </View>
                <Txt variant="label">{money(item.lineTotal)}</Txt>
              </View>
            ))}
            <Divider />
            <Row justify="space-between">
              <Txt variant="caption" tone="soft">
                Taomlar
              </Txt>
              <Txt variant="label">{money(order.itemsTotal)}</Txt>
            </Row>
            {order.serviceFeeAmount > 0 ? (
              <Row justify="space-between" style={{ marginTop: 4 }}>
                <Txt variant="caption" tone="soft">
                  Xizmat haqi ({order.numberOfPeople} kishi)
                </Txt>
                <Txt variant="label">{money(order.serviceFeeAmount)}</Txt>
              </Row>
            ) : null}
            <Row justify="space-between" style={{ marginTop: 6 }}>
              <Txt variant="label">Jami</Txt>
              <Txt variant="heading">{money(order.totalAmount)}</Txt>
            </Row>
            {order.note ? (
              <Txt variant="caption" tone="faint" style={{ marginTop: 8 }}>
                Izoh: {order.note}
              </Txt>
            ) : null}
          </Card>
        </>
      ) : orderQuery.isError ? (
        <EmptyState icon="⚠️" title="Buyurtma yuklanmadi" message={errorMessage(orderQuery.error)} />
      ) : null}

      {!cancelled && delivery.status !== 'DELIVERED' ? (
        <View style={{ gap: 10, marginTop: 18 }}>
          {next ? (
            <Button
              label={`Keyingi: ${deliveryStatusLabel[next]}`}
              size="lg"
              fullWidth
              loading={busy}
              onPress={() => void advance(next)}
            />
          ) : null}
          <Button label="Bekor qilish" variant="secondary" fullWidth onPress={cancel} />
        </View>
      ) : null}

      <Txt variant="caption" tone="faint" style={{ marginTop: 14, textAlign: 'center' }}>
        Oxirgi yangilanish: {formatDateTime(delivery.updatedAt)}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 7,
  },
});
