import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';

/** Ao tocar num lembrete, abre o evento correspondente. */
function useOpenEventFromNotification() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (data && typeof data.eventId === 'string') {
        router.push({
          pathname: '/event/[id]',
          params: { id: data.eventId, date: String(data.originalDate ?? '') },
        });
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data),
    );
    return () => sub.remove();
  }, []);
}

export default function AppLayout() {
  const { colors } = useAppTheme();
  useOpenEventFromNotification();
  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
        // No navegador, uma tela aberta direto por link (ou após recarregar) não tem
        // "voltar": mostra um botão para o início.
        headerLeft:
          Platform.OS === 'web' && !navigation.canGoBack()
            ? () => (
                <IconButton
                  icon="home-outline"
                  label={t('common.goHome')}
                  onPress={() => router.replace('/')}
                />
              )
            : undefined,
      })}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="filters" options={{ presentation: 'modal', title: t('filters.title') }} />
    </Stack>
  );
}
