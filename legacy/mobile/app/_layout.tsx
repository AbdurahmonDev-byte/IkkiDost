import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/toast';
import { isMobileRole, useAuth, useAuthReady } from '../lib/auth';
import { colors } from '../lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate() {
  const ready = useAuthReady();
  const user = useAuth((state) => state.user);
  const clear = useAuth((state) => state.clear);
  const segments = useSegments();
  const router = useRouter();
  const inLogin = segments[0] === 'login';

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      if (!inLogin) router.replace('/login');
      return;
    }
    if (!isMobileRole(user.role)) {
      clear();
      return;
    }
    if (inLogin) router.replace('/');
  }, [ready, user, inLogin, router, clear]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGate />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
