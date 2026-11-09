import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { DeliveryDto, DeliveryStatus } from '@ikki-dost/shared-types';
import { AppBar, Badge, Button, Card, EmptyState, Loading, Row, Screen, Txt } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { deliveryStatusLabel, formatTime, isDeliveryActive, timeAgo } from '../../lib/format';
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

type Filter = 'active' | 'all';

export default function DeliveryListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('active');
  const query = useQuery({ queryKey: ['deliveries'], queryFn: () => api.deliveries() });

  const all = query.data ?? [];
  const deliveries = filter === 'active' ? all.filter((item) => isDeliveryActive(item.status)) : all;
  const activeCount = all.filter((item) => isDeliveryActive(item.status)).length;

  return (
    <Screen scroll refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <AppBar
        title="Yetkazib berish"
        subtitle={`${activeCount} ta faol buyurtma`}
        right={<Button label="Yangi" size="sm" icon="＋" onPress={() => router.push('/delivery/new')} />}
      />

      <Row gap={8} style={{ marginBottom: 14 }}>
        <FilterChip label={`Faol (${activeCount})`} active={filter === 'active'} onPress={() => setFilter('active')} />
        <FilterChip label={`Barchasi (${all.length})`} active={filter === 'all'} onPress={() => setFilter('all')} />
      </Row>

      {query.isLoading ? (
        <Loading label="Buyurtmalar yuklanmoqda…" />
      ) : query.isError ? (
        <EmptyState
          icon="⚠️"
          title="Yuklab bo‘lmadi"
          message={errorMessage(query.error)}
          action={<Button label="Qayta urinish" onPress={() => void query.refetch()} />}
        />
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon="🛵"
          title={filter === 'active' ? 'Faol yetkazish yo‘q' : 'Yetkazish yo‘q'}
          message="Yangi yetkazib berish buyurtmasini yaratishingiz mumkin."
          action={<Button label="Yangi buyurtma" onPress={() => router.push('/delivery/new')} />}
        />
      ) : (
        deliveries.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            onPress={() => router.push(`/delivery/${delivery.id}`)}
          />
        ))
      )}
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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

function DeliveryCard({ delivery, onPress }: { delivery: DeliveryDto; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Card style={{ marginBottom: 10 }}>
        <Row justify="space-between">
          <Row gap={10}>
            <View style={styles.glyph}>
              <Txt style={{ fontSize: 20 }}>🛵</Txt>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="heading" numberOfLines={1}>
                {delivery.customerName}
              </Txt>
              <Txt variant="caption" tone="soft" numberOfLines={1}>
                {delivery.address}
              </Txt>
            </View>
          </Row>
          <Badge label={deliveryStatusLabel[delivery.status]} tone={tone[delivery.status]} />
        </Row>
        <Row justify="space-between" style={styles.meta}>
          <Pressable onPress={() => void Linking.openURL(`tel:${delivery.customerPhone}`)} hitSlop={6}>
            <Txt variant="caption" tone="primary">
              📞 {delivery.customerPhone}
            </Txt>
          </Pressable>
          <Txt variant="caption" tone="faint">
            {timeAgo(delivery.createdAt)} · {formatTime(delivery.createdAt)}
          </Txt>
        </Row>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
