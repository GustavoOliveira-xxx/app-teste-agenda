// Grade de horários (visão semanal e diária): posição vertical por horário e
// colunas lado a lado para compromissos ao mesmo tempo.
import type { DateKey } from '@/models/types';

import { addDaysToKey, startOfDayInstant } from './dates';

export interface GridInput {
  key: string;
  start: Date;
  end: Date;
}

export interface GridBox {
  key: string;
  /** Minutos desde a meia-noite do dia (0 a 1440). */
  top: number;
  height: number;
  /** Coluna dentro do grupo de sobreposição e total de colunas do grupo. */
  lane: number;
  lanes: number;
  /** Começou no dia anterior ou continua no seguinte. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Menor altura de um bloco (em minutos), para caber o título. */
export const MIN_BOX_MINUTES = 20;

/** Recorta cada item no dia e calcula colunas para os que se sobrepõem. */
export function layoutDay(items: GridInput[], day: DateKey, timezone: string): GridBox[] {
  const dayStart = startOfDayInstant(day, timezone).getTime();
  const dayEnd = startOfDayInstant(addDaysToKey(day, 1), timezone).getTime();
  const span = (dayEnd - dayStart) / 60_000;
  const pieces = items
    .filter((i) => i.start.getTime() < dayEnd && i.end.getTime() > dayStart)
    .map((i) => {
      const s = Math.max(i.start.getTime(), dayStart);
      const e = Math.min(i.end.getTime(), dayEnd);
      const top = ((s - dayStart) / 60_000 / span) * 1440;
      const bottom = ((e - dayStart) / 60_000 / span) * 1440;
      return {
        key: i.key,
        top,
        bottom: Math.max(bottom, top + MIN_BOX_MINUTES),
        continuesBefore: i.start.getTime() < dayStart,
        continuesAfter: i.end.getTime() > dayEnd,
      };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const out: GridBox[] = [];
  let cluster: (typeof pieces[number] & { lane: number })[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) {
      out.push({
        key: c.key,
        top: c.top,
        height: c.bottom - c.top,
        lane: c.lane,
        lanes,
        continuesBefore: c.continuesBefore,
        continuesAfter: c.continuesAfter,
      });
    }
    cluster = [];
  };
  for (const p of pieces) {
    if (cluster.length && p.top >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    // Primeira coluna livre neste grupo.
    const used = new Set(cluster.filter((c) => c.bottom > p.top).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    cluster.push({ ...p, lane });
    clusterEnd = Math.max(clusterEnd, p.bottom);
  }
  if (cluster.length) flush();
  return out;
}

/** Minutos desde a meia-noite (no fuso) para a linha do "agora". */
export function minutesIntoDay(now: Date, day: DateKey, timezone: string): number | null {
  const s = startOfDayInstant(day, timezone).getTime();
  const e = startOfDayInstant(addDaysToKey(day, 1), timezone).getTime();
  const t = now.getTime();
  if (t < s || t >= e) return null;
  return ((t - s) / (e - s)) * 1440;
}

/** Arredonda para o passo (ex.: 15 minutos) ao arrastar um evento. */
export function snapMinutes(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}
