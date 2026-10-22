// Tela Hoje: data em overline, saudação, semana compacta, faixa de
// sincronização e os compromissos do dia em cartões. Anéis de órbita no canto
// superior direito, sangrando pela borda.
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { OrbitRings, useDecorSize } from '@/components/brand/Decor';
import { EventRow } from '@/components/EventRow';
import { FAB } from '@/components/FAB';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { EnterItem, PressableScale, tapFeedback } from '@/components/motion';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useOccurrences } from '@/hooks/useEventsView';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { strings, t } from '@/i18n';
import type { DateKey, Occurrence } from '@/models/types';
import { ensureRange, syncNow } from '@/offline/syncEngine';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, motion, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { conflictingKeys } from '@/utils/conflicts';
import {
  addDaysToKey,
  capitalize,
  dateKeyParts,
  formatLongDate,
  spannedDayKeys,
  startOfDayInstant,
  todayKey,
  weekKeys,
} from '@/utils/dates';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';
import { canCreateEvents } from '@/utils/permissions';

function greeting(name: string, hour: number): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  const key = hour < 12 ? 'today.morning' : hour < 18 ? 'today.afternoon' : 'today.evening';
  return t(key, { name: first });
}

/** Semana compacta: a bolha do dia escolhido escorrega até o dia novo. */
function WeekStrip({
  days,
  selected,
  today,
  busy,
  onSelect,
}: {
  days: DateKey[];
  selected: DateKey;
  today: DateKey;
  busy: Set<DateKey>;
  onSelect: (day: DateKey) => void;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const [cell, setCell] = useState(0);
  const index = Math.max(0, days.indexOf(selected));
  const x = useSharedValue(index * cell);
  const placed = useRef(false);
  useEffect(() => {
    if (!cell) return;
    if (!placed.current) {
      placed.current = true;
      x.value = index * cell;
      return;
    }
    x.value = reduceMotion
      ? withTiming(index * cell, { duration: 150 })
      : withSpring(index * cell, motion.mola);
  }, [index, cell, reduceMotion, x]);
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const bubbleW = Math.min(44, cell - 4);

  return (
    <View
      style={styles.week}
      onLayout={(e) => setCell(e.nativeEvent.layout.width / 7)}
      accessibilityRole="tablist"
    >
      {cell > 0 && (
        <Animated.View
          style={[
            styles.bubble,
            { width: bubbleW, left: (cell - bubbleW) / 2, backgroundColor: colors.primary },
            bubble,
          ]}
        />
      )}
      {days.map((day) => {
        const { day: d } = dateKeyParts(day);
        const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
        const isSel = day === selected;
        const fg = isSel ? colors.primaryText : day < today ? colors.textMuted : colors.text;
        return (
          <Pressable
            key={day}
            onPress={() => {
              if (!isSel) tapFeedback('select');
              onSelect(day);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${formatLongDate(day)}${day === today ? `, ${t('common.today')}` : ''}${busy.has(day) ? `, ${t('today.hasEvents')}` : ''}`}
            style={styles.weekCell}
          >
            <AppText
              variant="overline"
              maxFontSizeMultiplier={1.2}
              style={{ color: isSel ? fg : colors.textMuted }}
            >
              {strings.weekdays.letter[wd]}
            </AppText>
            <AppText
              maxFontSizeMultiplier={1.2}
              style={[styles.weekNum, { color: fg }, (isSel || day === today) && fonte('tituloForte')]}
            >
              {d}
            </AppText>
            <View
              style={[
                styles.weekDot,
                {
                  backgroundColor: busy.has(day)
                    ? isSel
                      ? colors.primaryText
                      : colors.coral
                    : 'transparent',
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Faixa "Tudo sincronizado · N agendas": o ícone gira enquanto sincroniza. */
function SyncPill({ calendars }: { calendars: number }) {
  const { colors, reduceMotion } = useAppTheme();
  const syncing = useSyncStore((s) => s.syncing);
  const pending = useSyncStore((s) => s.outbox.length);
  const online = useSyncStore((s) => s.online);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (syncing && !reduceMotion) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(spin);
      spin.value = withTiming(0, { duration: 200 });
    }
  }, [syncing, reduceMotion, spin]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const warn = !online || pending > 0;
  const text = !online
    ? t('today.offline')
    : syncing
      ? t('today.syncing')
      : pending
        ? t('today.pending', { n: pending })
        : t('today.synced', { n: calendars });
  return (
    <PressableScale
      onPress={() => router.push('/sync')}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={[styles.pill, { backgroundColor: warn ? colors.warningSoft : colors.primarySoft }]}
    >
      <Animated.View style={iconStyle}>
        <Icon
          name={!online ? 'cloud-offline-outline' : 'sync-outline'}
          size={16}
          color={warn ? colors.warning : colors.primaryInk}
        />
      </Animated.View>
      <AppText variant="label" style={{ color: warn ? colors.warning : colors.primaryInk }}>
        {text}
      </AppText>
    </PressableScale>
  );
}

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocus();
  const display = useDisplaySettings();
  const tz = display.timezone;
  const today = todayKey(tz);
  // Sem escolha, o dia mostrado é sempre hoje (inclusive quando o dia vira).
  const [picked, setPicked] = useState<DateKey | null>(null);
  const selected = picked ?? today;
  const setSelected = (day: DateKey) => setPicked(day === today ? null : day);
  const name = useAuthStore((s) => s.account?.display_name ?? '');
  const calendars = useDataStore((s) => s.calendars);
  const hydrated = useDataStore((s) => s.hydrated);
  const unread = useDataStore((s) => s.notifications.filter((n) => !n.read_at).length);
  const calendarsMap = useCalendarsMap();
  const syncing = useSyncStore((s) => s.syncing);
  // Anéis no canto: proporcionais à largura, sem invadir a semana logo abaixo.
  const decor = Math.min(useDecorSize('header') * 1.25, 168);

  const days = useMemo(() => weekKeys(selected, display.weekStartsOn), [selected, display.weekStartsOn]);
  const from = useMemo(() => startOfDayInstant(days[0], tz), [days, tz]);
  const to = useMemo(() => startOfDayInstant(addDaysToKey(days[6], 1), tz), [days, tz]);
  const occurrences = useOccurrences(from, to);
  const conflicts = useMemo(() => conflictingKeys(occurrences), [occurrences]);

  useEffect(() => {
    void ensureRange(from, to);
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<DateKey, Occurrence[]>();
    for (const occ of occurrences) {
      for (const day of spannedDayKeys(occ, tz)) {
        const list = map.get(day) ?? [];
        list.push(occ);
        map.set(day, list);
      }
    }
    return map;
  }, [occurrences, tz]);
  const busy = useMemo(() => new Set(byDay.keys()), [byDay]);
  const list = byDay.get(selected) ?? [];

  const openEvent = useCallback(
    (occ: Occurrence) =>
      router.push({ pathname: '/event/[id]', params: { id: occ.event.id, date: occ.originalDate } }),
    [],
  );
  const newEvent = () => router.push({ pathname: '/event/new', params: { date: selected } });
  const writable = calendars.some((c) => canCreateEvents(c));
  const active = calendars.filter((c) => !c.deleted_at && c.status === 'active').length;

  if (!hydrated) return <LoadingState />;

  const hour = new Date().getHours();
  const dateLine = capitalize(formatLongDate(selected));

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />}
      >
        <View style={styles.column}>
          <OrbitRings
            size={decor}
            paused={!focused}
            style={[styles.decor, { right: -decor * 0.34, top: -decor * 0.42 }]}
          />
          <View style={styles.header}>
            <View style={[styles.flex, { paddingRight: spacing.sm }]}>
              <AppText variant="overline" tone="muted" accessibilityRole="text">
                {dateLine}
              </AppText>
              <AppText variant="title" style={styles.greeting} numberOfLines={2}>
                {selected === today
                  ? greeting(name, hour)
                  : capitalize(formatLongDate(selected).split(',')[0])}
              </AppText>
            </View>
            <View>
              <IconButton
                icon={unread ? 'notifications-unread' : 'notifications-outline'}
                label={unread ? t('tabs.notificationsUnread', { n: unread }) : t('tabs.notifications')}
                filled
                onPress={() => router.push('/notifications')}
              />
            </View>
          </View>

          <WeekStrip days={days} selected={selected} today={today} busy={busy} onSelect={setSelected} />

          <View style={styles.pillRow}>
            <SyncPill calendars={active} />
            {selected !== today && (
              <PressableScale
                onPress={() => setSelected(today)}
                accessibilityRole="button"
                accessibilityLabel={t('calendarView.goToToday')}
                style={[styles.pill, { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Icon name="today-outline" size={16} color={colors.text} />
                <AppText variant="label">{t('common.today')}</AppText>
              </PressableScale>
            )}
          </View>

          {calendars.length === 0 ? (
            <EmptyState
              art="orbit"
              title={t('calendars.emptyTitle')}
              message={t('calendars.emptyMessage')}
              actionLabel={t('calendars.new')}
              onAction={() => router.push('/calendar/new')}
            />
          ) : list.length === 0 ? (
            <EmptyState
              art="kairo"
              title={t('today.emptyTitle')}
              message={t('today.emptyMessage')}
              actionLabel={writable ? t('today.createEvent') : undefined}
              onAction={writable ? newEvent : undefined}
            />
          ) : (
            <View style={styles.list} key={selected}>
              {list.map((occ, i) => (
                <EnterItem key={occ.key} index={i}>
                  <EventRow
                    occurrence={occ}
                    calendarName={calendarsMap[occ.event.calendar_id]?.name}
                    calendarColor={calendarsMap[occ.event.calendar_id]?.color}
                    timezone={tz}
                    timeFormat={display.timeFormat}
                    dateFormat={display.dateFormat}
                    conflict={conflicts.has(occ.key)}
                    onPress={openEvent}
                  />
                </EnterItem>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {writable && <FAB label={t('calendarView.newEvent')} onPress={newEvent} />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: 120 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: spacing.lg },
  decor: { position: 'absolute', opacity: 0.9 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  greeting: { fontSize: 26, lineHeight: 32, marginTop: spacing.xs },
  week: { flexDirection: 'row', marginHorizontal: -spacing.xs },
  bubble: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 2, minHeight: 64 },
  weekNum: { fontSize: 18, lineHeight: 24, ...fonte('negrito'), fontVariant: ['tabular-nums'] },
  weekDot: { width: 5, height: 5, borderRadius: 3 },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    minHeight: 36,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  list: { gap: spacing.md },
});
