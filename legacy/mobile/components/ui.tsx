import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cardShadow, colors, radius } from '../lib/theme';

// ===== Typography =====

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
type Tone = 'ink' | 'soft' | 'faint' | 'primary' | 'danger' | 'success' | 'accent' | 'inverse';

const variantStyle: Record<Variant, { fontSize: number; fontWeight: '400' | '500' | '600' | '700' | '800'; lineHeight: number }> = {
  display: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};

const toneColor: Record<Tone, string> = {
  ink: colors.ink,
  soft: colors.inkSoft,
  faint: colors.inkFaint,
  primary: colors.primary,
  danger: colors.danger,
  success: colors.success,
  accent: colors.accent,
  inverse: '#ffffff',
};

export function Txt({
  variant = 'body',
  tone = 'ink',
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  return (
    <Text style={[variantStyle[variant], { color: toneColor[tone] }, style]} {...rest}>
      {children}
    </Text>
  );
}

// ===== Layout =====

export function Screen({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  contentStyle,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}) {
  const refresh = onRefresh ? (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
  ) : undefined;

  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function AppBar({
  title,
  subtitle,
  right,
  large = false,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  large?: boolean;
  onBack?: () => void;
}) {
  return (
    <View style={styles.appBar}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton} accessibilityLabel="Orqaga">
          <Text style={{ fontSize: 24, color: colors.primary, lineHeight: 26 }}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.appBarText}>
        <Txt variant={large ? 'display' : 'title'}>{title}</Txt>
        {subtitle ? (
          <Txt variant="caption" tone="soft" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ? <View style={styles.appBarRight}>{right}</View> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({
  children,
  gap = 8,
  align = 'center',
  justify = 'flex-start',
  style,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap }, style]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

// ===== Controls =====

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBg: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
  primary: { bg: colors.primary, border: colors.primary, text: '#ffffff' },
  secondary: { bg: colors.card, border: colors.line, text: colors.ink },
  ghost: { bg: 'transparent', border: 'transparent', text: colors.primary },
  danger: { bg: colors.danger, border: colors.danger, text: '#ffffff' },
  accent: { bg: colors.accent, border: colors.accent, text: '#ffffff' },
};

const buttonPad: Record<ButtonSize, { padH: number; padV: number; font: number }> = {
  sm: { padH: 12, padV: 7, font: 13 },
  md: { padH: 16, padV: 11, font: 15 },
  lg: { padH: 20, padV: 15, font: 16 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}) {
  const tone = buttonBg[variant];
  const pad = buttonPad[size];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          paddingHorizontal: pad.padH,
          paddingVertical: pad.padV,
          opacity: inactive ? 0.5 : pressed ? 0.82 : 1,
        },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={tone.text} /> : null}
      {icon && !loading ? <Text style={{ fontSize: pad.font, color: tone.text }}>{icon}</Text> : null}
      <Text style={{ color: tone.text, fontSize: pad.font, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Input({
  label,
  error,
  hint,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string; hint?: string; style?: TextInputProps['style'] }) {
  return (
    <View style={{ gap: 6, alignSelf: 'stretch' }}>
      {label ? (
        <Txt variant="label" tone="soft">
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
        {...rest}
      />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const badgeTone: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: '#f1efe9', fg: colors.inkSoft },
  primary: { bg: colors.primaryLight, fg: colors.primary },
  success: { bg: colors.successLight, fg: colors.success },
  warning: { bg: colors.warningLight, fg: colors.warning },
  danger: { bg: colors.dangerLight, fg: colors.danger },
  info: { bg: colors.infoLight, fg: colors.info },
  accent: { bg: colors.accentLight, fg: colors.accent },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const palette = badgeTone[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Stat({
  label,
  value,
  tone = 'ink',
  caption,
}: {
  label: string;
  value: string;
  tone?: Tone;
  caption?: string;
}) {
  return (
    <Card style={styles.stat}>
      <Txt variant="caption" tone="soft">
        {label}
      </Txt>
      <Txt variant="heading" tone={tone} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      {caption ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
          {caption}
        </Txt>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  icon = '🍃',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Txt variant="heading" style={{ marginTop: 10, textAlign: 'center' }}>
        {title}
      </Txt>
      {message ? (
        <Txt variant="body" tone="soft" style={{ marginTop: 6, textAlign: 'center' }}>
          {message}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Txt variant="body" tone="soft" style={{ marginTop: 10 }}>
        {label}
      </Txt>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <Row justify="space-between" style={{ marginBottom: 10 }}>
      <Txt variant="heading">{children}</Txt>
      {right}
    </Row>
  );
}

// ===== Prompt dialog (Alert.prompt is iOS-only) =====

export function PromptDialog({
  visible,
  title,
  message,
  placeholder,
  value,
  onChangeText,
  onCancel,
  onConfirm,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor qilish',
  danger = false,
  keyboardType = 'default',
  multiline = false,
  busy = false,
}: {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.modalCard}>
          <Txt variant="heading">{title}</Txt>
          {message ? (
            <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
              {message}
            </Txt>
          ) : null}
          <Input
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            keyboardType={keyboardType}
            multiline={multiline}
            autoFocus
            style={multiline ? { minHeight: 84, textAlignVertical: 'top' } : undefined}
          />
          <Row gap={10} style={{ marginTop: 16 }}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              label={confirmLabel}
              variant={danger ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={busy}
              style={{ flex: 1 }}
            />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ===== Sheet (bottom panel) =====

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 14,
    gap: 12,
  },
  appBarText: {
    flex: 1,
  },
  backButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
    marginRight: -4,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    ...cardShadow,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 12,
  },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 20, 16, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 20, 16, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    paddingTop: 8,
  },
});
