import { useMemo } from 'react';

import type { DateKey, Occurrence } from '@/models/types';
import { useUserId } from '@/stores/authStore';
import { addDaysToKey, startOfDayInstant } from '@/utils/dates';
import { busyFromOccurrences, freeSlots, type FreeSlot, type Interval } from '@/utils/freeTime';

import { useDisplaySettings } from './useDisplaySettings';
import { useOccurrences } from './useEventsView';

/** O que ocupa a agenda da pessoa: eventos visíveis, sem os "Ocupado" de outros. */
export function myBusy(occurrences: Occurrence[], userId: string | null): Interval[] {
  return busyFromOccurrences(
    occurrences.filter(
      (o) =>
        !o.event.is_masked &&
        (o.event.attendee_ids.length === 0 || (!!userId && o.event.attendee_ids.includes(userId))),
    ),
  );
}

/** Horários livres nos dias pedidos (janela do dia da pessoa). */
export function useFreeSlots(
  days: DateKey[],
  minMinutes = 30,
): { slots: FreeSlot[]; occurrences: Occurrence[] } {
  const display = useDisplaySettings();
  const userId = useUserId();
  const first = days[0];
  const last = days[days.length - 1];
  const from = useMemo(() => startOfDayInstant(first, display.timezone), [first, display.timezone]);
  const to = useMemo(
    () => startOfDayInstant(addDaysToKey(last, 1), display.timezone),
    [last, display.timezone],
  );
  const occurrences = useOccurrences(from, to);
  const key = days.join(',');
  const slots = useMemo(
    () =>
      freeSlots(
        myBusy(occurrences, userId),
        key.split(','),
        display.timezone,
        display.dayStart,
        display.dayEnd,
        {
          minMinutes,
          now: new Date(),
        },
      ),
    [occurrences, userId, key, display.timezone, display.dayStart, display.dayEnd, minMinutes],
  );
  return { slots, occurrences };
}
