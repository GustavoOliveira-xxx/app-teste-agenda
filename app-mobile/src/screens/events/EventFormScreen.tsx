// Criação e edição de eventos (inclusive "só esta ocorrência" e "esta e as próximas").
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ColorPicker } from '@/components/ColorPicker';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useEventsMap, useOccurrences } from '@/hooks/useEventsView';
import { strings, t } from '@/i18n';
import type {
  Calendar,
  CalendarEvent,
  EventPrivacy,
  EventStatus,
  EventType,
  Occurrence,
} from '@/models/types';
import { createEvent, updateEvent, type RecurrenceScope } from '@/services/eventActions';
import { requestPermission } from '@/services/localNotifications';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { spacing } from '@/theme/tokens';
import { findConflicts } from '@/utils/conflicts';
import { addDaysToKey, diffDays, todayKey } from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import {
  describeRule,
  presetToRule,
  ruleToPreset,
  WEEKDAY_CODES,
  expandEvent,
  type Frequency,
  type RecurrencePreset,
  type RecurrenceRule,
} from '@/utils/recurrence';
import { timezoneOptions } from '@/utils/timezones';
import {
  eventToForm,
  formInstants,
  newEventForm,
  validateEventForm,
  type EventForm,
} from '@/validation/event';

import { ReminderPicker } from './ReminderPicker';

const TYPES = Object.keys(strings.eventTypes) as EventType[];
const STATUSES = Object.keys(strings.eventStatus) as EventStatus[];
const PRIVACIES = Object.keys(strings.privacy) as EventPrivacy[];

function RecurrenceEditor({
  rule,
  startDate,
  onChange,
  error,
}: {
  rule: RecurrenceRule | null;
  startDate: string;
  onChange: (rule: RecurrenceRule | null) => void;
  error?: string;
}) {
  const r = strings.recurrence;
  const preset = ruleToPreset(rule, startDate);
  const [custom, setCustom] = useState(preset === 'custom');
  const choose = (value: RecurrencePreset) => {
    if (value === 'custom') {
      setCustom(true);
      onChange(rule ?? presetToRule('weekly', startDate));
    } else {
      setCustom(false);
      onChange(presetToRule(value, startDate));
    }
  };
  const end: 'never' | 'until' | 'count' = rule?.until ? 'until' : rule?.count ? 'count' : 'never';

  return (
    <View style={styles.gap}>
      <SelectField<RecurrencePreset>
        label={t('events.repeat')}
        value={custom ? 'custom' : preset}
        onChange={choose}
        options={(['none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'] as const).map(
          (p) => ({
            value: p,
            label: r[p],
          }),
        )}
      />
      {rule && custom && (
        <Card>
          <SelectField<Frequency>
            label={r.frequency}
            value={rule.freq}
            onChange={(freq) =>
              onChange({ ...rule, freq, byDay: freq === 'WEEKLY' ? rule.byDay : [], byMonthDay: null })
            }
            options={[
              { value: 'DAILY', label: r.unitDays },
              { value: 'WEEKLY', label: r.unitWeeks },
              { value: 'MONTHLY', label: r.unitMonths },
              { value: 'YEARLY', label: r.unitYears },
            ]}
          />
          <TextField
            label={r.interval}
            value={String(rule.interval)}
            keyboardType="number-pad"
            onChangeText={(v) =>
              onChange({ ...rule, interval: Math.max(1, Math.min(99, Number(v.replace(/\D/g, '')) || 1)) })
            }
          />
          {rule.freq === 'WEEKLY' && (
            <View style={styles.gap}>
              <AppText variant="label">{r.weekdaysLabel}</AppText>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const code = WEEKDAY_CODES[wd];
                  const selected = rule.byDay.includes(code);
                  return (
                    <Chip
                      key={code}
                      label={strings.weekdays.short[wd]}
                      accessibilityLabel={strings.weekdays.long[wd]}
                      selected={selected}
                      onPress={() =>
                        onChange({
                          ...rule,
                          byDay: selected ? rule.byDay.filter((d) => d !== code) : [...rule.byDay, code],
                        })
                      }
                    />
                  );
                })}
              </View>
            </View>
          )}
          {rule.freq === 'MONTHLY' && Number(startDate.slice(8)) > 28 && (
            <AppText variant="small" tone="muted">
              {r.month31Note}
            </AppText>
          )}
          <SelectField<'never' | 'until' | 'count'>
            label={r.endLabel}
            value={end}
            onChange={(v) =>
              onChange({
                ...rule,
                until: v === 'until' ? (rule.until ?? addDaysToKey(startDate, 90)) : null,
                count: v === 'count' ? (rule.count ?? 10) : null,
              })
            }
            options={[
              { value: 'never', label: r.endNever },
              { value: 'until', label: r.endUntil },
              { value: 'count', label: r.endCount },
            ]}
          />
          {end === 'until' && rule.until && (
            <DateTimeField
              mode="date"
              label={r.endUntil}
              value={rule.until}
              onChange={(v) => onChange({ ...rule, until: v })}
            />
          )}
          {end === 'count' && (
            <TextField
              label={r.endCount}
              value={String(rule.count ?? '')}
              keyboardType="number-pad"
              onChangeText={(v) =>
                onChange({ ...rule, count: Math.min(999, Number(v.replace(/\D/g, '')) || 1) })
              }
            />
          )}
        </Card>
      )}
      {rule && (
        <AppText variant="small" tone="muted">
          {describeRule(rule, startDate)}
        </AppText>
      )}
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function Form({
  initial,
  event,
  occurrence,
  scope,
  calendars,
}: {
  initial: EventForm;
  event?: CalendarEvent;
  occurrence?: Occurrence;
  scope: RecurrenceScope;
  calendars: Calendar[];
}) {
  const display = useDisplaySettings();
  const userId = useUserId();
  const { toast } = useFeedback();
  const online = useSyncStore((s) => s.online);
  const [form, setForm] = useState<EventForm>(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateEventForm>>({});
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(!!event);
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const calendar = calendars.find((c) => c.id === form.calendarId);
  const onlyThis = scope === 'this' && !!event?.recurrence_rule;

  // Conflito de horário (regra 30): avisa sem impedir, salvo se a agenda bloquear.
  const instants = formInstants(form);
  const dayStart = instants?.start ?? new Date();
  const around = useOccurrences(
    new Date(dayStart.getTime() - 86_400_000),
    new Date(dayStart.getTime() + 2 * 86_400_000),
  );
  const conflicts = useMemo(() => {
    if (!instants || !calendar || calendar.conflict_policy === 'ignore') return [];
    return findConflicts(
      { ...instants, allDay: form.allDay },
      around.filter((o) => o.event.calendar_id === form.calendarId),
      event?.id,
    );
  }, [instants, calendar, around, form.allDay, form.calendarId, event?.id]);

  const people = useCalendarMembers(form.calendarId);

  const setStartDate = (v: string) => {
    // Mantém a duração ao mudar a data de início.
    const length = Math.max(0, diffDays(form.endDate, form.startDate));
    setForm((f) => ({ ...f, startDate: v, endDate: addDaysToKey(v, length) }));
  };

  const save = async () => {
    const v = validateEventForm(form);
    setErrors(v);
    if (Object.keys(v).length) {
      toast(t('errors.invalidData'), 'error');
      return;
    }
    if (calendar?.conflict_policy === 'block' && conflicts.length) {
      toast(t('events.conflictBlocked'), 'error');
      return;
    }
    if (form.privacy === 'private' && calendar && !calendar.allow_private_events) {
      toast(t('errors.privateDisabled'), 'error');
      return;
    }
    setSaving(true);
    try {
      if (form.reminders.length) await requestPermission().catch(() => false);
      if (event) await updateEvent(event, form, scope, occurrence);
      else await createEvent(form);
      toast(online ? (event ? t('events.updated') : t('events.created')) : t('events.savedOffline'));
      router.back();
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} loading={saving} testID="event-save" />}>
      {!event && (
        <SelectField<string>
          label={t('events.calendar')}
          value={form.calendarId}
          onChange={(v) => {
            setForm((f) => ({ ...f, calendarId: v, attendeeIds: [], assigneeId: null }));
          }}
          options={calendars.map((c) => ({
            value: c.id,
            label: c.name,
            description: strings.calendarKinds[c.kind],
          }))}
        />
      )}
      <TextField
        label={t('events.titleLabel')}
        placeholder={t('events.titlePlaceholder')}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        error={errors.title}
        maxLength={150}
        testID="event-title"
      />
      {!onlyThis && (
        <SwitchRow label={t('events.allDay')} value={form.allDay} onChange={(v) => set('allDay', v)} />
      )}
      <View style={styles.row}>
        <DateTimeField
          mode="date"
          label={t('events.startDate')}
          value={form.startDate}
          onChange={setStartDate}
          dateFormat={display.dateFormat}
          error={errors.start}
        />
        {!form.allDay && (
          <DateTimeField
            mode="time"
            label={t('events.startTime')}
            value={form.startTime}
            onChange={(v) => set('startTime', v)}
            timeFormat={display.timeFormat}
          />
        )}
      </View>
      <View style={styles.row}>
        <DateTimeField
          mode="date"
          label={t('events.endDate')}
          value={form.endDate}
          onChange={(v) => set('endDate', v)}
          dateFormat={display.dateFormat}
          error={errors.end}
        />
        {!form.allDay && (
          <DateTimeField
            mode="time"
            label={t('events.endTime')}
            value={form.endTime}
            onChange={(v) => set('endTime', v)}
            timeFormat={display.timeFormat}
          />
        )}
      </View>
      {conflicts.length > 0 && (
        <AppText tone="warning" accessibilityLiveRegion="polite">
          {conflicts.length === 1
            ? t('events.conflictWarning', {
                title: conflicts[0].event.is_masked ? t('common.busy') : (conflicts[0].title ?? ''),
              })
            : t('events.conflictWarningMany', { n: conflicts.length })}
          {calendar?.conflict_policy === 'block' ? ` ${t('events.conflictBlocked')}` : ''}
        </AppText>
      )}
      {!onlyThis && (
        <RecurrenceEditor
          rule={form.recurrence}
          startDate={form.startDate}
          onChange={(r) => set('recurrence', r)}
          error={errors.recurrence}
        />
      )}
      <TextField
        label={`${t('events.location')} (${t('common.optional')})`}
        placeholder={t('events.locationPlaceholder')}
        value={form.location}
        onChangeText={(v) => set('location', v)}
        error={errors.location}
        maxLength={200}
      />
      <ReminderPicker value={form.reminders} onChange={(v) => set('reminders', v)} error={errors.reminders} />

      <Button
        title={showMore ? t('events.lessOptions') : t('events.moreOptions')}
        icon={showMore ? 'chevron-up' : 'chevron-down'}
        variant="ghost"
        onPress={() => setShowMore((s) => !s)}
      />
      {showMore && (
        <>
          <TextField
            label={`${t('events.description')} (${t('common.optional')})`}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            error={errors.description}
            multiline
            maxLength={5000}
          />
          {!onlyThis && (
            <>
              <TextField
                label={`${t('events.address')} (${t('common.optional')})`}
                value={form.address}
                onChangeText={(v) => set('address', v)}
                error={errors.address}
                maxLength={300}
              />
              <TextField
                label={`${t('events.link')} (${t('common.optional')})`}
                placeholder={t('events.linkPlaceholder')}
                value={form.url}
                onChangeText={(v) => set('url', v)}
                error={errors.url}
                keyboardType="url"
                autoCapitalize="none"
              />
              <SelectField<EventType>
                label={t('events.type')}
                value={form.eventType}
                onChange={(v) => set('eventType', v)}
                options={TYPES.map((v) => ({ value: v, label: strings.eventTypes[v] }))}
              />
              <SelectField<EventStatus>
                label={t('events.status')}
                value={form.status}
                onChange={(v) => set('status', v)}
                options={STATUSES.map((v) => ({ value: v, label: strings.eventStatus[v] }))}
              />
              <SelectField<EventPrivacy>
                label={t('events.privacy')}
                value={form.privacy}
                onChange={(v) => set('privacy', v)}
                options={PRIVACIES.map((v) => ({
                  value: v,
                  label: strings.privacy[v],
                  description: strings.privacyDescriptions[v],
                  disabled: v === 'private' && calendar ? !calendar.allow_private_events : false,
                }))}
              />
              <ColorPicker
                label={t('events.color')}
                value={form.color}
                onChange={(v) => set('color', v)}
                allowNone
                noneLabel={t('events.useCalendarColor')}
              />
              {people.length > 0 && (
                <>
                  <SelectField<string | null>
                    label={t('events.assignee')}
                    value={form.assigneeId}
                    onChange={(v) => set('assigneeId', v)}
                    options={[
                      { value: null, label: t('events.noAssignee') },
                      ...people.map((p) => ({
                        value: p.user_id as string | null,
                        label: p.is_me ? t('common.you') : p.display_name,
                      })),
                    ]}
                  />
                  <SectionHeader title={t('events.participants')} />
                  <AppText variant="small" tone="muted">
                    {t('events.participantsHint')}
                  </AppText>
                  <View style={styles.chips}>
                    {people.map((p) => {
                      const selected = form.attendeeIds.includes(p.user_id);
                      return (
                        <Chip
                          key={p.user_id}
                          label={p.user_id === userId ? t('common.you') : p.display_name}
                          selected={selected}
                          onPress={() =>
                            set(
                              'attendeeIds',
                              selected
                                ? form.attendeeIds.filter((x) => x !== p.user_id)
                                : [...form.attendeeIds, p.user_id],
                            )
                          }
                        />
                      );
                    })}
                  </View>
                </>
              )}
              <SelectField<string>
                label={t('events.timezone')}
                value={form.timezone}
                onChange={(v) => set('timezone', v)}
                options={timezoneOptions(display.timezone)}
                searchable
                searchPlaceholder={t('preferences.searchTimezone')}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/** Rota /event/new (com ?date= e ?calendarId=) e /event/[id]/edit (com ?date= e ?scope=). */
export default function EventFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    date?: string;
    calendarId?: string;
    scope?: RecurrenceScope;
  }>();
  const display = useDisplaySettings();
  const account = useAuthStore((s) => s.account);
  const allCalendars = useDataStore((s) => s.calendars);
  const calendarsMap = useCalendarsMap();
  const events = useEventsMap();
  const writable = useMemo(() => allCalendars.filter((c) => canCreateEvents(c)), [allCalendars]);

  const event = params.id ? events[params.id] : undefined;
  const scope: RecurrenceScope = params.scope ?? 'all';
  const occurrence = useMemo(() => {
    if (!event || !params.date) return undefined;
    const day = new Date(`${params.date}T00:00:00Z`);
    return expandEvent(
      event,
      new Date(day.getTime() - 2 * 86_400_000),
      new Date(day.getTime() + 3 * 86_400_000),
    ).find((o) => o.originalDate === params.date);
  }, [event, params.date]);

  if (params.id && !event) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('events.notFound')} />
      </Screen>
    );
  }
  if (!params.id && writable.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="albums-outline"
          title={t('calendars.emptyTitle')}
          message={t('calendars.emptyMessage')}
        />
      </Screen>
    );
  }

  let initial: EventForm;
  if (event) {
    // "Todas": formulário com a série; "só esta" / "esta e as próximas": com a ocorrência.
    initial = eventToForm(event, occurrence);
  } else {
    const preferred =
      writable.find((c) => c.id === params.calendarId) ??
      writable.find((c) => c.kind !== 'personal') ??
      writable[0];
    // O evento nasce no fuso em que a pessoa está (pode ser trocado em "Mais opções").
    initial = newEventForm(
      preferred.id,
      display.timezone,
      params.date ?? todayKey(display.timezone),
      new Date(),
      account?.notification_preferences.default_reminder_minutes ?? null,
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: event ? t('events.edit') : t('events.new') }} />
      <Form
        initial={initial}
        event={event}
        occurrence={occurrence}
        scope={scope}
        calendars={event ? [calendarsMap[event.calendar_id]].filter(Boolean) : writable}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  gap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
