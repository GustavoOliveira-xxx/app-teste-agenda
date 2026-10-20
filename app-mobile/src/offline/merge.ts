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
  return x === y;
}

export interface MergeResult {
  /** Campos que ainda precisam ser enviados (as alterações locais que sobreviveram). */
  payload: Partial<EventFields>;
  /** Campos alterados pelos dois lados com valores diferentes. */
  conflicts: string[];
}

export function threeWayMerge(
  base: Partial<EventFields>,
  local: Partial<EventFields>,
  server: Partial<CalendarEvent>,
): MergeResult {
  const payload: Partial<EventFields> = {};
  const conflicts: string[] = [];
  const localKeys = Object.keys(local) as (keyof EventFields)[];

  const touchesTime = localKeys.some((k) => TIME_GROUP.includes(k));
  const serverChangedTime = TIME_GROUP.some((k) => k in base && !same(k, base[k], server[k]));

  for (const key of localKeys) {
    const localValue = local[key];
    const serverValue = server[key as keyof CalendarEvent];
    if (same(key, localValue, serverValue)) continue; // os dois chegaram ao mesmo valor
    const isTime = TIME_GROUP.includes(key);
    const serverChanged = isTime ? serverChangedTime : !same(key, base[key], serverValue);
    if (serverChanged) {
      if (!conflicts.includes(isTime ? 'time' : key)) conflicts.push(isTime ? 'time' : key);
    } else {
      (payload as Record<string, unknown>)[key] = localValue;
    }
  }

  // Se mexi no horário e o servidor não, envio o bloco de horário completo
  // para não misturar início de um lado com fim do outro.
  if (touchesTime && !serverChangedTime) {
    for (const key of TIME_GROUP) {
      if (key in local) (payload as Record<string, unknown>)[key] = local[key];
    }
  }
  return { payload, conflicts };
}
