import type { Occurrence } from '@/models/types';

import { conflictingKeys, findConflicts } from '../conflicts';
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, searchOccurrences } from '../filters';
import { expandEvent } from '../recurrence';

import { makeEvent } from './fixtures';

const range = [new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z')] as const;
const occ = (overrides: Parameters<typeof makeEvent>[0]): Occurrence =>
  expandEvent(makeEvent(overrides), ...range)[0];

const list: Occurrence[] = [
  occ({
    id: 'a',
    title: 'Reunião de condomínio',
    calendar_id: 'c1',
    created_by: 'me',
    event_type: 'meeting',
    location: 'Salão',
  }),
  occ({
    id: 'b',
    title: 'Dentista',
    calendar_id: 'c2',
    created_by: 'other',
    privacy: 'busy',
    status: 'cancelled',
    starts_at: '2026-11-12T12:00:00Z',
    ends_at: '2026-11-12T13:00:00Z',
  }),
  occ({
    id: 'c',
    title: 'Academia',
    calendar_id: 'c1',
    created_by: 'other',
    recurrence_rule: 'FREQ=DAILY',
    attendee_ids: ['me'],
    color: '#30A46C',
    starts_at: '2026-11-13T10:00:00Z',
    ends_at: '2026-11-13T11:00:00Z',
  }),
];

describe('filtros', () => {
  it('sem filtros mostra tudo', () => {
    expect(applyFilters(list, DEFAULT_FILTERS, 'me')).toHaveLength(3);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it('por agenda, tipo, status, autoria, privacidade, recorrência, participante e cor', () => {
    const ids = (f: Partial<typeof DEFAULT_FILTERS>) =>
      applyFilters(list, { ...DEFAULT_FILTERS, ...f }, 'me', { c1: '#4F7DF3', c2: '#E5484D' }).map(
        (o) => o.event.id,
      );
    expect(ids({ calendarIds: ['c1'] })).toEqual(['a', 'c']);
    expect(ids({ types: ['meeting'] })).toEqual(['a']);
    expect(ids({ statuses: ['cancelled'] })).toEqual(['b']);
    expect(ids({ showCancelled: false })).toEqual(['a', 'c']);
    expect(ids({ ownership: 'mine' })).toEqual(['a']);
    expect(ids({ ownership: 'shared' })).toEqual(['b', 'c']);
    expect(ids({ privateOnly: true })).toEqual(['b']);
    expect(ids({ recurringOnly: true })).toEqual(['c']);
    expect(ids({ participantId: 'me' })).toEqual(['a', 'c']);
    expect(ids({ color: '#30a46c' })).toEqual(['c']);
    expect(ids({ color: '#4F7DF3' })).toEqual(['a']);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, calendarIds: ['c1'], privateOnly: true })).toBe(2);
  });

  it('período: futuros, passados e próximos 7 dias', () => {
    const now = new Date('2026-11-11T00:00:00Z');
    const ids = (period: typeof DEFAULT_FILTERS.period) =>
      applyFilters(list, { ...DEFAULT_FILTERS, period }, 'me', {}, now).map((o) => o.event.id);
    expect(ids('past')).toEqual(['a']);
    expect(ids('future')).toEqual(['b', 'c']);
    expect(ids('next7')).toEqual(['b', 'c']);
  });
});

describe('busca local', () => {
  it('ignora acentos e maiúsculas, procura em vários campos e não revela eventos mascarados', () => {
    expect(searchOccurrences(list, 'reuniao').map((o) => o.event.id)).toEqual(['a']);
    expect(searchOccurrences(list, 'SALÃO').map((o) => o.event.id)).toEqual(['a']);
    expect(searchOccurrences(list, 'casa', { c1: 'Casa' }).map((o) => o.event.id)).toEqual(['a', 'c']);
    const masked = [occ({ id: 'x', title: null, is_masked: true })];
    expect(searchOccurrences(masked, 'ocupado')).toEqual([]);
    expect(searchOccurrences(list, 'a')).toEqual([]);
  });
});

describe('conflitos de horário', () => {
  it('detecta sobreposição, ignorando o próprio evento, cancelados e dia inteiro', () => {
    const slot = {
      start: new Date('2026-11-10T22:30:00Z'),
      end: new Date('2026-11-10T23:30:00Z'),
      allDay: false,
    };
    expect(findConflicts(slot, list).map((o) => o.event.id)).toEqual(['a']);
    expect(findConflicts(slot, list, 'a')).toEqual([]);
    expect(findConflicts({ ...slot, allDay: true }, list)).toEqual([]);
    const cancelled = {
      start: new Date('2026-11-12T12:30:00Z'),
      end: new Date('2026-11-12T13:30:00Z'),
      allDay: false,
    };
    expect(findConflicts(cancelled, list)).toEqual([]);
  });

  it('marca pares conflitantes na mesma agenda', () => {
    const a = occ({
      id: 'p',
      calendar_id: 'c1',
      starts_at: '2026-11-20T10:00:00Z',
      ends_at: '2026-11-20T11:00:00Z',
    });
    const b = occ({
      id: 'q',
      calendar_id: 'c1',
      starts_at: '2026-11-20T10:30:00Z',
      ends_at: '2026-11-20T11:30:00Z',
    });
    const c = occ({
      id: 'r',
      calendar_id: 'c2',
      starts_at: '2026-11-20T10:30:00Z',
      ends_at: '2026-11-20T11:30:00Z',
    });
    expect([...conflictingKeys([a, b, c])].sort()).toEqual([a.key, b.key].sort());
  });
});
