import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NotificationDto } from '@ikki-dost/shared-types';
import { toast } from '../../components/toast';
import { AppBar, Button, Card, EmptyState, Loading, Row, Screen, Txt } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime, timeAgo } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

const iconByType: Record<string, string> = {
  ORDER_CREATED: '🧾',
  ORDER_READY: '✅',
  PAYMENT_RECEIVED: '💵',
  DELIVERY_CREATED: '🛵',
  DELIVERY_STATUS: '📍',
  ROOM_CLOSED: '🔒',
  LOW_STOCK: '📦',
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications() });
  const notifications = query.data ?? [];
  const unread = notifications.filter((item) => !item.readAt).length;

  async function markRead(notification: NotificationDto) {
    if (notification.readAt) return;
    try {
      await api.markNotificationRead(notification.id);
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      toast.error('Xatolik', errorMessage(error));
    }
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Barcha xabarlar o‘qilgan deb belgilandi');
    } catch (error) {
      toast.error('Xatolik', errorMessage(error));
    }
  }

  return (
    <Screen scroll refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <AppBar
        title="Xabarlar"
        subtitle={unread > 0 ? `${unread} ta o‘qilmagan` : 'Hammasi o‘qilgan'}
        right={unread > 0 ? <Button label="Hammasi" size="sm" variant="secondary" onPress={() => void markAll()} /> : undefined}
      />

      {query.isLoading ? (
        <Loading label="Xabarlar yuklanmoqda…" />
      ) : query.isError ? (
        <EmptyState
          icon="⚠️"
          title="Yuklab bo‘lmadi"
          message={errorMessage(query.error)}
          action={<Button label="Qayta urinish" onPress={() => void query.refetch()} />}
        />
      ) : notifications.length === 0 ? (
        <EmptyState icon="🔔" title="Xabarlar yo‘q" message="Yangi buyurtmalar va to‘lovlar haqida xabarlar shu yerda ko‘rinadi." />
      ) : (
        notifications.map((notification) => (
          <Pressable key={notification.id} onPress={() => void markRead(notification)}>
            <Card style={[styles.card, !notification.readAt && styles.unread]}>
              <Row gap={10} align="flex-start">
                <View style={styles.icon}>
                  <Txt style={{ fontSize: 18 }}>{iconByType[notification.type] ?? '🔔'}</Txt>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Row justify="space-between" gap={8}>
                    <Txt variant="label" style={{ flex: 1 }} numberOfLines={2}>
                      {notification.title}
                    </Txt>
                    {!notification.readAt ? <View style={styles.dot} /> : null}
                  </Row>
                  <Txt variant="caption" tone="soft" style={{ marginTop: 3 }}>
                    {notification.body}
                  </Txt>
                  <Txt variant="caption" tone="faint" style={{ marginTop: 5 }}>
                    {timeAgo(notification.createdAt)} · {formatDateTime(notification.createdAt)}
                  </Txt>
                </View>
              </Row>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 9,
    padding: 12,
  },
  unread: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
});
