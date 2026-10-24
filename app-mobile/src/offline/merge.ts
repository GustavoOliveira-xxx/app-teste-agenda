// Mesclagem de três vias para conflitos de edição (DECISOES.md, D08).
//
// base   = como o evento estava quando a pessoa começou a editar
// local  = o que a pessoa alterou (só os campos alterados)
// server = como o evento está agora no servidor
//
// Se a outra pessoa mexeu em campos diferentes, os dois lados são mantidos
// automaticamente. Se as duas mexeram no MESMO campo, o app pergunta.
import type { CalendarEvent, EventFields } from '@/models/types';

/** Campos de horário são tratados como um bloco único. */
export const TIME_GROUP: (keyof EventFields)[] = [
  'all_day',
  'starts_at',
  'ends_at',
  'start_date',
  'end_date',
  'timezone',
];

function same(field: string, a: unknown, b: unknown): boolean {
  const x = a ?? null;
  const y = b ?? null;
  if ((field === 'starts_at' || field === 'ends_at') && typeof x === 'string' && typeof y === 'string') {
    return new Date(x).getTime() === new Date(y).getTime();
  }
  // Horário de prazo: "19:00" e "19:00:00" são o mesmo valor.
  if (field === 'due_time' && typeof x === 'string' && typeof y === 'string') {
    return x.slice(0, 5) === y.slice(0, 5);
  }
  if (Array.isArray(x) && Array.isArray(y)) {
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  return x === y;
}

export interface MergeResult<T = Partial<EventFields>> {
  /** Campos que ainda precisam ser enviados (as alterações locais que sobreviveram). */
  payload: T;
  /** Campos alterados pelos dois lados com valores diferentes. */
  conflicts: string[];
}

/** Campos de prazo de uma tarefa: tratados como um bloco, como o horário dos eventos. */
export const DUE_GROUP = ['due_date', 'due_time', 'timezone'];

/**
 * Mesclagem genérica: `group` reúne campos que só fazem sentido juntos
 * (ex.: início e fim). O conflito do grupo aparece com o nome `groupName`.
 */
export function mergeFields(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  group: string[] = [],
  groupName = 'time',
): MergeResult<Record<string, unknown>> {
  const payload: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const localKeys = Object.keys(local);

  const touchesGroup = localKeys.some((k) => group.includes(k));
  const serverChangedGroup = group.some((k) => k in base && !same(k, base[k], server[k]));

  for (const key of localKeys) {
    const localValue = local[key];
    const serverValue = server[key];
    if (same(key, localValue, serverValue)) continue; // os dois chegaram ao mesmo valor
    const inGroup = group.includes(key);
    const serverChanged = inGroup ? serverChangedGroup : !same(key, base[key], serverValue);
    if (serverChanged) {
      const name = inGroup ? groupName : key;
      if (!conflicts.includes(name)) conflicts.push(name);
    } else {
      payload[key] = localValue;
    }
  }

  // Se mexi no grupo e o servidor não, envio o grupo completo para não
  // misturar um lado com o outro.
  if (touchesGroup && !serverChangedGroup) {
    for (const key of group) {
      if (key in local) payload[key] = local[key];
    }
  }
  return { payload, conflicts };
}

export function threeWayMerge(
  base: Partial<EventFields>,
  local: Partial<EventFields>,
  server: Partial<CalendarEvent>,
): MergeResult {
  const result = mergeFields(
    base as Record<string, unknown>,
    local as Record<string, unknown>,
    server as Record<string, unknown>,
    TIME_GROUP as string[],
  );
  return { payload: result.payload as Partial<EventFields>, conflicts: result.conflicts };
}
