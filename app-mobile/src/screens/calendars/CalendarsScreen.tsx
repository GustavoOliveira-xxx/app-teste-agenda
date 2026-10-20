import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconButton } from '@/components/IconButton';
import { ListItem } from '@/components/ListItem';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import type { Calendar } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { spacing } from '@/theme/tokens';

function ColorDot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function CalendarItem({ calendar }: { calendar: Calendar }) {
  const subtitle = [
    strings.calendarKinds[calendar.kind],
    t('calendars.members', { n: calendar.member_count }),
    t('calendars.yourRole', { role: strings.roles[calendar.my_role] }),
  ].join(' · ');
  return (
    <ListItem
      title={calendar.name}
      subtitle={subtitle}
      left={<ColorDot color={calendar.color} />}
      onPress={() => router.push({ pathname: '/calendar/[id]', params: { id: calendar.id } })}
    />
  );
}

export default function CalendarsScreen() {
  const navigation = useNavigation();
  const calendars = useDataStore((s) => s.calendars);
  const syncing = useSyncStore((s) => s.syncing);
  const online = useSyncStore((s) => s.online);
  const invites = useRemoteData(() => (online ? api.myInvitations() : Promise.resolve([])), [online], []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton icon="add" label={t('calendars.new')} onPress={() => router.push('/calendar/new')} />
      ),
    });
  }, [navigation]);

  const groups = useMemo(
    () => ({
      active: calendars.filter((c) => !c.deleted_at && c.status === 'active'),
      archived: calendars.filter((c) => !c.deleted_at && c.status === 'archived'),
      trash: calendars.filter((c) => !!c.deleted_at),
    }),
    [calendars],
  );
  const pendingInvites = invites.data?.length ?? 0;

  return (
    <Screen
      refreshing={syncing}
      onRefresh={() => {
        void syncNow();
        void invites.refresh();
      }}
    >
      <View style={styles.actions}>
        <Button
          title={t('calendars.joinWithCode')}
          icon="key-outline"
          variant="secondary"
          onPress={() => router.push('/invites/accept')}
        />
        <Button
          title={
            pendingInvites
              ? `${t('calendars.invitesReceived')} (${pendingInvites})`
              : t('calendars.invitesReceived')
          }
          icon="mail-outline"
          variant={pendingInvites ? 'primary' : 'secondary'}
          onPress={() => router.push('/invites')}
        />
      </View>

      {calendars.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title={t('calendars.emptyTitle')}
          message={t('calendars.emptyMessage')}
          actionLabel={t('calendars.new')}
          onAction={() => router.push('/calendar/new')}
        />
      ) : (
        <>
          <Card padded={false}>
            {groups.active.map((c) => (
              <CalendarItem key={c.id} calendar={c} />
            ))}
          </Card>
          {groups.archived.length > 0 && (
            <>
              <SectionHeader title={t('calendars.archived')} />
              <Card padded={false}>
                {groups.archived.map((c) => (
                  <CalendarItem key={c.id} calendar={c} />
                ))}
              </Card>
            </>
          )}
          {groups.trash.length > 0 && (
            <>
              <SectionHeader title={t('calendars.trash')} />
              <Card padded={false}>
                {groups.trash.map((c) => (
                  <CalendarItem key={c.id} calendar={c} />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  dot: { width: 16, height: 16, borderRadius: 8 },
});
