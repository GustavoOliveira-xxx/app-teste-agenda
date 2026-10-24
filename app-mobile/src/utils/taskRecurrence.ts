// Recorrência de tarefas e lembretes.
//
// Diferente dos eventos, uma tarefa recorrente guarda só a PRÓXIMA data
// (due_date). Ao concluir, o servidor registra a ocorrência e avança o prazo.
// Estas funções repetem o cálculo do servidor (private.rrule_next e
// private.rrule_add) para a tela mostrar o resultado na hora, mesmo offline.
// Os dois lados são testados com os mesmos casos
// (supabase/tests/fixtures/proxima-data.json).
import type { DateKey, RecurrenceMode, Task } from '@/models/types';

import { addDaysToKey, addMonthsToKey, compareKeys } from './dates';
import { parseRule, seriesDates } from './recurrence';

const MAX_ITERATIONS = 20000;

/** Próxima data da série estritamente depois de `after` (null se a série acabou). */
export function nextSeriesDate(ruleText: string | null, start: DateKey, after: DateKey): DateKey | null {
  const rule = parseRule(ruleText);
  if (!rule) return null;
  let n = 0;
  for (const date of seriesDates(rule, start, rule.count ? undefined : after)) {
    n += 1;
    if (n > MAX_ITERATIONS) return null;
    if (rule.until && compareKeys(date, rule.until) > 0) return null;
    if (rule.count && n > rule.count) return null;
    if (compareKeys(date, after) > 0) return date;
  }
  return null;
}

/** "N dias/semanas/meses/anos depois" (repetição após a conclusão). */
export function addRuleInterval(ruleText: string | null, day: DateKey): DateKey | null {
  const rule = parseRule(ruleText);
  if (!rule) return null;
  switch (rule.freq) {
    case 'DAILY':
      return addDaysToKey(day, rule.interval);
    case 'WEEKLY':
      return addDaysToKey(day, 7 * rule.interval);
    case 'MONTHLY':
      return addMonthsToKey(day, rule.interval);
    default:
      return addMonthsToKey(day, 12 * rule.interval);
  }
}

/**
 * Prazo depois de concluir a ocorrência `occurrence` de uma tarefa
 * recorrente. null quando a série terminou (a tarefa fica concluída).
 */
export function nextDueAfterCompletion(
  task: Pick<Task, 'recurrence_rule' | 'recurrence_mode' | 'recurrence_start' | 'due_date'>,
  occurrence: DateKey,
  today: DateKey,
): DateKey | null {
  if (!task.recurrence_rule || !task.due_date) return null;
  if (task.recurrence_mode === 'completion') return addRuleInterval(task.recurrence_rule, today);
  return nextSeriesDate(task.recurrence_rule, task.recurrence_start ?? task.due_date, occurrence);
}

/** Regras aceitas quando a repetição conta a partir da conclusão. */
export function isValidForMode(ruleText: string | null, mode: RecurrenceMode): boolean {
  if (!ruleText) return true;
  const rule = parseRule(ruleText);
  if (!rule) return false;
  if (mode === 'calendar') return true;
  return rule.byDay.length === 0 && !rule.byMonthDay && !rule.until && !rule.count;
}
