import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { CreateOrderInput } from '@ikki-dost/validation';
import { MenuPicker, type CartLine } from '../../components/menu-picker';
import { toast } from '../../components/toast';
import { AppBar, Button, Card, Input, Row, Screen, Txt } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatQty, money } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

export default function NewDeliveryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [people, setPeople] = useState(1);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const itemsTotal = lines.reduce((sum, line) => sum + Math.round(line.product.price * line.quantity), 0);

  const mutation = useMutation({
    mutationFn: (input: CreateOrderInput) => api.createOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Yetkazish buyurtmasi yaratildi', `#${order.orderNumber}`);
      if (order.delivery) router.replace(`/delivery/${order.delivery.id}`);
      else router.replace('/delivery');
    },
    onError: (error) => toast.error('Buyurtma yaratilmadi', errorMessage(error)),
  });

  function submit() {
    if (!customerName.trim()) return toast.error('Ism kerak', 'Mijoz ismini kiriting.');
    if (!/^[+\d][\d\s-]{3,}$/.test(customerPhone.trim())) {
      return toast.error('Telefon noto‘g‘ri', 'Masalan: +998901234567');
    }
    if (address.trim().length < 3) return toast.error('Manzil kerak', 'Yetkazish manzilini kiriting.');
    if (lines.length === 0) return toast.error('Taom tanlanmagan', 'Menyudan kamida bitta taom tanlang.');

    mutation.mutate({
      type: 'DELIVERY',
      numberOfPeople: people,
      note: note.trim() || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      items: lines.map((line) => ({
        productId: line.product.id,
        quantity: String(line.quantity),
        note: null,
      })),
    });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen scroll>
        <AppBar title="Yangi yetkazish" subtitle="Mijoz va buyurtma ma’lumotlari" onBack={() => router.back()} />
        <Card>
            <Txt variant="heading">Mijoz</Txt>
            <View style={{ gap: 12, marginTop: 12 }}>
              <Input label="Ism" value={customerName} onChangeText={setCustomerName} placeholder="Mijoz ismi" />
              <Input
                label="Telefon"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="+998 90 123 45 67"
                keyboardType="phone-pad"
              />
              <Input label="Manzil" value={address} onChangeText={setAddress} placeholder="Ko‘cha, uy, mo‘ljal" />
              <Input label="Izoh (ixtiyoriy)" value={note} onChangeText={setNote} placeholder="Masalan: achchiq bo‘lmasin" />
              <Row justify="space-between">
                <Txt variant="label">Kishi soni</Txt>
                <Row gap={10}>
                  <Stepper label="−" onPress={() => setPeople(Math.max(0, people - 1))} />
                  <Txt variant="heading" style={{ minWidth: 28, textAlign: 'center' }}>
                    {people}
                  </Txt>
                  <Stepper label="+" onPress={() => setPeople(Math.min(500, people + 1))} />
                </Row>
              </Row>
            </View>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Row justify="space-between">
              <Txt variant="heading">Buyurtma</Txt>
              <Button
                label={lines.length ? 'O‘zgartirish' : 'Menyu'}
                size="sm"
                variant="secondary"
                onPress={() => setPickerOpen(true)}
              />
            </Row>
            {lines.length === 0 ? (
              <Txt variant="caption" tone="soft" style={{ marginTop: 8 }}>
                Taom tanlanmagan. Xizmat haqi kishi soniga qarab hisoblanadi.
              </Txt>
            ) : (
              <View style={{ marginTop: 10 }}>
                {lines.map((line) => (
                  <Row key={line.product.id} justify="space-between" style={{ paddingVertical: 5 }}>
                    <Txt variant="label" style={{ flex: 1 }} numberOfLines={1}>
                      {line.product.name} · {formatQty(line.quantity, line.product.unit)}
                    </Txt>
                    <Txt variant="label">{money(Math.round(line.product.price * line.quantity))}</Txt>
                  </Row>
                ))}
                <View style={styles.totalRow}>
                  <Txt variant="caption" tone="soft">
                    Taomlar
                  </Txt>
                  <Txt variant="heading">{money(itemsTotal)}</Txt>
                </View>
              </View>
            )}
          </Card>

          <Button
            label="Buyurtma yaratish"
            size="lg"
            fullWidth
            style={{ marginTop: 16 }}
            loading={mutation.isPending}
            onPress={submit}
          />
          <Txt variant="caption" tone="faint" style={{ marginTop: 10, textAlign: 'center' }}>
            Xizmat haqi va narxlar buyurtma paytida saqlanadi.
          </Txt>
      </Screen>

      <MenuPicker
        visible={pickerOpen}
        title="Yetkazish menyusi"
        orderType="DELIVERY"
        numberOfPeople={people}
        onClose={() => setPickerOpen(false)}
        confirmLabel="Tanlash"
        onConfirm={(selected) => {
          setLines(selected);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.stepButton}>
      <Txt variant="heading" tone="primary" style={{ lineHeight: 20 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 8,
    paddingTop: 10,
  },
});
