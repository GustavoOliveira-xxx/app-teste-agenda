import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useEventsMap } from '@/hooks/useEventsView';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import type { CalendarEvent, EventStatus, Occurrence } from '@/models/types';
import * as api from '@/services/api';
import {
  deleteEvent,
  duplicateEvent,
  restoreEvent,
  setEventStatus,
  setReminders,
  type RecurrenceScope,
} from '@/services/eventActions';
import { useUserId } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { describeActivity } from '@/utils/activity';
import { formatDateTime, formatOccurrenceTime } from '@/utils/dates';
import { canComment, canEditEvent } from '@/utils/permissions';
import { describeRule, expandEvent, parseRule } from '@/utils/recurrence';

import { ReminderPicker } from './ReminderPicker';

function findOccurrence(event: CalendarEvent, date?: string): Occurrence | undefined {
  if (date) {
    const day = new Date(`${date}T00:00:00Z`);
    const found = expandEvent(
      event,
      new Date(day.getTime() - 2 * 86_400_000),
      new Date(day.getTime() + 3 * 86_400_000),
    ).find((o) => o.originalDate === date);
    if (found) return found;
  }
  const start = new Date(event.starts_at);
  return expandEvent(event, start, new Date(start.getTime() + 400 * 86_400_000))[0];
}

function Comments({ event, canWrite }: { event: CalendarEvent; canWrite: boolean }) {
  const display = useDisplaySettings();
  const online = useSyncStore((s) => s.online);
  const { run, busy } = useAction();
  const { confirm } = useFeedback();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const isPending = event.version === 0;
  const { data, reload } = useRemoteData(
    () => (online && !isPending ? api.listComments(event.id) : Promise.resolve([])),
    [event.id, online, isPending],
    [],
  );

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const result = await run(() =>
      editing ? api.editComment(editing, body) : api.addComment(event.id, body),
    );
    if (result.ok) {
      setText('');
      setEditing(null);
      void reload();
    }
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t('events.deleteComment'),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    const result = await run(() => api.deleteComment(id));
    if (result.ok) void reload();
  };

  return (
    <View style={styles.gap}>
      <SectionHeader title={t('events.comments')} />
      {!online ? <AppText tone="muted">{t('events.commentsOffline')}</AppText> : null}
      {online && !data?.length ? <AppText tone="muted">{t('events.noComments')}</AppText> : null}
      {data?.map((c) => (
        <Card key={c.id}>
          <View style={styles.row}>
            <Avatar name={c.author_name} color={c.author_color} size={32} />
            <View style={styles.flex}>
              <AppText variant="label">{c.is_mine ? t('common.you') : c.author_name}</AppText>
              <AppText variant="caption" tone="muted">
                {formatDateTime(
                  new Date(c.created_at),
                  display.timezone,
                  display.dateFormat,
                  display.timeFormat,
                )}
                {c.edited_at ? ` ${t('events.edited')}` : ''}
              </AppText>
            </View>
          </View>
          <AppText tone={c.deleted_at ? 'muted' : 'default'} selectable>
            {c.deleted_at ? t('events.commentDeleted') : c.body}
          </AppText>
          {c.is_mine && !c.deleted_at && canWrite && (
            <View style={styles.row}>
              <Button
                title={t('common.edit')}
                variant="ghost"
                compact
                onPress={() => {
                  setEditing(c.id);
                  setText(c.body ?? '');
                }}
              />
              <Button title={t('common.delete')} variant="ghost" compact onPress={() => remove(c.id)} />
            </View>
          )}
        </Card>
      ))}
      {canWrite && online && !isPending && (
        <>
          <TextField
            label={t('events.commentPlaceholder')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <Button
            title={editing ? t('common.save') : t('events.send')}
            icon="send"
            onPress={send}
            loading={busy}
            compact
          />
        </>
      )}
    </View>
  );
}

function EventHistory({ event }: { event: CalendarEvent }) {
  const display = useDisplaySettings();
  const userId = useUserId();
  const online = useSyncStore((s) => s.online);
  const [open, setOpen] = useState(false);
  const { data } = useRemoteData(
    () =>
      open && online
        ? api.listActivity(event.calendar_id, { eventId: event.id, limit: 20 })
        : Promise.resolve([]),
    [open, online, event.id],
    [],
  );
  return (
    <View style={styles.gap}>
      <Button
        title={t('events.history')}
        icon={open ? 'chevron-up' : 'time-outline'}
        variant="ghost"
        compact
        onPress={() => setOpen((o) => !o)}
      />
      {open &&
        data?.map((entry) => (
          <AppText key={entry.id} variant="small" tone="muted">
            {formatDateTime(
              new Date(entry.created_at),
              display.timezone,
              display.dateFormat,
              display.timeFormat,
            )}{' '}
            · {describeActivity(entry, userId)}
          </AppText>
        ))}
    </View>
  );
}

export default function EventDetailScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const userId = useUserId();
  const { confirm, toast } = useFeedback();
  const events = useEventsMap();
  const calendars = useCalendarsMap();
  const event = events[id];
  const people = useCalendarMembers(event?.calendar_id);
  const occurrence = useMemo(() => (event ? findOccurrence(event, date) : undefined), [event, date]);
  const [reminders, setReminderState] = useState<number[] | null>(null);

  if (!event || !occurrence) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('events.details') }} />
        <EmptyState icon="alert-circle-outline" title={t('events.notFound')} />
      </Screen>
    );
  }

  const calendar = calendars[event.calendar_id];
  const editable = !!calendar && canEditEvent(calendar, event, userId);
  const rule = parseRule(event.recurrence_rule);
  const nameOf = (uid: string | null) =>
    !uid
      ? t('common.exMember')
      : uid === userId
        ? t('common.you')
        : (people.find((p) => p.user_id === uid)?.display_name ?? t('common.someone'));
  const title = event.is_masked ? t('events.maskedTitle') : (occurrence.title ?? '');
  const time = formatOccurrenceTime(occurrence, display.timezone, display.timeFormat, display.dateFormat);
  const eventZoneTime =
    !event.all_day && event.timezone !== display.timezone
      ? `${formatOccurrenceTime(occurrence, event.timezone, display.timeFormat, display.dateFormat)} (${event.timezone})`
      : null;

  const askScope = async (kind: 'edit' | 'delete'): Promise<RecurrenceScope | null> => {
    if (!rule) return 'all';
    const choice = await confirm({
      title: t('recurrence.editScopeTitle'),
      message: kind === 'edit' ? t('recurrence.editScopeMessage') : t('recurrence.deleteScopeMessage'),
      choices: [
        { value: 'this', label: t('recurrence.scopeThis'), destructive: kind === 'delete' },
        { value: 'following', label: t('recurrence.scopeFollowing'), destructive: kind === 'delete' },
        { value: 'all', label: t('recurrence.scopeAll'), destructive: kind === 'delete' },
      ],
    });
    return typeof choice === 'string' ? (choice as RecurrenceScope) : null;
  };

  const edit = async () => {
    const scope = await askScope('edit');
    if (!scope) return;
    router.push({
      pathname: '/event/[id]/edit',
      params: { id: event.id, date: occurrence.originalDate, scope },
    });
  };

  const remove = async () => {
    const scope = await askScope('delete');
    if (!scope) return;
    if (!rule) {
      const ok = await confirm({
        title: t('events.deleteTitle'),
        message: t('events.deleteMessage'),
        destructive: true,
        confirmLabel: t('common.delete'),
      });
      if (!ok) return;
    }
    await deleteEvent(event, scope, occurrence);
    const canUndo = scope === 'all' && event.version > 0;
    toast(
      t('events.deleted'),
      'success',
      canUndo ? { label: t('events.undo'), onPress: () => void restoreEvent(event) } : undefined,
    );
    router.back();
  };

  const changeStatus = async (status: EventStatus, message: string) => {
    await setEventStatus(event, status);
    toast(message);
  };

  const duplicate = async () => {
    const newId = await duplicateEvent(event, occurrence);
    toast(t('events.duplicated'));
    router.replace({ pathname: '/event/[id]/edit', params: { id: newId, scope: 'all' } });
  };

  const share = () =>
    Share.share({
      message: [title, time, occurrence.location, event.url].filter(Boolean).join('\n'),
    });

  const saveReminders = async () => {
    if (!reminders) return;
    await setReminders(event, reminders);
    setReminderState(null);
    toast(t('common.saved'));
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('events.details') }} />
      <Card>
        <View style={styles.row}>
          <View
            style={[styles.colorBar, { backgroundColor: event.color ?? calendar?.color ?? colors.primary }]}
          />
          <View style={styles.flex}>
            <AppText
              variant="title"
              selectable
              style={event.status === 'cancelled' ? { textDecorationLine: 'line-through' } : undefined}
            >
              {title}
            </AppText>
            <AppText tone="muted">{calendar?.name}</AppText>
          </View>
        </View>
        <View style={styles.row}>
          <Icon name="time-outline" size={20} color={colors.textMuted} />
          <AppText style={styles.flex}>{time}</AppText>
        </View>
        {eventZoneTime ? (
          <AppText variant="small" tone="muted">
            {eventZoneTime}
          </AppText>
        ) : null}
        {rule ? (
          <View style={styles.row}>
            <Icon name="repeat" size={20} color={colors.textMuted} />
            <AppText style={styles.flex}>{describeRule(rule, occurrence.originalDate)}</AppText>
          </View>
        ) : null}
        <View style={styles.badges}>
          <Badge
            label={strings.eventStatus[event.status]}
            tone={
              event.status === 'cancelled' ? 'danger' : event.status === 'completed' ? 'success' : 'neutral'
            }
          />
          {!event.is_masked && <Badge label={strings.eventTypes[event.event_type]} />}
          {event.privacy !== 'members' && (
            <Badge label={strings.privacy[event.privacy]} icon="lock-closed-outline" />
          )}
          {occurrence.isException && <Badge label={t('events.exception')} tone="warning" />}
          {event.pending && (
            <Badge label={t('events.pendingBadge')} tone="warning" icon="cloud-upload-outline" />
          )}
        </View>
      </Card>

      {event.is_masked ? (
        <AppText tone="muted">{t('events.maskedMessage')}</AppText>
      ) : (
        <>
          {(occurrence.location || event.address) && (
            <Card>
              <View style={styles.row}>
                <Icon name="location-outline" size={20} color={colors.textMuted} />
                <View style={styles.flex}>
                  {occurrence.location ? <AppText selectable>{occurrence.location}</AppText> : null}
                  {event.address ? (
                    <AppText tone="muted" selectable>
                      {event.address}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </Card>
          )}
          {event.url ? (
            <Button
              title={t('events.openLink')}
              icon="open-outline"
              variant="secondary"
              onPress={() => Linking.openURL(event.url!)}
            />
          ) : null}
          {occurrence.description ? (
            <Card>
              <AppText selectable>{occurrence.description}</AppText>
            </Card>
          ) : null}
          <Card>
            {event.assignee_id ? (
              <AppText>
                {t('events.assignee')}: {nameOf(event.assignee_id)}
              </AppText>
            ) : null}
            {event.attendee_ids.length > 0 && (
              <AppText>
                {t('events.participants')}: {event.attendee_ids.map(nameOf).join(', ')}
              </AppText>
            )}
            <AppText variant="small" tone="muted">
              {t('events.createdBy', { name: nameOf(event.created_by) })}
            </AppText>
            <AppText variant="small" tone="muted">
              {t('events.updatedAt', {
                date: formatDateTime(
                  new Date(event.updated_at),
                  display.timezone,
                  display.dateFormat,
                  display.timeFormat,
                ),
              })}
            </AppText>
          </Card>
        </>
      )}

      <Card>
        <ReminderPicker value={reminders ?? event.my_reminders} onChange={setReminderState} />
        {reminders && <Button title={t('common.save')} onPress={saveReminders} compact />}
      </Card>

      {editable ? (
        <View style={styles.gap}>
          <Button title={t('common.edit')} icon="create-outline" onPress={edit} testID="event-edit" />
          {event.status !== 'completed' ? (
            <Button
              title={t('events.markDone')}
              icon="checkmark-done-outline"
              variant="secondary"
              onPress={() => changeStatus('completed', t('events.markedDone'))}
            />
          ) : (
            <Button
              title={t('events.reopen')}
              icon="refresh"
              variant="secondary"
              onPress={() => changeStatus('confirmed', t('common.saved'))}
            />
          )}
          {event.status !== 'cancelled' && (
            <Button
              title={t('events.cancelEvent')}
              icon="close-circle-outline"
              variant="secondary"
              onPress={() => changeStatus('cancelled', t('events.cancelled'))}
            />
          )}
          <Button title={t('events.duplicate')} icon="copy-outline" variant="secondary" onPress={duplicate} />
          <Button title={t('events.share')} icon="share-social-outline" variant="secondary" onPress={share} />
          <Button
            title={t('common.delete')}
            icon="trash-outline"
            variant="danger"
            onPress={remove}
            testID="event-delete"
          />
        </View>
      ) : (
        <>
          {!event.is_masked && (
            <Button
              title={t('events.share')}
              icon="share-social-outline"
              variant="secondary"
              onPress={share}
            />
          )}
          <AppText tone="muted">{t('events.readOnlyNotice')}</AppText>
        </>
      )}

      {!event.is_masked && calendar && (
        <>
          <Comments event={event} canWrite={canComment(calendar)} />
          <EventHistory event={event} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  colorBar: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gap: { gap: spacing.sm },
});
