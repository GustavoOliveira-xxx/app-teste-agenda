import fixtureFile from '../../../../supabase/tests/fixtures/proxima-data.json';
import { addRuleInterval, isValidForMode, nextDueAfterCompletion, nextSeriesDate } from '../taskRecurrence';

// Mesmos casos usados no teste do banco (private.rrule_next).
const fixture = fixtureFile as { casos: { regra: string; inicio: string; depois: string; esperado: string | null }[] };

describe('próxima data de tarefa recorrente', () => {
  it.each(fixture.casos)('$regra desde $inicio depois de $depois', (c) => {
    expect(nextSeriesDate(c.regra, c.inicio, c.depois)).toBe(c.esperado);
  });

  it('depois da conclusão: soma o intervalo ao dia em que foi feita', () => {
    expect(addRuleInterval('FREQ=DAILY;INTERVAL=30', '2026-10-23')).toBe('2026-11-22');
    expect(addRuleInterval('FREQ=WEEKLY;INTERVAL=2', '2026-10-23')).toBe('2026-11-06');
    expect(addRuleInterval('FREQ=MONTHLY', '2026-01-31')).toBe('2026-02-28');
    const task = {
      recurrence_rule: 'FREQ=DAILY;INTERVAL=30',
      recurrence_mode: 'completion' as const,
      recurrence_start: '2026-01-01',
      due_date: '2026-01-01',
    };
    expect(nextDueAfterCompletion(task, '2026-01-01', '2026-10-23')).toBe('2026-11-22');
  });

  it('pelas datas: concluir com atraso não pula ocorrências futuras', () => {
    const task = {
      recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=5',
      recurrence_mode: 'calendar' as const,
      recurrence_start: '2026-09-05',
      due_date: '2026-10-05',
    };
    expect(nextDueAfterCompletion(task, '2026-10-05', '2026-10-23')).toBe('2026-11-05');
  });

  it('regras aceitas em cada modo', () => {
    expect(isValidForMode('FREQ=WEEKLY;BYDAY=MO', 'calendar')).toBe(true);
    expect(isValidForMode('FREQ=WEEKLY;BYDAY=MO', 'completion')).toBe(false);
    expect(isValidForMode('FREQ=DAILY;INTERVAL=30', 'completion')).toBe(true);
    expect(isValidForMode(null, 'completion')).toBe(true);
  });
});
