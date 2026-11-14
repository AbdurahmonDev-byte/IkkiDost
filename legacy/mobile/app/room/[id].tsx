import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { OrderDto, OrderItemDto, OrderStatus, PaymentDto } from '@ikki-dost/shared-types';
import { MenuPicker, type CartLine } from '../../components/menu-picker';
import { toast } from '../../components/toast';
import {
  AppBar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Loading,
  PromptDialog,
  Row,
  Screen,
  SectionTitle,
  Txt,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatQty, formatTime, money, orderStatusLabel, itemStatusLabel } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

const statusTone: Record<OrderStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PREPARING: 'accent',
  PARTIALLY_READY: 'accent',
  READY: 'success',
  SERVED: 'primary',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};

export default function RoomScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuth((state) => state.user?.role);
  const isOwner = role === 'OWNER';

  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => api.rooms() });
  const room = roomsQuery.data?.find((item) => item.id === roomId);
  const sessionId = room?.activeSession?.id ?? null;

  const sessionQuery = useQuery({
    queryKey: ['room-session', sessionId],
    queryFn: () => api.roomSession(sessionId as string),
    enabled: Boolean(sessionId),
  });
  const session = sessionQuery.data;

  const [people, setPeople] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<OrderDto | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const orders = [...(session?.orders ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const payments = session?.payments ?? [];
  const activeOrders = orders.filter((order) => order.status !== 'CANCELLED' && order.status !== 'COMPLETED');

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rooms'] }),
      sessionId ? queryClient.invalidateQueries({ queryKey: ['room-session', sessionId] }) : Promise.resolve(),
    ]);
  }

  async function onAddItems(lines: CartLine[]) {
    if (!room) return;
    setBusy(true);
    try {
      const items = lines.map((line) => ({
        productId: line.product.id,
        quantity: String(line.quantity),
        note: null,
      }));
      const target = activeOrders[activeOrders.length - 1];
      if (target) {
        await api.addOrderItems(target.id, { items });
      } else {
        await api.createOrder({ type: 'DINE_IN', roomId: room.id, numberOfPeople: people, items });
      }
      toast.success('Buyurtma saqlandi');
      setPickerOpen(false);
      await refresh();
    } catch (error) {
      toast.error('Buyurtma qo‘shilmadi', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function markServed(order: OrderDto, item: OrderItemDto) {
    try {
      await api.setItemStatus(order.id, item.id, { status: 'SERVED' });
      await refresh();
    } catch (error) {
      toast.error('Holatni o‘zgartirib bo‘lmadi', errorMessage(error));
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 2) {
      toast.error('Sabab juda qisqa', 'Kamida 2 ta belgi kiriting.');
      return;
    }
    setBusy(true);
    try {
      await api.cancelOrder(cancelTarget.id, { reason: cancelReason.trim() });
      toast.success('Buyurtma bekor qilindi');
      setCancelTarget(null);
      setCancelReason('');
      await refresh();
    } catch (error) {
      toast.error('Bekor qilib bo‘lmadi', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function requestClose() {
    if (!session) return;
    if ((session.outstandingAmount ?? 0) > 0) {
      setCloseReason('');
      setCloseOpen(true);
      return;
    }
    Alert.alert('Hisobni yopish', 'Xona sessiyasini yopmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Yopish', style: 'destructive', onPress: () => void closeSession() },
    ]);
  }

  async function closeSession() {
    if (!session) return;
    const reason = closeReason.trim();
    if ((session.outstandingAmount ?? 0) > 0 && reason.length < 3) {
      toast.error('Sabab kerak', 'Qarz bilan yopish uchun kamida 3 ta belgi kiriting.');
      return;
    }
    setBusy(true);
    try {
      await api.closeRoomSession(
        session.id,
        (session.outstandingAmount ?? 0) > 0 ? { overrideReason: reason } : {},
      );
      toast.success('Sessiya yopildi');
      setCloseOpen(false);
      await refresh();
      router.back();
    } catch (error) {
      toast.error('Sessiyani yopib bo‘lmadi', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (roomsQuery.isLoading) {
    return (
      <Screen>
        <AppBar title="Xona" onBack={() => router.back()} />
        <Loading label="Yuklanmoqda…" />
      </Screen>
    );
  }

  if (!room) {
    return (
      <Screen>
        <AppBar title="Xona" onBack={() => router.back()} />
        <EmptyState
          icon="🚪"
          title="Xona topilmadi"
          message="Bu xona o‘chirilgan yoki manzil noto‘g‘ri."
          action={<Button label="Orqaga" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={sessionQuery.isRefetching} onRefresh={() => void refresh()}>
      <AppBar
        title={room.name}
        subtitle={room.activeSession ? 'Ochiq sessiya' : 'Bo‘sh xona'}
        onBack={() => router.back()}
        right={<Badge label={room.activeSession ? 'Band' : 'Bo‘sh'} tone={room.activeSession ? 'warning' : 'success'} />}
      />

      {!sessionId ? (
        <>
          <Card>
            <Txt variant="heading">Yangi sessiya</Txt>
            <Txt variant="caption" tone="soft" style={{ marginTop: 4 }}>
              Kishi sonini kiriting va menyudan taom tanlang. Xizmat haqi har bir kishi uchun hisoblanadi.
            </Txt>
            <Row justify="space-between" style={{ marginTop: 16 }}>
              <Txt variant="label">Kishi soni</Txt>
              <PeopleStepper value={people} onChange={setPeople} />
            </Row>
          </Card>
          <Button
            label="Menyuni ochish"
            size="lg"
            fullWidth
            icon="🍽️"
            style={{ marginTop: 16 }}
            onPress={() => setPickerOpen(true)}
          />
        </>
      ) : sessionQuery.isLoading ? (
        <Loading label="Sessiya yuklanmoqda…" />
      ) : sessionQuery.isError || !session ? (
        <EmptyState
          icon="⚠️"
          title="Sessiyani yuklab bo‘lmadi"
          message={errorMessage(sessionQuery.error)}
          action={<Button label="Qayta urinish" onPress={() => void sessionQuery.refetch()} />}
        />
      ) : (
        <>
          <Card style={styles.summary}>
            <Row justify="space-between">
              <Txt variant="caption" tone="soft">
                Umumiy hisob
              </Txt>
              <Txt variant="caption" tone="faint">
                {orders.length} buyurtma
              </Txt>
            </Row>
            <Txt variant="display" style={{ marginTop: 2 }}>
              {money(session.totalAmount)}
            </Txt>
            <Row gap={16} style={{ marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" tone="faint">
                  To‘langan
                </Txt>
                <Txt variant="label" tone="success">
                  {money(session.paidAmount)}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" tone="faint">
                  Qarz
                </Txt>
                <Txt variant="label" tone={session.outstandingAmount > 0 ? 'danger' : 'success'}>
                  {money(session.outstandingAmount)}
                </Txt>
              </View>
            </Row>
          </Card>

          <Row justify="space-between" style={{ marginTop: 18, marginBottom: 10 }}>
            <Txt variant="heading">Buyurtmalar</Txt>
            <Txt variant="caption" tone="faint">
              {formatTime(session.openedAt)} dan beri
            </Txt>
          </Row>

          {orders.length === 0 ? (
            <EmptyState icon="🍽️" title="Buyurtma yo‘q" message="Menyu orqali taom qo‘shing." />
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canServe
                onServe={(item) => void markServed(order, item)}
                onCancel={
                  order.status === 'CANCELLED' || order.status === 'COMPLETED'
                    ? undefined
                    : () => {
                        setCancelReason('');
                        setCancelTarget(order);
                      }
                }
              />
            ))
          )}

          {payments.length > 0 ? (
            <>
              <SectionTitle>To‘lovlar</SectionTitle>
              <Card style={{ paddingVertical: 4 }}>
                {payments.map((payment, index) => (
                  <View key={payment.id}>
                    <PaymentRow payment={payment} />
                    {index < payments.length - 1 ? <Divider style={{ marginVertical: 8 }} /> : null}
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Row gap={10} style={{ marginTop: 18 }}>
            <Button
              label="Taom qo‘shish"
              icon="＋"
              style={{ flex: 1 }}
              onPress={() => setPickerOpen(true)}
            />
            {isOwner ? (
              <Button
                label="Hisobni yopish"
                variant="danger"
                style={{ flex: 1 }}
                onPress={requestClose}
              />
            ) : null}
          </Row>

          {!isOwner ? (
            <Txt variant="caption" tone="faint" style={{ marginTop: 12, textAlign: 'center' }}>
              Hisobni yopish kassir yoki ega tomonidan amalga oshiriladi.
            </Txt>
          ) : null}
        </>
      )}

      <MenuPicker
        visible={pickerOpen}
        title={`${room.name} · Menyu`}
        orderType="DINE_IN"
        numberOfPeople={people}
        busy={busy}
        onClose={() => setPickerOpen(false)}
        onConfirm={(lines) => void onAddItems(lines)}
      />

      <PromptDialog
        visible={Boolean(cancelTarget)}
        title="Buyurtmani bekor qilish"
        message="Bekor qilish sababini kiriting. Bu amal audit jurnalida saqlanadi."
        placeholder="Sabab…"
        value={cancelReason}
        onChangeText={setCancelReason}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
        confirmLabel="Bekor qilish"
        danger
        multiline
        busy={busy}
      />

      <PromptDialog
        visible={closeOpen}
        title="Qarz bilan yopish"
        message={`Qarz: ${money(session?.outstandingAmount ?? 0)}. Faqat ega sabab ko‘rsatib yopishi mumkin.`}
        placeholder="Sabab (kamida 3 ta belgi)…"
        value={closeReason}
        onChangeText={setCloseReason}
        onCancel={() => setCloseOpen(false)}
        onConfirm={() => void closeSession()}
        confirmLabel="Yopish"
        danger
        multiline
        busy={busy}
      />
    </Screen>
  );
}

function PeopleStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Row gap={10}>
      <StepperButton label="−" onPress={() => onChange(Math.max(0, value - 1))} />
      <Txt variant="heading" style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </Txt>
      <StepperButton label="+" onPress={() => onChange(Math.min(500, value + 1))} />
    </Row>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.stepButton}>
      <Txt variant="heading" tone="primary" style={{ lineHeight: 20 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function OrderCard({
  order,
  canServe,
  onServe,
  onCancel,
}: {
  order: OrderDto;
  canServe: boolean;
  onServe: (item: OrderItemDto) => void;
  onCancel?: () => void;
}) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <Row justify="space-between">
        <Row gap={8}>
          <Txt variant="heading">#{order.orderNumber}</Txt>
          <Badge label={orderStatusLabel[order.status]} tone={statusTone[order.status]} />
        </Row>
        <Txt variant="caption" tone="faint">
          {formatTime(order.createdAt)} · {order.createdByName}
        </Txt>
      </Row>

      <View style={{ marginTop: 8 }}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="label" numberOfLines={2}>
                {item.productName}
              </Txt>
              <Txt variant="caption" tone="soft">
                {formatQty(item.quantity, item.productUnit)} × {money(item.unitPrice)}
                {item.note ? ` · ${item.note}` : ''}
              </Txt>
              <Badge label={itemStatusLabel[item.status]} tone={item.status === 'CANCELLED' ? 'danger' : item.status === 'READY' ? 'success' : 'neutral'} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Txt variant="label">{money(item.lineTotal)}</Txt>
              {canServe && item.status === 'READY' ? (
                <Button label="Berildi" size="sm" variant="secondary" onPress={() => onServe(item)} />
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <Divider style={{ marginVertical: 10 }} />
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
      {onCancel ? (
        <Button
          label="Buyurtmani bekor qilish"
          size="sm"
          variant="ghost"
          style={{ marginTop: 8, alignSelf: 'flex-end' }}
          onPress={onCancel}
        />
      ) : null}
    </Card>
  );
}

function PaymentRow({ payment }: { payment: PaymentDto }) {
  return (
    <Row justify="space-between">
      <View>
        <Txt variant="label">{payment.methodName}</Txt>
        <Txt variant="caption" tone="faint">
          {formatTime(payment.createdAt)} · {payment.receivedByName}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt variant="label" tone={payment.reversedAt ? 'faint' : 'success'}>
          {money(payment.amount)}
        </Txt>
        {payment.reversedAt ? <Badge label="Qaytarilgan" tone="danger" /> : null}
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  summary: {
    paddingVertical: 16,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
