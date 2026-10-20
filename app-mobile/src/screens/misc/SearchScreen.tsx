import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EventRow } from '@/components/EventRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useEventsMap } from '@/hooks/useEventsView';
import { t } from '@/i18n';
import type { CalendarEvent, Occurrence } from '@/models/types';
import * as api from '@/services/api';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { applyFilters, searchOccurrences } from '@/utils/filters';
import { expandEvent, sortOccurrences } from '@/utils/recurrence';

/** Uma ocorrência representativa de cada evento encontrado (a próxima, ou a última). */
function representative(event: CalendarEvent, now: Date): Occurrence | undefined {
  const start = new Date(event.starts_at);
  const next = expandEvent(event, now, new Date(now.getTime() + 400 * 86_400_000))[0];
  return next ?? expandEvent(event, start, new Date(start.getTime() + 2 * 86_400_000))[0];
}

/** Busca: no servidor quando há internet (só o que a pessoa pode ver), local quando não há. */
export default function SearchScreen() {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const online = useSyncStore((s) => s.online);
  const filters = useUiStore((s) => s.filters);
  const calendars = useCalendarsMap();
  const localEvents = useEventsMap();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [remoteResult, setRemoteResult] = useState<{ query: string; list: CalendarEvent[] | null } | null>(
    null,
  );

  // Espera a pessoa parar de digitar (debounce) para não chamar o servidor a cada letra.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const searchRemote = online && debounced.length >= 2;
  useEffect(() => {
    if (!searchRemote) return;
    let alive = true;
    api
      .searchEvents(debounced, 100)
      .then((list) => alive && setRemoteResult({ query: debounced, list }))
      .catch(() => alive && setRemoteResult({ query: debounced, list: null }));
    return () => {
      alive = false;
    };
  }, [debounced, searchRemote]);

  const remote = searchRemote && remoteResult?.query === debounced ? remoteResult.list : null;
  const loading = searchRemote && remoteResult?.query !== debounced;

  const results = useMemo(() => {
    if (debounced.length < 2) return [];
    const now = new Date();
    const names = Object.fromEntries(Object.values(calendars).map((c) => [c.id, c.name]));
    const colors = Object.fromEntries(Object.values(calendars).map((c) => [c.id, c.color]));
    let list: Occurrence[];
    if (remote) {
      list = remote.map((e) => representative(e, now)).filter((o): o is Occurrence => !!o);
    } else {
      const all = Object.values(localEvents)
        .map((e) => representative(e, now))
        .filter((o): o is Occurrence => !!o);
      list = searchOccurrences(all, debounced, names);
    }
    return sortOccurrences(applyFilters(list, { ...filters, period: filters.period }, null, colors, now));
  }, [debounced, remote, localEvents, calendars, filters]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('search.title') }} />
      <OfflineBanner />
      <View style={styles.header}>
        <TextField
          label={t('search.title')}
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          hint={query.trim().length < 2 ? t('search.hint') : !online ? t('search.offlineNotice') : undefined}
        />
      </View>
      {loading && !results.length ? (
        <LoadingState />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(o) => o.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            debounced.length >= 2 ? (
              <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
                {t('search.results', { n: results.length })}
              </AppText>
            ) : undefined
          }
          ListEmptyComponent={
            debounced.length >= 2 && !loading ? (
              <AppText tone="muted">{t('search.noResults', { q: debounced })}</AppText>
            ) : undefined
          }
          renderItem={({ item }) => (
            <EventRow
              occurrence={item}
              calendarName={calendars[item.event.calendar_id]?.name}
              calendarColor={calendars[item.event.calendar_id]?.color}
              timezone={display.timezone}
              timeFormat={display.timeFormat}
              dateFormat={display.dateFormat}
              onPress={(o) =>
                router.push({ pathname: '/event/[id]', params: { id: o.event.id, date: o.originalDate } })
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: spacing.lg, paddingBottom: 0 },
  list: { padding: spacing.lg, gap: spacing.sm },
});
