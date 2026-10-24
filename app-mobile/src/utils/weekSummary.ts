// "Minha semana em sintonia": números da semana e sugestões com linguagem
// neutra (sem julgar produtividade). Funciona sem IA.
import type { Calendar, DateKey, Occurrence, Task } from '@/models/types';

import { compareKeys } from './dates';
import type { FreeSlot } from './freeTime';
import { conflictingKeys } from './conflicts';
import { isOpen, isOverdue } from './tasks';

export interface WeekSummary {
  events: Occurrence[];
  shared: Occurrence[];
  deadlines: Task[];
  overdue: Task[];
  freeMinutes: number;
  conflicts: number;
  suggestions: { key: 'plan' | 'overdue' | 'conflicts' | 'light'; n: number }[];
}

export function summarizeWeek(input: {
  occurrences: Occurrence[];
  tasks: Task[];
  calendars: Record<string, Calendar>;
  days: DateKey[];
  today: DateKey;
  slots: FreeSlot[];
  now?: Date;
}): WeekSummary {
  const first = input.days[0];
  const last = input.days[input.days.length - 1];
  const events = input.occurrences.filter((o) => o.event.status !== 'cancelled');
  const shared = events.filter((o) => {
    const c = input.calendars[o.event.calendar_id];
    return !!c && c.member_count > 1;
  });
  const open = input.tasks.filter(isOpen);
  const deadlines = open
    .filter((t) => t.due_date && compareKeys(t.due_date, first) >= 0 && compareKeys(t.due_date, last) <= 0)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const overdue = open.filter(
    (t) => isOverdue(t, input.today, input.now) && compareKeys(t.due_date!, input.today) < 0,
  );
  const freeMinutes = input.slots.reduce((s, x) => s + x.minutes, 0);
  const conflicts = conflictingKeys(events.filter((o) => !o.allDay)).size;
  const suggestions: WeekSummary['suggestions'] = [];
  const toPlan = deadlines.filter((t) => t.item_type === 'task').length;
  if (toPlan) suggestions.push({ key: 'plan', n: toPlan });
  if (overdue.length) suggestions.push({ key: 'overdue', n: overdue.length });
  if (conflicts) suggestions.push({ key: 'conflicts', n: conflicts });
  if (!suggestions.length && freeMinutes >= 600) suggestions.push({ key: 'light', n: 0 });
  return { events, shared, deadlines, overdue, freeMinutes, conflicts, suggestions };
}
