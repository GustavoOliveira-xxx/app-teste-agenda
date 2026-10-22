import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

import { useFeedback } from '@/components/Feedback';
import { ACTION_SNOOZE, snoozeReminder } from '@/services/localNotifications';
import { IconButton } from '@/components/IconButton';
import { useAvailableUpdate } from '@/hooks/useAvailableUpdate';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte } from '@/theme/tokens';

/** Ao tocar num lembrete, abre o evento; em "Adiar 10 min", reagenda. */
function useOpenEventFromNotification() {
  const { toast } = useFeedback();
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
    const handle = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier === ACTION_SNOOZE) {
        void snoozeReminder(response.notification.request).then(() => toast(t('reminders.snoozed')));
        return;
      }
      open(response.notification.request.content.data);
    };
    // Resposta que abriu o app (app estava fechado) e as próximas, com o app aberto.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      handle(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [toast]);
}

/** No Android, avisa uma vez quando há um APK mais novo publicado. */
function useUpdateNotice() {
  const update = useAvailableUpdate();
  const { toast } = useFeedback();
  useEffect(() => {
    if (!update) return;
    toast(t('updates.available', { version: update.version }), 'info', {
      label: t('updates.download'),
      onPress: () => void Linking.openURL(update.url),
    });
  }, [update, toast]);
}

export default function AppLayout() {
  const { colors } = useAppTheme();
  useOpenEventFromNotification();
  useUpdateNotice();
  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { ...fonte('titulo'), fontSize: 19 },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
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
      <Stack.Screen name="notifications" options={{ title: t('notificationsInbox.title') }} />
      {/* Criar e editar evento sobem de baixo, como uma folha. */}
      <Stack.Screen name="event/new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="event/[id]/edit" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="calendar/new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen
        name="filters"
        options={{ presentation: 'modal', title: t('filters.title'), animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
