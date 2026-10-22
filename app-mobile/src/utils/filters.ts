// Filtros da visão de calendário e da busca.
import type { EventStatus, EventType, Occurrence } from '@/models/types';

import { agendaColor } from '@/theme/tokens';

import { normalizeText } from './text';

export type Ownership = 'all' | 'mine' | 'shared';
export type PeriodFilter = 'all' | 'future' | 'past' | 'next7' | 'next30';

export interface EventFilters {
  /** Agendas exibidas (vazio = todas). */
  calendarIds: string[];
  types: EventType[];
  statuses: EventStatus[];
  ownership: Ownership;
  participantId: string | null;
  color: string | null;
  privateOnly: boolean;
  recurringOnly: boolean;
  showCancelled: boolean;
  period: PeriodFilter;
}

export const DEFAULT_FILTERS: EventFilters = {
  calendarIds: [],
  types: [],
  statuses: [],
  ownership: 'all',
  participantId: null,
  color: null,
  privateOnly: false,
  recurringOnly: false,
  showCancelled: true,
  period: 'all',
};

/** Quantos filtros estão diferentes do padrão (para mostrar no botão). */
export function activeFilterCount(filters: EventFilters): number {
  let n = 0;
  if (filters.calendarIds.length) n++;
  if (filters.types.length) n++;
  if (filters.statuses.length) n++;
  if (filters.ownership !== 'all') n++;
  if (filters.participantId) n++;
  if (filters.color) n++;
  if (filters.privateOnly) n++;
  if (filters.recurringOnly) n++;
  if (!filters.showCancelled) n++;
  if (filters.period !== 'all') n++;
  return n;
}

function inPeriod(occ: Occurrence, period: PeriodFilter, now: Date): boolean {
  const day = 86_400_000;
  switch (period) {
    case 'future':
      return occ.end > now;
    case 'past':
      return occ.end <= now;
    case 'next7':
      return occ.end > now && occ.start.getTime() < now.getTime() + 7 * day;
    case 'next30':
      return occ.end > now && occ.start.getTime() < now.getTime() + 30 * day;
    default:
      return true;
  }
}

export function applyFilters(
  list: Occurrence[],
  filters: EventFilters,
  userId: string | null,
  calendarColors: Record<string, string> = {},
  now: Date = new Date(),
): Occurrence[] {
  return list.filter((occ) => {
    const e = occ.event;
    if (filters.calendarIds.length && !filters.calendarIds.includes(e.calendar_id)) return false;
    if (filters.types.length && !filters.types.includes(e.event_type)) return false;
    if (filters.statuses.length && !filters.statuses.includes(e.status)) return false;
    if (!filters.showCancelled && e.status === 'cancelled') return false;
    if (filters.ownership === 'mine' && e.created_by !== userId) return false;
    if (filters.ownership === 'shared' && (e.created_by === userId || e.is_masked)) return false;
    if (filters.participantId) {
      const involved =
        e.created_by === filters.participantId ||
        e.assignee_id === filters.participantId ||
        e.attendee_ids.includes(filters.participantId);
      if (!involved) return false;
    }
    if (filters.color) {
      // Cores da paleta antiga contam como a cor nova equivalente.
      const color = (agendaColor(e.color ?? calendarColors[e.calendar_id], false) ?? '').toLowerCase();
      if (color !== (agendaColor(filters.color, false) ?? '').toLowerCase()) return false;
    }
    if (filters.privateOnly && e.privacy === 'members') return false;
    if (filters.recurringOnly && !occ.isRecurring) return false;
    return inPeriod(occ, filters.period, now);
  });
}

/** Busca local (usada offline e para filtrar o que já está na tela). */
export function searchOccurrences(
  list: Occurrence[],
  query: string,
  calendarNames: Record<string, string> = {},
): Occurrence[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const terms = q.split(/\s+/);
  return list.filter((occ) => {
    if (occ.event.is_masked) return false;
    const haystack = normalizeText(
      [
        occ.title,
        occ.description,
        occ.location,
        occ.event.address,
        calendarNames[occ.event.calendar_id],
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
