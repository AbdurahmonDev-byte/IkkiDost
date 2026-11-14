import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { RoomDto } from '@ikki-dost/shared-types';
import { AppBar, Badge, Button, Card, EmptyState, Loading, Row, Screen, Txt } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { disconnectRealtime } from '../../lib/realtime';
import { money, roleLabel } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import { toast } from '../../components/toast';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Xayrli tun';
  if (hour < 12) return 'Xayrli tong';
  if (hour < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}

export default function RoomsScreen() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const clear = useAuth((state) => state.clear);
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms() });

  const rooms = roomsQuery.data ?? [];
  const busyRooms = rooms.filter((room) => room.activeSession).length;

  function logout() {
    Alert.alert('Chiqish', 'Tizimdan chiqmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Chiqish',
        style: 'destructive',
        onPress: () => {
          disconnectRealtime();
          clear();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <Screen
      scroll
      refreshing={roomsQuery.isRefetching}
      onRefresh={() => {
        void roomsQuery.refetch();
      }}
    >
      <AppBar
        title={greeting()}
        subtitle={`${user?.fullName ?? ''} · ${user ? roleLabel[user.role] : ''}`}
        right={
          <Button
            label="Chiqish"
            variant="ghost"
            size="sm"
            onPress={logout}
          />
        }
      />

      <Card style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" tone="soft">
            Xonalar holati
          </Txt>
          <Txt variant="heading" style={{ marginTop: 3 }}>
            {busyRooms} ta band · {rooms.length - busyRooms} ta bo‘sh
          </Txt>
        </View>
        <Badge label={`Jami ${rooms.length}`} tone="primary" />
      </Card>

      <Row justify="space-between" style={{ marginTop: 18, marginBottom: 10 }}>
        <Txt variant="heading">Xonalar</Txt>
        <Txt variant="caption" tone="faint">
          Yangilash uchun pastga torting
        </Txt>
      </Row>

      {roomsQuery.isLoading ? (
        <Loading label="Xonalar yuklanmoqda…" />
      ) : roomsQuery.isError ? (
        <EmptyState
          icon="⚠️"
          title="Xonalarni yuklab bo‘lmadi"
          message={errorMessage(roomsQuery.error)}
          action={<Button label="Qayta urinish" onPress={() => void roomsQuery.refetch()} />}
        />
      ) : rooms.length === 0 ? (
        <EmptyState icon="🏠" title="Xonalar yo‘q" message="Ega admin panelda xonalarni qo‘shishi mumkin." />
      ) : (
        rooms.map((room) => (
          <RoomCard key={room.id} room={room} onPress={() => router.push(`/room/${room.id}`)} />
        ))
      )}

      <Txt variant="caption" tone="faint" style={{ marginTop: 18, textAlign: 'center' }}>
        Real vaqt rejimida yangilanadi
      </Txt>
    </Screen>
  );
}

function RoomCard({ room, onPress }: { room: RoomDto; onPress: () => void }) {
  const session = room.activeSession;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Card style={{ marginBottom: 10 }}>
        <Row justify="space-between">
          <Row gap={10}>
            <View style={[styles.roomGlyph, { backgroundColor: session ? colors.accentLight : colors.primaryLight }]}>
              <Txt style={{ fontSize: 20 }}>{session ? '🪑' : '🫖'}</Txt>
            </View>
            <View>
              <Txt variant="heading">{room.name}</Txt>
              <Txt variant="caption" tone="soft" style={{ marginTop: 2 }}>
                {session
                  ? `${session.orderCount} buyurtma · ${money(session.totalAmount)}`
                  : 'Bo‘sh · yangi buyurtma ochish'}
              </Txt>
            </View>
          </Row>
          <Badge label={session ? 'Band' : 'Bo‘sh'} tone={session ? 'warning' : 'success'} />
        </Row>

        {session ? (
          <Row justify="space-between" style={styles.sessionRow}>
            <View>
              <Txt variant="caption" tone="faint">
                To‘langan
              </Txt>
              <Txt variant="label" tone="success">
                {money(session.paidAmount)}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt variant="caption" tone="faint">
                Qarz
              </Txt>
              <Txt variant="label" tone={session.outstandingAmount > 0 ? 'danger' : 'success'}>
                {money(session.outstandingAmount)}
              </Txt>
            </View>
          </Row>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomGlyph: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
