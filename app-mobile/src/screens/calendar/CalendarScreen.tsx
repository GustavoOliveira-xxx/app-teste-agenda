// Tela principal: calendário em visão mensal, semanal, diária ou lista.
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EventRow } from '@/components/EventRow';
import { FAB } from '@/components/FAB';
import { IconButton } from '@/components/IconButton';
import { MonthGrid, type DayInfo } from '@/components/MonthGrid';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useOccurrences } from '@/hooks/useEventsView';
import { t } from '@/i18n';
import type { DateKey, Occurrence } from '@/models/types';
import { ensureRange, syncNow } from '@/offline/syncEngine';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore, type CalendarViewMode } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { conflictingKeys } from '@/utils/conflicts';
import {
  addDaysToKey,
  addMonthsToKey,
  capitalize,
  dateKeyParts,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  monthMatrix,
  spannedDayKeys,
  startOfDayInstant,
  todayKey,
  weekKeys,
} from '@/utils/dates';
import { activeFilterCount } from '@/utils/filters';
import { canCreateEvents } from '@/utils/permissions';

interface Section {
  title: string;
  day: DateKey;
  data: Occurrence[];
}

function groupByDay(list: Occurrence[], tz: string, days?: DateKey[]): Map<DateKey, Occurrence[]> {
  const map = new Map<DateKey, Occurrence[]>();
  days?.forEach((d) => map.set(d, []));
  for (const occ of list) {
    for (const day of spannedDayKeys(occ, tz)) {
      if (days && !map.has(day)) continue;
      const bucket = map.get(day) ?? [];
      bucket.push(occ);
      map.set(day, bucket);
    }
  }
  return map;
}

export default function CalendarScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const display = useDisplaySettings();
  const tz = display.timezone;
  const today = todayKey(tz);

  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const selected = useUiStore((s) => s.selectedDate) ?? today;
  const setSelected = useUiStore((s) => s.setSelectedDate);
  const filters = useUiStore((s) => s.filters);
  const listTab = useUiStore((s) => s.listTab);
  const setListTab = useUiStore((s) => s.setListTab);

  const calendars = useDataStore((s) => s.calendars);
  const hydrated = useDataStore((s) => s.hydrated);
  const calendarsMap = useCalendarsMap();
  const syncing = useSyncStore((s) => s.syncing);
  const pending = useSyncStore((s) => s.outbox.length);
  const online = useSyncStore((s) => s.online);

  const { year, month } = dateKeyParts(selected);

  // Período visível em datas locais (no fuso de exibição).
  const [firstDay, lastDay] = useMemo((): [DateKey, DateKey] => {
    if (viewMode === 'month') {
      const grid = monthMatrix(year, month, display.weekStartsOn);
      return [grid[0][0], grid[5][6]];
    }
    if (viewMode === 'week') {
      const week = weekKeys(selected, display.weekStartsOn);
      return [week[0], week[6]];
    }
    if (viewMode === 'day') return [selected, selected];
    return listTab === 'upcoming' ? [today, addDaysToKey(today, 180)] : [addDaysToKey(today, -180), today];
  }, [viewMode, year, month, selected, display.weekStartsOn, listTab, today]);

  const from = useMemo(() => startOfDayInstant(firstDay, tz), [firstDay, tz]);
  const to = useMemo(() => startOfDayInstant(addDaysToKey(lastDay, 1), tz), [lastDay, tz]);
  const occurrences = useOccurrences(from, to, filters);
  const conflicts = useMemo(() => conflictingKeys(occurrences), [occurrences]);

  useEffect(() => {
    void ensureRange(from, to);
  }, [from, to]);

  const byDay = useMemo(() => groupByDay(occurrences, tz), [occurrences, tz]);

  const monthDays = useMemo(() => {
    const info: Record<DateKey, DayInfo> = {};
    byDay.forEach((list, day) => {
      info[day] = {
        count: list.length,
        colors: list.map((o) => o.event.color ?? calendarsMap[o.event.calendar_id]?.color ?? colors.primary),
      };
    });
    return info;
  }, [byDay, calendarsMap, colors.primary]);

  const writable = calendars.filter((c) => canCreateEvents(c));
  const nFilters = activeFilterCount(filters);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton icon="search" label={t('common.search')} onPress={() => router.push('/search')} />
          <IconButton
            icon={nFilters ? 'funnel' : 'funnel-outline'}
            label={
              nFilters
                ? `${t('common.filters')}, ${t('filters.active', { n: nFilters })}`
                : t('common.filters')
            }
            onPress={() => router.push('/filters')}
            color={nFilters ? colors.primary : undefined}
          />
          <IconButton
            icon={!online ? 'cloud-offline-outline' : pending ? 'cloud-upload-outline' : 'cloud-done-outline'}
            label={
              !online ? t('sync.offline') : pending ? t('sync.pending', { n: pending }) : t('sync.synced')
            }
            onPress={() => router.push('/sync')}
            color={!online || pending ? colors.warning : undefined}
          />
        </View>
      ),
    });
  }, [navigation, nFilters, colors, online, pending]);

  const move = (direction: 1 | -1) => {
    if (viewMode === 'month') setSelected(addMonthsToKey(`${selected.slice(0, 7)}-01`, direction));
    else if (viewMode === 'week') setSelected(addDaysToKey(selected, 7 * direction));
    else setSelected(addDaysToKey(selected, direction));
  };

  const openEvent = useCallback(
    (occ: Occurrence) =>
      router.push({ pathname: '/event/[id]', params: { id: occ.event.id, date: occ.originalDate } }),
    [],
  );

  const renderRow = (occ: Occurrence) => (
    <EventRow
      key={occ.key}
      occurrence={occ}
      calendarName={calendarsMap[occ.event.calendar_id]?.name}
      calendarColor={calendarsMap[occ.event.calendar_id]?.color}
      timezone={tz}
      timeFormat={display.timeFormat}
      dateFormat={display.dateFormat}
      conflict={conflicts.has(occ.key)}
      onPress={openEvent}
    />
  );

  const periodTitle =
    viewMode === 'month'
      ? capitalize(formatMonthYear(year, month))
      : viewMode === 'week'
        ? t('calendarView.weekRange', { start: formatShortDate(firstDay), end: formatShortDate(lastDay) })
        : viewMode === 'day'
          ? capitalize(formatLongDate(selected))
          : '';

  if (!hydrated) return <LoadingState />;

  const refresh = <RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />;

  const header = (
    <View style={styles.controls}>
      <SegmentedControl<CalendarViewMode>
        label={t('tabs.calendar')}
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'month', label: t('calendarView.month') },
          { value: 'week', label: t('calendarView.week') },
          { value: 'day', label: t('calendarView.day') },
          { value: 'list', label: t('calendarView.list') },
        ]}
      />
      {viewMode !== 'list' ? (
        <View style={styles.periodRow}>
          <IconButton icon="chevron-back" label={t('calendarView.previous')} onPress={() => move(-1)} />
          <AppText variant="heading" center style={styles.flex} accessibilityLiveRegion="polite">
            {periodTitle}
          </AppText>
          <IconButton icon="chevron-forward" label={t('calendarView.next')} onPress={() => move(1)} />
        </View>
      ) : (
        <SegmentedControl
          label={t('calendarView.list')}
          value={listTab}
          onChange={setListTab}
          options={[
            { value: 'upcoming', label: t('calendarView.upcoming') },
            { value: 'past', label: t('calendarView.past') },
          ]}
        />
      )}
      {selected !== today && viewMode !== 'list' ? (
        <Button
          title={t('calendarView.goToToday')}
          icon="today-outline"
          variant="secondary"
          compact
          onPress={() => setSelected(today)}
        />
      ) : null}
    </View>
  );

  const noCalendars = calendars.length === 0;
  const emptyMessage = nFilters ? t('calendarView.noResults') : t('calendarView.emptyMessage');

  let content: React.ReactNode;
  if (viewMode === 'month' || viewMode === 'day') {
    const dayList = byDay.get(selected) ?? [];
    content = (
      <ScrollView refreshControl={refresh} contentContainerStyle={styles.scroll}>
        {header}
        {viewMode === 'month' && (
          <MonthGrid
            year={year}
            month={month}
            weekStartsOn={display.weekStartsOn}
            selected={selected}
            today={today}
            days={monthDays}
            onSelect={setSelected}
          />
        )}
        <AppText variant="label" tone="muted" style={styles.dayTitle}>
          {capitalize(formatLongDate(selected))}
        </AppText>
        {dayList.length ? (
          <View style={styles.list}>{dayList.map(renderRow)}</View>
        ) : (
          <AppText tone="muted">
            {noCalendars ? t('calendars.emptyMessage') : t('calendarView.noEventsDay')}
          </AppText>
        )}
      </ScrollView>
    );
  } else if (viewMode === 'week') {
    const days = weekKeys(selected, display.weekStartsOn);
    const grouped = groupByDay(occurrences, tz, days);
    content = (
      <ScrollView refreshControl={refresh} contentContainerStyle={styles.scroll}>
        {header}
        {days.map((day) => {
          const list = grouped.get(day) ?? [];
          return (
            <View key={day} style={styles.weekDay}>
              <AppText variant="label" tone={day === today ? 'primary' : 'muted'}>
                {capitalize(formatLongDate(day))}
                {day === today ? ` · ${t('common.today')}` : ''}
              </AppText>
              {list.length ? (
                <View style={styles.list}>{list.map(renderRow)}</View>
              ) : (
                <AppText variant="small" tone="muted">
                  {t('calendarView.noEventsDay')}
                </AppText>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  } else {
    // Lista: seções por dia, com rolagem virtualizada (listas longas).
    const sections: Section[] = [];
    const entries = [...groupByDay(occurrences, tz).entries()].filter(([day]) =>
      listTab === 'upcoming' ? day >= today : day <= today,
    );
    entries.sort(([a], [b]) => (listTab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
    for (const [day, data] of entries) {
      const items = listTab === 'past' ? data.filter((o) => o.end <= new Date() || day < today) : data;
      if (items.length) sections.push({ day, title: capitalize(formatLongDate(day, true)), data: items });
    }
    content = (
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.key}-${index}`}
        ListHeaderComponent={header}
        refreshControl={refresh}
        contentContainerStyle={styles.scroll}
        stickySectionHeadersEnabled={false}
        initialNumToRender={15}
        windowSize={7}
        renderSectionHeader={({ section }) => (
          <AppText variant="label" tone={section.day === today ? 'primary' : 'muted'} style={styles.dayTitle}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => <View style={styles.listItem}>{renderRow(item)}</View>}
        ListEmptyComponent={
          <EmptyState
            title={nFilters ? t('calendarView.noResults') : t('calendarView.emptyTitle')}
            message={emptyMessage}
          />
        }
      />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      {noCalendars && hydrated && !syncing ? (
        <EmptyState
          icon="albums-outline"
          title={t('calendars.emptyTitle')}
          message={t('calendars.emptyMessage')}
          actionLabel={t('calendars.new')}
          onAction={() => router.push('/calendar/new')}
        />
      ) : (
        content
      )}
      {writable.length > 0 && (
        <FAB
          label={t('calendarView.newEvent')}
          onPress={() => router.push({ pathname: '/event/new', params: { date: selected } })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  controls: { gap: spacing.md, marginBottom: spacing.sm },
  periodRow: { flexDirection: 'row', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  dayTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  list: { gap: spacing.sm },
  listItem: { marginBottom: spacing.sm },
  weekDay: { gap: spacing.sm, marginTop: spacing.sm },
});
