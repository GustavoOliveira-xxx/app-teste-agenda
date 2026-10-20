import {
  countOccurrencesBefore,
  describeRule,
  expandEvent,
  isFirstOccurrence,
  parseRule,
  presetToRule,
  ruleEndingBefore,
  ruleForFollowing,
  ruleToPreset,
  serializeRule,
} from '../recurrence';
import { localToInstant, toDateKey } from '../dates';

import { makeEvent } from './fixtures';

const range = (from: string, to: string) => [new Date(from), new Date(to)] as const;

describe('regra de recorrência (RRULE)', () => {
  it('lê e escreve o formato padrão', () => {
    const rule = parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,MO;UNTIL=20261231');
    expect(rule).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['WE', 'MO'],
      byMonthDay: null,
      until: '2026-12-31',
      count: null,
    });
    expect(serializeRule(rule!)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231');
  });

  it('recusa regras inválidas ou fora do suportado', () => {
    expect(parseRule('FREQ=HOURLY')).toBeNull();
    expect(parseRule('FREQ=DAILY;COUNT=3;UNTIL=20261231')).toBeNull();
    expect(parseRule('FREQ=DAILY;INTERVAL=0')).toBeNull();
    expect(parseRule('FREQ=WEEKLY;BYDAY=XX')).toBeNull();
    expect(parseRule('INTERVAL=2')).toBeNull();
    expect(parseRule('')).toBeNull();
  });

  it('atalhos (presets) e descrição em português', () => {
    const weekly = presetToRule('weekly', '2026-10-19')!;
    expect(serializeRule(weekly)).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(ruleToPreset(weekly, '2026-10-19')).toBe('weekly');
    expect(ruleToPreset(parseRule('FREQ=WEEKLY;INTERVAL=2'), '2026-10-19')).toBe('biweekly');
    expect(ruleToPreset(parseRule('FREQ=DAILY;COUNT=5'), '2026-10-19')).toBe('custom');
    expect(describeRule(parseRule('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231')!, '2026-10-19')).toBe(
      'Toda semana às segundas, quartas e sextas, até 31/12/2026',
    );
    expect(describeRule(parseRule('FREQ=MONTHLY;COUNT=10')!, '2026-01-31')).toBe(
      'Todo mês no dia 31, 10 vezes',
    );
    expect(describeRule(parseRule('FREQ=YEARLY')!, '2026-12-25')).toBe('Todo ano em 25 de dezembro');
    expect(describeRule(parseRule('FREQ=DAILY;INTERVAL=3')!, '2026-12-25')).toBe('A cada 3 dias');
  });
});

describe('expansão de ocorrências', () => {
  it('evento mensal no dia 31 só ocorre em meses com 31 dias (RFC 5545)', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-01-31', '10:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-01-31', '11:00', 'America/Sao_Paulo').toISOString(),
      recurrence_rule: 'FREQ=MONTHLY',
    });
    const occ = expandEvent(ev, ...range('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'));
    expect(occ.map((o) => o.originalDate)).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
      '2026-07-31',
      '2026-08-31',
      '2026-10-31',
      '2026-12-31',
    ]);
  });

  it('semanal em vários dias (segunda, quarta e sexta)', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-10-19', '07:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-10-19', '08:00', 'America/Sao_Paulo').toISOString(),
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    });
    const occ = expandEvent(ev, ...range('2026-10-19T00:00:00Z', '2026-11-01T00:00:00Z'));
    expect(occ.map((o) => o.originalDate)).toEqual([
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ]);
    expect(occ.every((o) => toDateKey(o.start, 'America/Sao_Paulo') === o.originalDate)).toBe(true);
  });

  it('quinzenal respeita o intervalo', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-10-20', '19:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-10-20', '20:00', 'America/Sao_Paulo').toISOString(),
      recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
    });
    const occ = expandEvent(ev, ...range('2026-10-01T00:00:00Z', '2026-12-01T00:00:00Z'));
    expect(occ.map((o) => o.originalDate)).toEqual(['2026-10-20', '2026-11-03', '2026-11-17']);
  });

  it('mudança de horário de verão: a hora local se mantém (Nova York, 9h)', () => {
    const tz = 'America/New_York';
    const ev = makeEvent({
      timezone: tz,
      starts_at: localToInstant('2026-03-05', '09:00', tz).toISOString(),
      ends_at: localToInstant('2026-03-05', '10:00', tz).toISOString(),
      recurrence_rule: 'FREQ=DAILY',
    });
    const occ = expandEvent(ev, ...range('2026-03-05T00:00:00Z', '2026-03-12T00:00:00Z'));
    expect(occ.map((o) => o.start.toISOString().slice(11, 16))).toEqual([
      '14:00',
      '14:00',
      '14:00',
      '13:00',
      '13:00',
      '13:00',
      '13:00',
    ]);
  });

  it('evento recorrente em outro fuso aparece na hora certa para quem está no Brasil', () => {
    const ev = makeEvent({
      timezone: 'Europe/Lisbon',
      starts_at: localToInstant('2026-11-02', '09:00', 'Europe/Lisbon').toISOString(),
      ends_at: localToInstant('2026-11-02', '10:00', 'Europe/Lisbon').toISOString(),
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    const [first] = expandEvent(ev, ...range('2026-11-01T00:00:00Z', '2026-11-08T00:00:00Z'));
    expect(first.start.toISOString()).toBe('2026-11-02T09:00:00.000Z');
    expect(toDateKey(first.start, 'America/Sao_Paulo')).toBe('2026-11-02');
  });

  it('alterar uma ocorrência no meio da série e excluir outra', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-11-02', '20:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-11-02', '21:00', 'America/Sao_Paulo').toISOString(),
      title: 'Aula',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
      exceptions: [
        {
          original_date: '2026-11-09',
          is_cancelled: true,
          title: null,
          description: null,
          location: null,
          starts_at: null,
          ends_at: null,
        },
        {
          original_date: '2026-11-16',
          is_cancelled: false,
          title: 'Aula (sala nova)',
          description: null,
          location: 'Sala 2',
          starts_at: localToInstant('2026-11-17', '20:00', 'America/Sao_Paulo').toISOString(),
          ends_at: localToInstant('2026-11-17', '21:00', 'America/Sao_Paulo').toISOString(),
        },
      ],
    });
    const occ = expandEvent(ev, ...range('2026-11-01T00:00:00Z', '2026-11-30T00:00:00Z'));
    expect(occ.map((o) => o.originalDate)).toEqual(['2026-11-02', '2026-11-16', '2026-11-23']);
    const moved = occ.find((o) => o.originalDate === '2026-11-16')!;
    expect(moved.title).toBe('Aula (sala nova)');
    expect(moved.location).toBe('Sala 2');
    expect(toDateKey(moved.start, 'America/Sao_Paulo')).toBe('2026-11-17');
    expect(moved.isException).toBe(true);
    expect(occ[0].title).toBe('Aula');
  });

  it('série sem data final: calcula só a janela pedida, mesmo anos depois', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2020-01-01', '08:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2020-01-01', '08:30', 'America/Sao_Paulo').toISOString(),
      recurrence_rule: 'FREQ=DAILY',
    });
    const started = Date.now();
    const occ = expandEvent(ev, ...range('2035-06-01T03:00:00Z', '2035-06-08T03:00:00Z'));
    expect(occ).toHaveLength(7);
    expect(occ[0].originalDate).toBe('2035-06-01');
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('série com centenas de ocorrências (COUNT=500) termina no lugar certo', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-01-01', '08:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-01-01', '09:00', 'America/Sao_Paulo').toISOString(),
      recurrence_rule: 'FREQ=DAILY;COUNT=500',
    });
    const all = expandEvent(ev, ...range('2025-01-01T00:00:00Z', '2030-01-01T00:00:00Z'));
    expect(all).toHaveLength(500);
    expect(all[499].originalDate).toBe('2027-05-15');
    // Ocorrência canceladas continuam contando no COUNT (RFC 5545).
    const withCancel = makeEvent({
      ...ev,
      exceptions: [
        {
          original_date: '2026-01-02',
          is_cancelled: true,
          title: null,
          description: null,
          location: null,
          starts_at: null,
          ends_at: null,
        },
      ],
    });
    expect(expandEvent(withCancel, ...range('2025-01-01T00:00:00Z', '2030-01-01T00:00:00Z'))).toHaveLength(
      499,
    );
  });

  it('data final (UNTIL) é inclusiva', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-10-20', '08:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-10-20', '09:00', 'America/Sao_Paulo').toISOString(),
      recurrence_rule: 'FREQ=DAILY;UNTIL=20261022',
    });
    expect(
      expandEvent(ev, ...range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')).map((o) => o.originalDate),
    ).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  it('aniversário em 29/02 só aparece em anos bissextos', () => {
    const ev = makeEvent({
      all_day: true,
      start_date: '2028-02-29',
      end_date: '2028-02-29',
      starts_at: '2028-02-29T03:00:00.000Z',
      ends_at: '2028-03-01T03:00:00.000Z',
      recurrence_rule: 'FREQ=YEARLY',
    });
    const occ = expandEvent(ev, ...range('2028-01-01T00:00:00Z', '2037-01-01T00:00:00Z'));
    expect(occ.map((o) => o.originalDate)).toEqual(['2028-02-29', '2032-02-29', '2036-02-29']);
  });

  it('dia inteiro recorrente de vários dias mantém a duração', () => {
    const ev = makeEvent({
      all_day: true,
      start_date: '2026-12-24',
      end_date: '2026-12-26',
      starts_at: '2026-12-24T03:00:00.000Z',
      ends_at: '2026-12-27T03:00:00.000Z',
      recurrence_rule: 'FREQ=YEARLY;COUNT=2',
    });
    const occ = expandEvent(ev, ...range('2026-01-01T00:00:00Z', '2030-01-01T00:00:00Z'));
    expect(occ.map((o) => [o.startDate, o.endDate])).toEqual([
      ['2026-12-24', '2026-12-26'],
      ['2027-12-24', '2027-12-26'],
    ]);
  });

  it('evento único fora do período não aparece', () => {
    expect(expandEvent(makeEvent(), ...range('2026-12-01T00:00:00Z', '2026-12-31T00:00:00Z'))).toHaveLength(
      0,
    );
    expect(expandEvent(makeEvent(), ...range('2026-11-10T00:00:00Z', '2026-11-11T00:00:00Z'))).toHaveLength(
      1,
    );
  });
});

describe('edição de séries', () => {
  const rule = parseRule('FREQ=WEEKLY;BYDAY=MO;COUNT=10')!;

  it('"esta e as próximas": a série original termina no dia anterior', () => {
    expect(serializeRule(ruleEndingBefore(rule, '2026-11-16'))).toBe('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261115');
  });

  it('com COUNT, a nova série recebe apenas as ocorrências restantes', () => {
    expect(countOccurrencesBefore(rule, '2026-11-02', '2026-11-16')).toBe(2);
    expect(ruleForFollowing(rule, '2026-11-02', '2026-11-16').count).toBe(8);
  });

  it('identifica a primeira ocorrência (aí "esta e as próximas" vira "todas")', () => {
    expect(isFirstOccurrence(rule, '2026-11-02', '2026-11-02')).toBe(true);
    expect(isFirstOccurrence(rule, '2026-11-02', '2026-11-09')).toBe(false);
    // Início numa terça com regra de segunda: a primeira é a segunda seguinte.
    expect(isFirstOccurrence(rule, '2026-11-03', '2026-11-09')).toBe(true);
  });
});
