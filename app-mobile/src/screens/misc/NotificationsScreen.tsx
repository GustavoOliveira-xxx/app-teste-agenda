import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { ListItem } from '@/components/ListItem';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/StateViews';
import { useAction } from '@/hooks/useAction';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { t } from '@/i18n';
import type { AppNotification, NotificationType } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/dates';

const ICONS: Record<NotificationType, IconName> = {
  invite_received: 'mail-outline',
  invite_accepted: 'person-add-outline',
  invite_declined: 'person-remove-outline',
  event_created: 'add-circle-outline',
  event_updated: 'create-outline',
  event_cancelled: 'close-circle-outline',
  event_deleted: 'trash-outline',
  member_added: 'people-outline',
  member_removed: 'exit-outline',
  role_changed: 'shield-outline',
  ownership_received: 'key-outline',
  comment_added: 'chatbubble-outline',
};

/** Central de avisos: convites, alterações em eventos, membros e comentários. */
export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const display = useDisplaySettings();
  const notifications = useDataStore((s) => s.notifications);
  const syncing = useSyncStore((s) => s.syncing);
  const { run } = useAction();
  const unread = notifications.filter((n) => !n.read_at).length;

  const markAll = async () => {
    const result = await run(() => api.markNotificationsRead());
    if (result.ok) {
      const now = new Date().toISOString();
      useDataStore
        .getState()
        .set({ notifications: notifications.map((n) => ({ ...n, read_at: n.read_at ?? now })) });
    }
  };

  const clearRead = async () => {
    const result = await run(() => api.deleteReadNotifications());
    if (result.ok) useDataStore.getState().set({ notifications: notifications.filter((n) => !n.read_at) });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unread ? (
          <Button title={t('notificationsInbox.markAllRead')} variant="ghost" compact onPress={markAll} />
        ) : null,
    });
  });

  const open = (n: AppNotification) => {
    if (!n.read_at) {
      void api.markNotificationsRead([n.id]).catch(() => undefined);
      useDataStore
        .getState()
        .set({
          notifications: notifications.map((x) =>
            x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
          ),
        });
    }
    if (n.type === 'invite_received') router.push('/invites');
    else if (n.event_id && n.type !== 'event_deleted')
      router.push({ pathname: '/event/[id]', params: { id: n.event_id } });
    else if (n.calendar_id && n.type !== 'member_removed')
      router.push({ pathname: '/calendar/[id]', params: { id: n.calendar_id } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />}
        contentContainerStyle={notifications.length ? styles.list : styles.flex}
        ListEmptyComponent={
          <EmptyState icon="notifications-off-outline" title={t('notificationsInbox.empty')} />
        }
        ListFooterComponent={
          notifications.some((n) => n.read_at) ? (
            <Button title={t('notificationsInbox.deleteAll')} variant="ghost" onPress={clearRead} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.title}
            subtitle={[
              item.body,
              formatDateTime(
                new Date(item.created_at),
                display.timezone,
                display.dateFormat,
                display.timeFormat,
              ),
            ]
              .filter(Boolean)
              .join('\n')}
            left={
              <View>
                <Icon
                  name={ICONS[item.type] ?? 'notifications-outline'}
                  color={item.read_at ? colors.textMuted : colors.primary}
                />
                {!item.read_at && <View style={[styles.unreadDot, { backgroundColor: colors.danger }]} />}
              </View>
            }
            accessibilityHint={item.read_at ? undefined : 'Não lido'}
            onPress={() => open(item)}
          />
        )}
      />
      {notifications.length === 0 ? null : (
        <AppText variant="small" tone="muted" style={styles.note}>
          {t('notificationSettings.remoteNote')}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: spacing.sm },
  unreadDot: { position: 'absolute', right: -2, top: -2, width: 8, height: 8, borderRadius: 4 },
  note: { padding: spacing.lg, textAlign: 'center' },
});
