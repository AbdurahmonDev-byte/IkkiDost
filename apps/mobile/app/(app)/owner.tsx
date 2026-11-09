import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { AppBar, Badge, Button, Card, EmptyState, Loading, Row, Screen, SectionTitle, Stat, Txt } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, formatQty, money, roleLabel, timeAgo } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

export default function OwnerScreen() {
  const user = useAuth((state) => state.user);
  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: () => api.dashboard() });
  const feeQuery = useQuery({ queryKey: ['service-fee'], queryFn: () => api.serviceFeeConfig() });

  if (user?.role !== 'OWNER') {
    return (
      <Screen>
        <AppBar title="Egasi" />
        <EmptyState icon="🔒" title="Ruxsat yo‘q" message="Bu bo‘lim faqat egasi uchun." />
      </Screen>
    );
  }

  const data = dashboardQuery.data;

  return (
    <Screen scroll refreshing={dashboardQuery.isRefetching} onRefresh={() => void dashboardQuery.refetch()}>
      <AppBar
        title="Boshqaruv"
        subtitle={`${user?.fullName ?? ''} · ${user ? roleLabel[user.role] : ''}`}
        right={<Badge label="Bugun" tone="primary" />}
      />

      {dashboardQuery.isLoading ? (
        <Loading label="Ko‘rsatkichlar yuklanmoqda…" />
      ) : dashboardQuery.isError ? (
        <EmptyState
          icon="⚠️"
          title="Ma’lumot yuklanmadi"
          message={errorMessage(dashboardQuery.error)}
          action={<Button label="Qayta urinish" onPress={() => void dashboardQuery.refetch()} />}
        />
      ) : data ? (
        <>
          <Row gap={10} style={{ marginBottom: 10 }}>
            <Stat label="Bugungi tushum" value={money(data.todayRevenue)} tone="success" caption={`${data.todayOrderCount} buyurtma`} />
            <Stat label="To‘langan" value={money(data.paidToday)} tone="primary" />
          </Row>
          <Row gap={10} style={{ marginBottom: 10 }}>
            <Stat label="Faol xonalar" value={String(data.activeRooms)} tone="accent" />
            <Stat label="Zalda" value={String(data.activeDineInOrders)} />
            <Stat label="Yetkazish" value={String(data.activeDeliveryOrders)} />
          </Row>
          <Row gap={10} style={{ marginBottom: 10 }}>
            <Stat label="Qarz" value={money(data.unpaidOutstanding)} tone={data.unpaidOutstanding > 0 ? 'danger' : 'success'} />
            <Stat label="Xarajat" value={money(data.todayExpenses)} tone="danger" />
          </Row>
          <Row gap={10}>
            <Stat label="Xizmat haqi" value={money(data.serviceFeeRevenueToday)} tone="primary" />
            <Stat
              label="Bugungi foyda"
              value={money(data.todayRevenue - data.todayExpenses)}
              tone={data.todayRevenue - data.todayExpenses >= 0 ? 'success' : 'danger'}
            />
          </Row>

          <Card style={{ marginTop: 14 }}>
            <Row justify="space-between">
              <Txt variant="heading">Xizmat haqi</Txt>
              <Badge
                label={feeQuery.data?.enabled ? 'Yoqilgan' : 'O‘chirilgan'}
                tone={feeQuery.data?.enabled ? 'success' : 'neutral'}
              />
            </Row>
            <Txt variant="caption" tone="soft" style={{ marginTop: 4 }}>
              {feeQuery.data
                ? `${money(feeQuery.data.amountPerPerson)} / kishi · ${feeQuery.data.applyToDineIn ? 'zalda' : 'zalsiz'}, ${
                    feeQuery.data.applyToDelivery ? 'yetkazishda' : 'yetkazishsiz'
                  }`
                : 'Yuklanmoqda…'}
            </Txt>
            <Txt variant="caption" tone="faint" style={{ marginTop: 6 }}>
              O‘zgartirish uchun admin panel → Sozlamalar.
            </Txt>
          </Card>

          {data.popularProducts.length > 0 ? (
            <>
              <SectionTitle>Ommabop taomlar</SectionTitle>
              <Card>
                {data.popularProducts.slice(0, 6).map((product, index) => (
                  <Row key={`${product.productName}-${index}`} justify="space-between" style={styles.listRow}>
                    <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.rank}>
                        <Txt variant="caption" tone="primary">
                          {index + 1}
                        </Txt>
                      </View>
                      <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>
                        {product.productName}
                      </Txt>
                    </Row>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt variant="label">{money(product.revenue)}</Txt>
                      <Txt variant="caption" tone="faint">
                        {product.quantity} dona
                      </Txt>
                    </View>
                  </Row>
                ))}
              </Card>
            </>
          ) : null}

          {data.revenueByDay.length > 0 ? (
            <>
              <SectionTitle>Kunlik tushum</SectionTitle>
              <Card>
                {data.revenueByDay.slice(-7).map((day) => {
                  const max = Math.max(...data.revenueByDay.map((item) => item.revenue), 1);
                  const width = Math.max(4, Math.round((day.revenue / max) * 100));
                  return (
                    <View key={day.date} style={{ marginBottom: 8 }}>
                      <Row justify="space-between" style={{ marginBottom: 3 }}>
                        <Txt variant="caption" tone="soft">
                          {formatDate(day.date)}
                        </Txt>
                        <Txt variant="caption" tone="soft">
                          {money(day.revenue)}
                        </Txt>
                      </Row>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: `${width}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          {data.recentActivity.length > 0 ? (
            <>
              <SectionTitle>So‘nggi harakatlar</SectionTitle>
              <Card>
                {data.recentActivity.slice(0, 8).map((log, index) => (
                  <View key={log.id} style={[styles.activity, index > 0 && styles.activityBorder]}>
                    <Txt variant="label">{log.actorName}</Txt>
                    <Txt variant="caption" tone="soft">
                      {log.action} · {log.entity}
                    </Txt>
                    <Txt variant="caption" tone="faint">
                      {timeAgo(log.createdAt)}
                    </Txt>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listRow: {
    paddingVertical: 7,
  },
  rank: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  activity: {
    paddingVertical: 7,
  },
  activityBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
