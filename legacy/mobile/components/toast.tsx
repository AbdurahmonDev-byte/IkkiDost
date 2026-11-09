import { create } from 'zustand';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, cardShadow } from '../lib/theme';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastStore {
  items: ToastItem[];
  push: (item: ToastItem) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (item) => set((state) => ({ items: [...state.items, item].slice(-3) })),
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

function emit(kind: ToastKind, title: string, message?: string): void {
  const id = ++seq;
  useToastStore.getState().push({ id, kind, title, message });
  setTimeout(() => useToastStore.getState().dismiss(id), 4200);
}

export const toast = {
  success: (title: string, message?: string) => emit('success', title, message),
  error: (title: string, message?: string) => emit('error', title, message),
  info: (title: string, message?: string) => emit('info', title, message),
};

const toneStyles: Record<ToastKind, { bar: string; bg: string }> = {
  success: { bar: colors.success, bg: colors.successLight },
  error: { bar: colors.danger, bg: colors.dangerLight },
  info: { bar: colors.info, bg: colors.infoLight },
};

export function ToastHost() {
  const items = useToastStore((state) => state.items);
  const insets = useSafeAreaInsets();

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map((item) => (
        <View key={item.id} style={[styles.toast, { backgroundColor: toneStyles[item.kind].bg }]}>
          <View style={[styles.bar, { backgroundColor: toneStyles[item.kind].bar }]} />
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  bar: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  message: {
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
