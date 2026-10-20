import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { ListItem } from '@/components/ListItem';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { AppText } from '@/components/AppText';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useCalendarsMap, useEventsMap } from '@/hooks/useEventsView';
import { strings, t } from '@/i18n';
import { makeOp } from '@/offline/outbox';
import { newId } from '@/offline/storage';
import { enqueueOp } from '@/offline/syncEngine';
import { useUserId } from '@/stores/authStore';
import { canEditEvent } from '@/utils/permissions';

/** Participantes do evento: quem foi escolhido entre os membros da agenda. */
export default function ParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEventsMap()[id];
  const calendar = useCalendarsMap()[event?.calendar_id ?? ''];
  const members = useCalendarMembers(event?.calendar_id);
  const userId = useUserId();
  const { toast } = useFeedback();
  const [selected, setSelected] = useState<string[] | null>(null);

  if (!event || !calendar) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('events.notFound')} />
      </Screen>
    );
  }
  const editable = canEditEvent(calendar, event, userId);
  const current = selected ?? event.attendee_ids;

  const save = async () => {
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'attendees_set',
        entityId: event.id,
        calendarId: event.calendar_id,
        payload: { user_ids: current },
      }),
    );
    setSelected(null);
    toast(t('common.saved'));
  };

  return (
    <Screen footer={editable && selected ? <Button title={t('common.save')} onPress={save} /> : undefined}>
      <Stack.Screen options={{ title: t('events.participants') }} />
      <AppText tone="muted">{t('events.participantsHint')}</AppText>
      <Card padded={false}>
        {members.map((m) =>
          editable ? (
            <SwitchRow
              key={m.user_id}
              label={m.is_me ? `${m.display_name} ${t('members.me')}` : m.display_name}
              hint={strings.roles[m.role]}
              value={current.includes(m.user_id)}
              onChange={(on) =>
                setSelected(on ? [...current, m.user_id] : current.filter((x) => x !== m.user_id))
              }
            />
          ) : current.includes(m.user_id) ? (
            <ListItem
              key={m.user_id}
              title={m.display_name}
              left={<Avatar name={m.display_name} color={m.avatar_color} />}
              right={<Badge label={strings.roles[m.role]} />}
            />
          ) : null,
        )}
      </Card>
    </Screen>
  );
}
