// Ações de eventos usadas pelas telas. Todas passam pela fila offline:
// funcionam sem internet e são enviadas assim que possível.
import { TIME_GROUP } from '@/offline/merge';
import { makeOp, type OutboxOp } from '@/offline/outbox';
import { newId } from '@/offline/storage';
import { enqueueOp, discardOperation, replaceOperation } from '@/offline/syncEngine';
import type { CalendarEvent, EventFields, EventStatus, Occurrence } from '@/models/types';
import {
  addDaysToKey,
  allDayInstants,
  diffDays,
  instantToLocal,
  localToInstant,
  toDateKey,
} from '@/utils/dates';
import {
  isFirstOccurrence,
  parseRule,
  ruleEndingBefore,
  ruleForFollowing,
  serializeRule,
} from '@/utils/recurrence';
import { changedFields, formToFields, type EventForm } from '@/validation/event';

export type RecurrenceScope = 'this' | 'following' | 'all';

function snapshot(event: Partial<CalendarEvent>, changes: Partial<EventFields>): Partial<EventFields> {
  const keys = Object.keys(changes);
  if (keys.some((k) => (TIME_GROUP as string[]).includes(k))) keys.push(...(TIME_GROUP as string[]));
  return Object.fromEntries(
    [...new Set(keys)].map((k) => [k, event[k as keyof CalendarEvent] ?? null]),
  ) as Partial<EventFields>;
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

async function queueExtras(eventId: string, calendarId: string, form: EventForm, previous?: CalendarEvent) {
  if (!previous ? form.reminders.length > 0 : !sameList(form.reminders, previous.my_reminders)) {
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'reminders_set',
        entityId: eventId,
        calendarId,
        payload: { minutes: form.reminders },
      }),
    );
  }
  if (!previous ? form.attendeeIds.length > 0 : !sameList(form.attendeeIds, previous.attendee_ids)) {
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'attendees_set',
        entityId: eventId,
        calendarId,
        payload: { user_ids: form.attendeeIds },
      }),
    );
  }
}

export async function createEvent(form: EventForm): Promise<string> {
  const id = newId();
  const fields = formToFields(form);
  await enqueueOp(
    makeOp({
      id: newId(),
      kind: 'create',
      entityId: id,
      calendarId: form.calendarId,
      payload: { ...fields, calendar_id: form.calendarId },
    }),
  );
  await queueExtras(id, form.calendarId, form);
  return id;
}

/**
 * Ao editar "todas as ocorrências" a partir de uma ocorrência específica,
 * mantém a data de início da série e aplica só o novo horário e duração.
 */
function seriesFieldsFromForm(
  event: CalendarEvent,
  occurrence: Occurrence,
  fields: EventFields,
): EventFields {
  if (!event.recurrence_rule) return fields;
  const tz = fields.timezone;
  if (fields.all_day && fields.start_date && fields.end_date) {
    const seriesStart = event.start_date ?? toDateKey(new Date(event.starts_at), event.timezone);
    const length = diffDays(fields.end_date, fields.start_date);
    const end = addDaysToKey(seriesStart, length);
    const { startsAt, endsAt } = allDayInstants(seriesStart, end, tz);
    return { ...fields, start_date: seriesStart, end_date: end, starts_at: startsAt, ends_at: endsAt };
  }
  const seriesStartKey =
    event.all_day && event.start_date
      ? event.start_date
      : toDateKey(new Date(event.starts_at), event.timezone);
  const startLocal = instantToLocal(new Date(fields.starts_at), tz);
  const durationMs = new Date(fields.ends_at).getTime() - new Date(fields.starts_at).getTime();
  // Se a pessoa também mudou o dia da ocorrência, a série inteira anda o mesmo número de dias.
  const dayShift = diffDays(startLocal.dateKey, occurrence.originalDate);
  const newStart = localToInstant(addDaysToKey(seriesStartKey, dayShift), startLocal.time, tz);
  return {
    ...fields,
    starts_at: newStart.toISOString(),
    ends_at: new Date(newStart.getTime() + durationMs).toISOString(),
  };
}

export async function updateEvent(
  event: CalendarEvent,
  form: EventForm,
  scope: RecurrenceScope,
  occurrence?: Occurrence,
): Promise<void> {
  const fields = formToFields(form);
  const recurring = !!event.recurrence_rule && !!occurrence;

  if (recurring && scope === 'this') {
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'exception_upsert',
        entityId: event.id,
        calendarId: event.calendar_id,
        payload: {
          original_date: occurrence.originalDate,
          is_cancelled: false,
          title: fields.title !== event.title ? fields.title : null,
          description: fields.description !== event.description ? fields.description : null,
          location: fields.location !== event.location ? fields.location : null,
          starts_at: fields.starts_at,
          ends_at: fields.ends_at,
        },
      }),
    );
    await queueExtras(event.id, event.calendar_id, form, event);
    return;
  }

  const rule = parseRule(event.recurrence_rule);
  const seriesStartKey =
    event.all_day && event.start_date
      ? event.start_date
      : toDateKey(new Date(event.starts_at), event.timezone);
  if (
    recurring &&
    scope === 'following' &&
    rule &&
    !isFirstOccurrence(rule, seriesStartKey, occurrence.originalDate)
  ) {
    const newRule = form.recurrence
      ? ruleForFollowing(form.recurrence, seriesStartKey, occurrence.originalDate)
      : null;
    const newEventId = newId();
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'split_series',
        entityId: event.id,
        calendarId: event.calendar_id,
        baseVersion: event.version,
        payload: {
          original_rule: serializeRule(ruleEndingBefore(rule, occurrence.originalDate)),
          new_event: { ...fields, id: newEventId, recurrence_rule: newRule ? serializeRule(newRule) : null },
        },
      }),
    );
    await queueExtras(newEventId, event.calendar_id, form);
    return;
  }

  const target = recurring ? seriesFieldsFromForm(event, occurrence, fields) : fields;
  const changes = changedFields(event, target);
  if (Object.keys(changes).length > 0) {
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'update',
        entityId: event.id,
        calendarId: event.calendar_id,
        payload: changes,
        baseVersion: event.version,
        baseSnapshot: snapshot(event, changes),
      }),
    );
  }
  await queueExtras(event.id, event.calendar_id, form, event);
}

export async function deleteEvent(
  event: CalendarEvent,
  scope: RecurrenceScope,
  occurrence?: Occurrence,
): Promise<void> {
  const rule = parseRule(event.recurrence_rule);
  const seriesStartKey =
    event.all_day && event.start_date
      ? event.start_date
      : toDateKey(new Date(event.starts_at), event.timezone);
  if (rule && occurrence && scope === 'this') {
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'exception_upsert',
        entityId: event.id,
        calendarId: event.calendar_id,
        payload: { original_date: occurrence.originalDate, is_cancelled: true },
      }),
    );
    return;
  }
  if (
    rule &&
    occurrence &&
    scope === 'following' &&
    !isFirstOccurrence(rule, seriesStartKey, occurrence.originalDate)
  ) {
    const changes = { recurrence_rule: serializeRule(ruleEndingBefore(rule, occurrence.originalDate)) };
    await enqueueOp(
      makeOp({
        id: newId(),
        kind: 'update',
        entityId: event.id,
        calendarId: event.calendar_id,
        payload: changes,
        baseVersion: event.version,
        baseSnapshot: { recurrence_rule: event.recurrence_rule },
      }),
    );
    return;
  }
  await enqueueOp(
    makeOp({
      id: newId(),
      kind: 'delete',
      entityId: event.id,
      calendarId: event.calendar_id,
      payload: {},
      baseVersion: event.version,
    }),
  );
}

export async function restoreEvent(event: Pick<CalendarEvent, 'id' | 'calendar_id'>): Promise<void> {
  await enqueueOp(
    makeOp({ id: newId(), kind: 'restore', entityId: event.id, calendarId: event.calendar_id, payload: {} }),
  );
}

export async function setEventStatus(event: CalendarEvent, status: EventStatus): Promise<void> {
  await enqueueOp(
    makeOp({
      id: newId(),
      kind: 'update',
      entityId: event.id,
      calendarId: event.calendar_id,
      payload: { status },
      baseVersion: event.version,
      baseSnapshot: { status: event.status },
    }),
  );
}

export async function duplicateEvent(event: CalendarEvent, occurrence?: Occurrence): Promise<string> {
  const id = newId();
  const start = occurrence?.start ?? new Date(event.starts_at);
  const end = occurrence?.end ?? new Date(event.ends_at);
  const payload: Record<string, unknown> = {
    calendar_id: event.calendar_id,
    title: occurrence?.title ?? event.title,
    description: event.description,
    location: occurrence?.location ?? event.location,
    address: event.address,
    url: event.url,
    all_day: event.all_day,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    start_date: occurrence?.startDate ?? event.start_date,
    end_date: occurrence?.endDate ?? event.end_date,
    timezone: event.timezone,
    recurrence_rule: null,
    color: event.color,
    event_type: event.event_type,
    status: event.status === 'cancelled' ? 'planned' : event.status,
    privacy: event.privacy,
  };
  await enqueueOp(
    makeOp({ id: newId(), kind: 'create', entityId: id, calendarId: event.calendar_id, payload }),
  );
  return id;
}

export async function setReminders(event: CalendarEvent, minutes: number[]): Promise<void> {
  await enqueueOp(
    makeOp({
      id: newId(),
      kind: 'reminders_set',
      entityId: event.id,
      calendarId: event.calendar_id,
      payload: { minutes },
    }),
  );
}

// ---------------------------------------------------------------------
// Resolução de conflitos (tela de Sincronização)
// ---------------------------------------------------------------------

export type ConflictChoice = 'mine' | 'server' | 'recreate' | 'accept_delete';

export async function resolveConflict(op: OutboxOp, choice: ConflictChoice): Promise<void> {
  const server = op.conflict?.server ?? {};
  if (choice === 'server' || choice === 'accept_delete') {
    await discardOperation(op.id);
    return;
  }
  if (choice === 'mine') {
    // Reenvia a minha versão sobre a versão atual do servidor.
    await replaceOperation(op.id, {
      status: 'pending',
      conflict: null,
      baseVersion: (server.version as number | undefined) ?? op.baseVersion,
      baseSnapshot: snapshot(server, op.payload as Partial<EventFields>),
      attempts: 0,
    });
    return;
  }
  // Recriar: o evento foi excluído por outra pessoa; cria um novo com meus dados.
  const id = newId();
  await discardOperation(op.id);
  const payload: Record<string, unknown> = {
    calendar_id: op.calendarId,
    title: server.title,
    description: server.description,
    location: server.location,
    address: server.address,
    url: server.url,
    all_day: server.all_day,
    starts_at: server.starts_at,
    ends_at: server.ends_at,
    start_date: server.start_date,
    end_date: server.end_date,
    timezone: server.timezone,
    recurrence_rule: server.recurrence_rule,
    color: server.color,
    event_type: server.event_type,
    status: server.status,
    privacy: server.privacy,
    ...op.payload,
  };
  await enqueueOp(makeOp({ id: newId(), kind: 'create', entityId: id, calendarId: op.calendarId, payload }));
}
