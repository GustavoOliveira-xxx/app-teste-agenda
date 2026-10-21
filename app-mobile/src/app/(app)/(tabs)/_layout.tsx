import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '@/components/Icon';
import { useLayout } from '@/hooks/useLayout';
import { t } from '@/i18n';
import { useDataStore } from '@/stores/dataStore';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const unread = useDataStore((s) => s.notifications.filter((n) => !n.read_at).length);
  // Tablet e computador: menu lateral. Celular: abas embaixo, ao alcance do polegar.
  const { sideNav } = useLayout();
  return (
    <Tabs
      screenOptions={{
        tabBarPosition: sideNav ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: sideNav ? colors.primarySoft : undefined,
        tabBarStyle: sideNav
          ? { backgroundColor: colors.surface, borderRightColor: colors.border, width: 240, minWidth: 240 }
          : { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: sideNav ? 15 : 12, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.calendar'),
          tabBarIcon: ({ color }) => <Icon name="calendar" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="calendars"
        options={{
          title: t('tabs.calendars'),
          tabBarIcon: ({ color }) => <Icon name="albums-outline" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarAccessibilityLabel:
            unread > 0 ? t('tabs.notificationsUnread', { n: unread }) : t('tabs.notifications'),
          tabBarIcon: ({ color }) => <Icon name="notifications-outline" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Icon name="person-circle-outline" color={color as string} />,
        }}
      />
    </Tabs>
  );
}
