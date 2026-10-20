// Detecção de conflito de horário (regra 30): o app AVISA; só bloqueia se a
// agenda estiver configurada para isso (e o servidor também confere).
import type { Occurrence } from '@/models/types';

export interface TimeSlot {
  start: Date;
  end: Date;
  allDay: boolean;
}

/** Ocorrências que se sobrepõem ao horário proposto (ignora dia inteiro, canceladas e o próprio evento). */
export function findConflicts(
  slot: TimeSlot,
  occurrences: Occurrence[],
  ignoreEventId?: string,
): Occurrence[] {
  if (slot.allDay) return [];
  return occurrences.filter(
    (o) =>
      !o.allDay &&
      o.event.id !== ignoreEventId &&
      o.event.status !== 'cancelled' &&
      o.event.status !== 'archived' &&
      o.start < slot.end &&
      o.end > slot.start,
  );
}

/** Para a visão de calendário: chaves das ocorrências que conflitam entre si. */
export function conflictingKeys(occurrences: Occurrence[]): Set<string> {
  const timed = occurrences
    .filter((o) => !o.allDay && o.event.status !== 'cancelled' && !o.event.is_masked)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const keys = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && timed[j].start < timed[i].end; j++) {
      if (timed[i].event.calendar_id === timed[j].event.calendar_id) {
        keys.add(timed[i].key);
        keys.add(timed[j].key);
      }
    }
  }
  return keys;
}
