import {
  addDaysToKey,
  allDayInstants,
  diffDays,
  formatClock,
  formatDateKey,
  formatLongDate,
  formatOccurrenceTime,
  formatTime,
  isValidDateKey,
  isValidTimezone,
  isWithinQuietHours,
  localToInstant,
  monthMatrix,
  spannedDayKeys,
  startOfWeekKey,
  toDateKey,
  weekdayOfKey,
} from '../dates';

describe('datas e fusos', () => {
  it('converte hora local do Brasil para UTC (UTC-3)', () => {
    expect(localToInstant('2026-10-20', '14:30', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-20T17:30:00.000Z',
    );
  });

  it('o mesmo instante cai em dias diferentes em fusos diferentes', () => {
    const instant = new Date('2026-10-21T01:00:00Z');
    expect(toDateKey(instant, 'America/Sao_Paulo')).toBe('2026-10-20');
    expect(toDateKey(instant, 'Europe/Lisbon')).toBe('2026-10-21');
    expect(toDateKey(instant, 'Asia/Tokyo')).toBe('2026-10-21');
  });

  it('evento criado num fuso e visto em outro mantém o instante (São Paulo -> Lisboa)', () => {
    const start = localToInstant('2026-11-10', '19:00', 'America/Sao_Paulo');
    expect(formatTime(start, 'Europe/Lisbon')).toBe('22:00');
    expect(formatTime(start, 'America/Sao_Paulo')).toBe('19:00');
    expect(
      formatOccurrenceTime(
        { start, end: new Date(start.getTime() + 3600e3), allDay: false, startDate: null, endDate: null },
        'Europe/Lisbon',
      ),
    ).toBe('22:00 às 23:00');
  });

  it('dia inteiro: instantes calculados no fuso do evento e dias não "pulam" em outro fuso', () => {
    const { startsAt, endsAt } = allDayInstants('2026-12-25', '2026-12-25', 'America/Sao_Paulo');
    expect(startsAt).toBe('2026-12-25T03:00:00.000Z');
    expect(endsAt).toBe('2026-12-26T03:00:00.000Z');
    const occ = {
      start: new Date(startsAt),
      end: new Date(endsAt),
      allDay: true,
      startDate: '2026-12-25',
      endDate: '2026-12-25',
    };
    // Visto do Japão (UTC+9) continua sendo só no dia 25.
    expect(spannedDayKeys(occ, 'Asia/Tokyo')).toEqual(['2026-12-25']);
    expect(spannedDayKeys(occ, 'America/Los_Angeles')).toEqual(['2026-12-25']);
  });

  it('evento que termina à meia-noite não ocupa o dia seguinte', () => {
    const start = localToInstant('2026-10-20', '22:00', 'America/Sao_Paulo');
    const end = localToInstant('2026-10-21', '00:00', 'America/Sao_Paulo');
    expect(
      spannedDayKeys({ start, end, allDay: false, startDate: null, endDate: null }, 'America/Sao_Paulo'),
    ).toEqual(['2026-10-20']);
  });

  it('horário de verão (Nova York): 9h continua 9h antes e depois da mudança', () => {
    expect(localToInstant('2026-03-07', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-03-07T14:00:00.000Z',
    );
    expect(localToInstant('2026-03-09', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-03-09T13:00:00.000Z',
    );
  });

  it('horário de verão histórico do Brasil (2018)', () => {
    // Em 04/11/2018 o Brasil adiantou o relógio: meia-noite não existiu.
    expect(localToInstant('2018-11-03', '10:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2018-11-03T13:00:00.000Z',
    );
    expect(localToInstant('2018-11-05', '10:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2018-11-05T12:00:00.000Z',
    );
  });

  it('aritmética de datas locais', () => {
    expect(addDaysToKey('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-12-31', '2026-01-01')).toBe(364);
    expect(weekdayOfKey('2026-10-20')).toBe(2); // terça
    expect(startOfWeekKey('2026-10-20', 0)).toBe('2026-10-18');
    expect(startOfWeekKey('2026-10-20', 1)).toBe('2026-10-19');
  });

  it('grade do mês tem 6 semanas e começa no dia configurado', () => {
    const grid = monthMatrix(2026, 10, 0);
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toBe('2026-09-27');
    expect(grid.flat()).toContain('2026-10-31');
    expect(monthMatrix(2026, 10, 1)[0][0]).toBe('2026-09-28');
  });

  it('formatação em português e formatos configuráveis', () => {
    expect(formatDateKey('2026-12-25')).toBe('25/12/2026');
    expect(formatDateKey('2026-12-25', 'yyyy-MM-dd')).toBe('2026-12-25');
    expect(formatDateKey('2026-12-25', 'MM/dd/yyyy')).toBe('12/25/2026');
    expect(formatLongDate('2026-12-25')).toBe('sexta-feira, 25 de dezembro');
    expect(formatClock(14, 5)).toBe('14:05');
    expect(formatClock(14, 5, '12h')).toBe('2:05 PM');
    expect(formatClock(0, 0, '12h')).toBe('12:00 AM');
  });

  it('validações de fuso e de data', () => {
    expect(isValidTimezone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimezone('Lua/Crater')).toBe(false);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-02-28')).toBe(true);
  });

  it('horário de silêncio, inclusive atravessando a meia-noite', () => {
    const tz = 'America/Sao_Paulo';
    expect(isWithinQuietHours(localToInstant('2026-10-20', '23:30', tz), tz, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(localToInstant('2026-10-20', '06:59', tz), tz, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(localToInstant('2026-10-20', '07:00', tz), tz, '22:00', '07:00')).toBe(false);
    expect(isWithinQuietHours(localToInstant('2026-10-20', '13:00', tz), tz, '12:00', '14:00')).toBe(true);
    expect(isWithinQuietHours(localToInstant('2026-10-20', '13:00', tz), tz, null, null)).toBe(false);
  });
});
