// Raiz do app: provedores (tema, mensagens), sessão e proteção de rotas.
// Quem não está logado só acessa as telas de (auth); quem está, as de (app).
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { FeedbackProvider } from '@/components/Feedback';
import { isSupabaseConfigured } from '@/config/env';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import { configureNotifications } from '@/services/localNotifications';
import { endSession, startSession } from '@/services/session';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { ThemeProvider, useAppTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorBoundary {...props} />;
}

function Navigation() {
  const { colors, dark } = useAppTheme();
  const session = useAuthStore((s) => s.session);
  const navTheme = useMemo(
    () => ({
      ...(dark ? DarkTheme : DefaultTheme),
      colors: {
        ...(dark ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    }),
    [colors, dark],
  );
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isSupabaseConfigured}>
          <Stack.Screen name="not-configured" />
        </Stack.Protected>
        <Stack.Protected guard={isSupabaseConfigured && !session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isSupabaseConfigured && !!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const initialized = useAuthStore((s) => s.initialized);
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const themePref = useAuthStore((s) => s.account?.preferences.theme ?? 'system');
  useNetworkSync(!!userId);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      useAuthStore.getState().setInitialized();
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => useAuthStore.getState().setSession(data.session))
      .catch(() => useAuthStore.getState().setSession(null))
      .finally(() => useAuthStore.getState().setInitialized());
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      useAuthStore.getState().setSession(session);
      // Sessão encerrada em outro aparelho ou expirada: limpa os dados locais.
      if (event === 'SIGNED_OUT') void endSession();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) void startSession(userId);
  }, [userId]);

  useEffect(() => {
    if (initialized) void SplashScreen.hideAsync().catch(() => undefined);
  }, [initialized]);

  if (!initialized) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider preference={themePref}>
        <FeedbackProvider>
          <Navigation />
        </FeedbackProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
