import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Input, Txt } from '../components/ui';
import { toast } from '../components/toast';
import { api, API_URL, errorMessage } from '../lib/api';
import { isMobileRole, useAuth } from '../lib/auth';
import { roleLabel } from '../lib/format';
import { colors, radius } from '../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuth((state) => state.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!username.trim() || !password) {
      setError('Login va parolni kiriting');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.login({ username: username.trim(), password });
      if (!isMobileRole(result.user.role)) {
        toast.error('Ruxsat yo‘q', 'Bu ilova faqat ega va ofitsiant uchun.');
        setError('Bu ilova faqat ega (OWNER) va ofitsiant (WAITER) uchun.');
        return;
      }
      setSession({ user: result.user, tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken } });
      toast.success('Xush kelibsiz!', `${result.user.fullName} · ${roleLabel[result.user.role]}`);
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={{ fontSize: 34 }}>🍵</Text>
            </View>
            <Txt variant="display" style={{ marginTop: 16 }}>
              Ikki Do‘st
            </Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 4 }}>
              Choyxona boshqaruv tizimi
            </Txt>
          </View>

          <Card style={styles.card}>
            <Txt variant="title">Kirish</Txt>
            <Txt variant="caption" tone="soft" style={{ marginTop: 4, marginBottom: 18 }}>
              Ishchi hisobingiz bilan tizimga kiring
            </Txt>

            <View style={{ gap: 14 }}>
              <Input
                label="Login"
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="masalan: ofitsiant"
                returnKeyType="next"
              />
              <View>
                <Input
                  label="Parol"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={8}
                  style={styles.eye}
                >
                  <Txt variant="caption" tone="primary">
                    {showPassword ? 'Yashirish' : 'Ko‘rsatish'}
                  </Txt>
                </Pressable>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Txt variant="caption" tone="danger">
                    {error}
                  </Txt>
                </View>
              ) : null}
              <Button label="Kirish" size="lg" fullWidth loading={busy} onPress={submit} />
            </View>
          </Card>

          <Txt variant="caption" tone="faint" style={{ marginTop: 20, textAlign: 'center' }}>
            Server: {API_URL}
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 74,
    height: 74,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 20,
  },
  eye: {
    position: 'absolute',
    right: 12,
    top: 38,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
});
