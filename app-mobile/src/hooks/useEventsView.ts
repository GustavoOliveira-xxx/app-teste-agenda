import { useMemo } from 'react';

import type { Calendar, CalendarEvent, Occurrence } from '@/models/types';
import { overlayPending } from '@/offline/outbox';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { applyFilters, type EventFilters } from '@/utils/filters';
import { expandEvents } from '@/utils/recurrence';

/** Eventos como a pessoa deve ver: servidor + alterações locais ainda não enviadas. */
export function useEventsMap(): Record<string, CalendarEvent> {
  const events = useDataStore((s) => s.events);
  const outbox = useSyncStore((s) => s.outbox);
  const userId = useUserId();
  return useMemo(() => overlayPending(events, outbox, userId), [events, outbox, userId]);
}

export function useCalendarsMap(): Record<string, Calendar> {
  const calendars = useDataStore((s) => s.calendars);
  return useMemo(() => Object.fromEntries(calendars.map((c) => [c.id, c])), [calendars]);
}

/** Ocorrências no período, já filtradas (agendas fora da lixeira + filtros). */
export function useOccurrences(from: Date, to: Date, filters?: EventFilters): Occurrence[] {
  const events = useEventsMap();
  const calendars = useCalendarsMap();
  const userId = useUserId();
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return useMemo(() => {
    const visible = Object.values(events).filter(
      (e) => calendars[e.calendar_id] && !calendars[e.calendar_id].deleted_at,
    );
    const list = expandEvents(visible, new Date(fromMs), new Date(toMs));
    if (!filters) return list;
    const colors = Object.fromEntries(Object.values(calendars).map((c) => [c.id, c.color]));
    return applyFilters(list, filters, userId, colors);
  }, [events, calendars, fromMs, toMs, filters, userId]);
}
