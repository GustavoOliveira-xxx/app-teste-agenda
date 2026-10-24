// Transforma o resultado da adição rápida em tarefa, lembrete ou evento.
import type { Calendar, DateKey } from '@/models/types';
import { addDaysToKey, todayKey } from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import type { QuickParse } from '@/utils/quickAdd';
import { parseRule } from '@/utils/recurrence';
import { newEventForm, type EventForm } from '@/validation/event';
import { newTaskForm, type TaskForm } from '@/validation/task';

import { createEvent } from './eventActions';
import { createTask } from './itemActions';

export interface QuickDefaults {
  timezone: string;
  /** Lista em que a tarefa nasce (a lista aberta na aba Tarefas). */
  listId?: string | null;
  /** Agenda da lista, quando a lista é compartilhada. */
  calendarId?: string | null;
  /** Coloca no "Meu dia" de hoje (ex.: criada pela pergunta do dia). */
  planDay?: DateKey | null;
  defaultReminder?: number | null;
}

export function parseToTaskForm(parse: QuickParse, defaults: QuickDefaults): TaskForm {
  return newTaskForm(parse.kind === 'reminder' ? 'reminder' : 'task', defaults.timezone, {
    title: parse.title,
    dueDate: parse.date,
    dueTime: parse.time,
    recurrence: parseRule(parse.recurrence?.rule),
    recurrenceMode: parse.recurrence?.mode ?? 'calendar',
    priority: parse.priority ?? 0,
    tags: parse.tags,
    listId: defaults.listId ?? null,
    calendarId: defaults.calendarId ?? null,
    alerts: parse.kind === 'reminder' || (parse.date && parse.time) ? [0] : [],
  });
}

/** Agenda padrão para eventos criados pela adição rápida: a pessoal, se der. */
export function defaultEventCalendar(calendars: Calendar[]): Calendar | undefined {
  const writable = calendars.filter((c) => canCreateEvents(c));
  return writable.find((c) => c.kind === 'personal') ?? writable[0];
}

export function parseToEventForm(parse: QuickParse, calendarId: string, defaults: QuickDefaults): EventForm {
  const day = parse.date ?? todayKey(defaults.timezone);
  const base = newEventForm(calendarId, defaults.timezone, day, new Date(), defaults.defaultReminder ?? null);
  const start = parse.time ?? base.startTime;
  const end = parse.endTime ?? base.endTime;
  return {
    ...base,
    title: parse.title,
    startDate: day,
    startTime: start,
    endDate: end <= start ? addDaysToKey(day, 1) : day,
    endTime: end,
    eventType: 'appointment',
    recurrence: parseRule(parse.recurrence?.rule),
  };
}

/** Salva direto (quando não há nada para conferir). Devolve o tipo e o id criados. */
export async function saveQuick(
  parse: QuickParse,
  calendars: Calendar[],
  defaults: QuickDefaults,
): Promise<{ kind: 'task' | 'reminder' | 'event'; id: string } | null> {
  if (parse.kind === 'event') {
    const calendar = defaultEventCalendar(calendars);
    if (!calendar) return null;
    const id = await createEvent(parseToEventForm(parse, calendar.id, defaults));
    return { kind: 'event', id };
  }
  const id = await createTask(parseToTaskForm(parse, defaults), { planDay: defaults.planDay ?? null });
  return { kind: parse.kind, id };
}
