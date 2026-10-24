// Adição rápida: entende frases em português e separa tipo, título, data,
// horário, repetição, prioridade e etiquetas. Regras fixas (sem IA), para
// funcionar offline e sempre do mesmo jeito.
//
// Exemplos:
//   "Comprar pão amanhã"                     tarefa, amanhã
//   "Estudar física sexta às 19h"            tarefa, sexta, 19:00
//   "Reunião com Paulo terça das 14h às 15h" evento, terça, 14:00 a 15:00
//   "Lembrar do aniversário dia 12"          lembrete, próximo dia 12
//   "Revisar orçamento todo dia 5"           tarefa mensal, dia 5
//   "Limpar o filtro a cada 30 dias após a última limpeza"
//                                            tarefa que repete 30 dias após concluir
//
// Quando algo pode ser lido de mais de um jeito, o resultado traz
// `ambiguities` e o app mostra a prévia para a pessoa conferir antes de salvar.
import type { DateKey, RecurrenceMode, TaskPriority } from '@/models/types';

import { addDaysToKey, addMonthsToKey, dateKeyParts, makeDateKey, weekdayOfKey } from './dates';
import { WEEKDAY_CODES, type WeekdayCode } from './recurrence';

export type QuickKind = 'task' | 'reminder' | 'event';

export interface QuickParse {
  kind: QuickKind;
  title: string;
  date: DateKey | null;
  time: string | null;
  endTime: string | null;
  recurrence: { rule: string; mode: RecurrenceMode } | null;
  priority: TaskPriority | null;
  tags: string[];
  /** Pontos que a pessoa precisa conferir (texto pronto para mostrar). */
  ambiguities: string[];
}

const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  trinta: 30,
};
const EVENT_WORDS =
  /\b(reuniao|consulta|aula|jantar|almoco|encontro|entrevista|festa|show|voo|dentista|medico|cafe com|call|culto|missa|treino|partida|jogo)\b/;

const WD = '(segunda|terca|quarta|quinta|sexta|sabado|domingo)';
const MONTH = `(${MONTHS.join('|')})`;
const NUM = '(\\d{1,3}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|quinze|trinta)';

/** Minúsculas e sem acentos, mantendo o mesmo tamanho (para recortar o título). */
function normalize(text: string): string {
  return Array.from(text)
    .map((c) => {
      const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return (base.length === 1 ? base : c).toLowerCase();
    })
    .join('');
}

function toNumber(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : (NUMBER_WORDS[word] ?? NaN);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Próxima data (a partir de hoje, inclusive) com o dia da semana pedido. */
function nextWeekday(today: DateKey, weekday: number, includeToday: boolean): DateKey {
  const diff = (weekday - weekdayOfKey(today) + 7) % 7;
  return addDaysToKey(today, diff === 0 && !includeToday ? 7 : diff);
}

/** Próximo "dia N" (este mês, se ainda não passou). */
function nextMonthDay(today: DateKey, day: number): { date: DateKey; skipped: boolean } {
  const { year, month, day: d } = dateKeyParts(today);
  let y = year;
  let m = month;
  if (day < d) m += 1;
  let skipped = false;
  for (let i = 0; i < 13; i++) {
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (day <= daysInMonth(y, m)) return { date: makeDateKey(y, m, day), skipped };
    skipped = true;
    m += 1;
  }
  return { date: today, skipped: true };
}

interface Span {
  start: number;
  end: number;
}

export function parseQuickAdd(text: string, today: DateKey): QuickParse {
  const original = text.replace(/\s+/g, ' ');
  const n = normalize(original);
  const used: Span[] = [];
  const result: QuickParse = {
    kind: 'task',
    title: '',
    date: null,
    time: null,
    endTime: null,
    recurrence: null,
    priority: null,
    tags: [],
    ambiguities: [],
  };

  const free = (s: number, e: number) => !used.some((u) => s < u.end && e > u.start);
  /** Aplica a expressão; cada trecho aceito pelo `handle` sai do título. */
  const take = (re: RegExp, handle: (m: RegExpExecArray) => boolean | void, once = true) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = g.exec(n))) {
      const start = m.index + (m[0].length - m[0].trimStart().length);
      const end = m.index + m[0].trimEnd().length;
      if (end <= start || !free(start, end)) continue;
      if (handle(m) === false) continue;
      used.push({ start, end });
      found = true;
      if (once) break;
    }
    return found;
  };

  // Etiquetas (#casa) e prioridade (!, !!, !!!, "urgente").
  take(
    /(?:^|\s)#([a-z0-9_-]{1,30})/,
    (m) => {
      result.tags.push(m[1]);
    },
    false,
  );
  take(/(?:^|\s)(!{1,3})(?=\s|$)/, (m) => {
    result.priority = (m[1].length + 1) as TaskPriority;
  });
  take(/\b(urgente)\b/, () => {
    result.priority = 4;
  });

  // Tipo: "lembrar de", "lembre-me de", "me lembre de", "lembrete:".
  if (
    take(/^\s*(?:lembrete\s*:|lembre-me\s+(?:de|do|da)|me\s+lembre\s+(?:de|do|da)|lembrar\s+(?:de|do|da|dos|das)|lembrar)\s*/, () => {
      result.kind = 'reminder';
    })
  ) {
    // tipo definido
  }

  // Repetição (antes das datas, para "toda segunda" não virar "segunda").
  const rule = (r: string, mode: RecurrenceMode = 'calendar') => {
    result.recurrence = { rule: r, mode };
  };
  take(new RegExp(`\\btodo(?:s os)? dias? (\\d{1,2})(?: de cada mes)?\\b`), (m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return false;
    rule(`FREQ=MONTHLY;BYMONTHDAY=${day}`);
    const next = nextMonthDay(today, day);
    result.date ??= next.date;
    if (day > 28) result.ambiguities.push(`Meses sem o dia ${day} serão pulados.`);
  });
  take(/\btodo mes no dia (\d{1,2})\b/, (m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return false;
    rule(`FREQ=MONTHLY;BYMONTHDAY=${day}`);
    result.date ??= nextMonthDay(today, day).date;
  });
  take(/\b(?:dias uteis|de segunda a sexta(?:[- ]feira)?)\b/, () => {
    rule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  });
  take(
    new RegExp(
      `\\btod[oa]s? (?:as |os )?((?:${WD.slice(1, -1)})s?(?:[- ]feiras?)?(?:\\s*(?:,|e)\\s*(?:as |os )?${WD}s?(?:[- ]feiras?)?)*)\\b`,
    ),
    (m) => {
      const codes = [...m[1].matchAll(new RegExp(WD, 'g'))].map(
        (x) => WEEKDAY_CODES[WEEKDAYS.indexOf(x[1])] as WeekdayCode,
      );
      if (!codes.length) return false;
      rule(`FREQ=WEEKLY;BYDAY=${[...new Set(codes)].join(',')}`);
    },
  );
  take(/\b(?:todos os dias|todo dia|diariamente)\b/, () => rule('FREQ=DAILY'));
  take(/\b(?:quinzenalmente|quinzenal|a cada (?:2|duas) semanas)\b/, () => rule('FREQ=WEEKLY;INTERVAL=2'));
  take(/\b(?:toda semana|todas as semanas|semanalmente)\b/, () => rule('FREQ=WEEKLY'));
  take(/\b(?:todo mes|todos os meses|mensalmente)\b/, () => rule('FREQ=MONTHLY'));
  take(/\b(?:todo ano|todos os anos|anualmente)\b/, () => rule('FREQ=YEARLY'));
  take(new RegExp(`\\ba cada ${NUM} (dias?|semanas?|mes|meses|anos?)\\b`), (m) => {
    const count = toNumber(m[1]);
    if (!count || count > 99) return false;
    const unit = m[2].startsWith('dia')
      ? 'DAILY'
      : m[2].startsWith('semana')
        ? 'WEEKLY'
        : m[2].startsWith('mes')
          ? 'MONTHLY'
          : 'YEARLY';
    rule(`FREQ=${unit}${count > 1 ? `;INTERVAL=${count}` : ''}`);
  });
  // "após a última limpeza", "depois de concluir": conta a partir da conclusão.
  take(/\b(?:apos|depois d[aoe]s?)\s+(?:a |o )?(?:ultim[ao]s?|conclusao|concluir|terminar|feit[oa])(?:\s+[a-z]+)?\b/, () => {
    if (!result.recurrence) return false;
    if (/BYDAY|BYMONTHDAY/.test(result.recurrence.rule)) return false;
    result.recurrence.mode = 'completion';
  });

  // Horários.
  const setTime = (h: number, min: number, period?: string, explicit = true): string | null => {
    let hour = h;
    if (period === 'da tarde' || period === 'da noite') hour = h < 12 ? h + 12 : h;
    if (period === 'da manha' || period === 'da madrugada') hour = h === 12 ? 0 : h;
    if (hour > 23 || min > 59) return null;
    if (!explicit && !period && h >= 1 && h <= 11) {
      result.ambiguities.push(`"${h}" pode ser ${pad(h)}:00 ou ${pad(h + 12)}:00. Confira o horário.`);
    }
    return `${pad(hour)}:${pad(min)}`;
  };
  const PERIOD = '(?:\\s+(da manha|da tarde|da noite|da madrugada))?';
  take(
    new RegExp(
      `\\b(?:das|de)\\s+(\\d{1,2})(?:(?::|h)(\\d{2}))?(h)?\\s*(?:as|a|ate|-)\\s*(\\d{1,2})(?:(?::|h)(\\d{2}))?(h)?${PERIOD}\\b`,
    ),
    (m) => {
      const start = setTime(Number(m[1]), Number(m[2] ?? 0), m[7], !!(m[2] || m[3]));
      const end = setTime(Number(m[4]), Number(m[5] ?? 0), m[7], !!(m[5] || m[6]));
      if (!start || !end) return false;
      result.time = start;
      result.endTime = end;
    },
  );
  take(/\b(\d{1,2})(?:(?::|h)(\d{2}))?h?\s*-\s*(\d{1,2})(?:(?::|h)(\d{2}))?h\b/, (m) => {
    const start = setTime(Number(m[1]), Number(m[2] ?? 0));
    const end = setTime(Number(m[3]), Number(m[4] ?? 0));
    if (!start || !end || result.time) return false;
    result.time = start;
    result.endTime = end;
  });
  take(/\b(?:ao |as )?meio[- ]dia\b/, () => {
    if (result.time) return false;
    result.time = '12:00';
  });
  take(/\b(?:a |as )?meia[- ]noite\b/, () => {
    if (result.time) return false;
    result.time = '00:00';
  });
  take(new RegExp(`\\b(?:as|a partir das|ate as)\\s+(\\d{1,2})(?:(?::|h)(\\d{2}))?(h)?${PERIOD}\\b`), (m) => {
    if (result.time) return false;
    const t = setTime(Number(m[1]), Number(m[2] ?? 0), m[4], !!(m[2] || m[3]));
    if (!t) return false;
    result.time = t;
  });
  take(new RegExp(`\\b(\\d{1,2})h(\\d{2})?${PERIOD}\\b`), (m) => {
    if (result.time) return false;
    const t = setTime(Number(m[1]), Number(m[2] ?? 0), m[3]);
    if (!t) return false;
    result.time = t;
  });
  take(/\b(\d{1,2}):(\d{2})\b/, (m) => {
    if (result.time) return false;
    const t = setTime(Number(m[1]), Number(m[2]));
    if (!t) return false;
    result.time = t;
  });
  take(/\b(?:de manha|pela manha)\b/, () => {
    if (result.time) return false;
    result.time = '09:00';
    result.ambiguities.push('"De manhã" virou 09:00. Ajuste se preferir.');
  });
  take(/\b(?:a tarde|de tarde|pela tarde)\b/, () => {
    if (result.time) return false;
    result.time = '15:00';
    result.ambiguities.push('"À tarde" virou 15:00. Ajuste se preferir.');
  });
  take(/\b(?:a noite|de noite|hoje a noite)\b/, (m) => {
    if (result.time) return false;
    result.time = '20:00';
    result.ambiguities.push('"À noite" virou 20:00. Ajuste se preferir.');
    if (m[0].includes('hoje')) result.date ??= today;
  });

  // Datas.
  take(/\bdepois de amanha\b/, () => {
    result.date = addDaysToKey(today, 2);
  });
  take(/\bamanha\b/, () => {
    if (result.date) return false;
    result.date = addDaysToKey(today, 1);
  });
  take(/\bhoje\b/, () => {
    if (result.date) return false;
    result.date = today;
  });
  take(
    new RegExp(
      `\\b(?:(na proxima|no proximo|proxima|proximo|nesta|neste|nessa|nesse|esta|este|essa|esse|na|no)\\s+)?${WD}(?:[- ]feira)?(?:\\s+(que vem))?\\b`,
    ),
    (m) => {
      if (result.date) return false;
      const wd = WEEKDAYS.indexOf(m[2]);
      const next = !!m[3] || (m[1] ?? '').startsWith('prox') || (m[1] ?? '').startsWith('na prox') || (m[1] ?? '').startsWith('no prox');
      result.date = nextWeekday(today, wd, !next);
      if (!next && weekdayOfKey(today) === wd) {
        result.ambiguities.push('Hoje já é esse dia da semana: usei hoje. Para a próxima semana, escreva "que vem".');
      }
    },
  );
  take(new RegExp(`\\b(\\d{1,2})\\s+de\\s+${MONTH}(?:\\s+de\\s+(\\d{4}))?\\b`), (m) => {
    if (result.date) return false;
    return setFullDate(Number(m[1]), MONTHS.indexOf(m[2]) + 1, m[3] ? Number(m[3]) : null);
  });
  take(new RegExp(`\\bdia\\s+(\\d{1,2})(?:\\s+de\\s+${MONTH})?(?:\\s+de\\s+(\\d{4}))?\\b`), (m) => {
    if (result.date) return false;
    const day = Number(m[1]);
    if (day < 1 || day > 31) return false;
    if (m[2]) return setFullDate(day, MONTHS.indexOf(m[2]) + 1, m[3] ? Number(m[3]) : null);
    const next = nextMonthDay(today, day);
    result.date = next.date;
    if (next.skipped) result.ambiguities.push(`Este mês não tem dia ${day}: usei ${formatKey(next.date)}.`);
  });
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/, (m) => {
    if (result.date) return false;
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    return setFullDate(Number(m[1]), Number(m[2]), year);
  });
  take(new RegExp(`\\b(?:em|daqui a|daqui)\\s+${NUM}\\s+(dias?|semanas?|mes|meses)\\b`), (m) => {
    if (result.date) return false;
    const count = toNumber(m[1]);
    if (!count) return false;
    result.date = m[2].startsWith('dia')
      ? addDaysToKey(today, count)
      : m[2].startsWith('semana')
        ? addDaysToKey(today, 7 * count)
        : addMonthsToKey(today, count);
  });
  take(/\b(?:semana que vem|na proxima semana|proxima semana)\b/, () => {
    if (result.date) return false;
    result.date = addDaysToKey(today, 7);
    result.ambiguities.push('"Semana que vem" virou daqui a 7 dias. Ajuste o dia se preferir.');
  });
  take(/\b(?:mes que vem|no proximo mes|proximo mes)\b/, () => {
    if (result.date) return false;
    result.date = addMonthsToKey(today, 1);
    result.ambiguities.push('"Mês que vem" virou daqui a um mês. Ajuste o dia se preferir.');
  });
  take(/\b(?:no |neste |nesse )?(?:fim|final) de semana\b/, () => {
    if (result.date) return false;
    result.date = nextWeekday(today, 6, true);
  });

  function setFullDate(day: number, month: number, year: number | null): boolean {
    if (month < 1 || month > 12 || day < 1) return false;
    const t = dateKeyParts(today);
    let y = year ?? t.year;
    if (day > daysInMonth(y, month)) {
      if (year) return false;
      result.ambiguities.push(`Data ${pad(day)}/${pad(month)} não existe neste ano.`);
      return false;
    }
    let key = makeDateKey(y, month, day);
    if (!year && key < today) {
      y += 1;
      if (day > daysInMonth(y, month)) return false;
      key = makeDateKey(y, month, day);
    }
    if (year && key < today) result.ambiguities.push(`A data ${formatKey(key)} já passou.`);
    result.date = key;
    return true;
  }

  // Data padrão da repetição.
  if (result.recurrence && !result.date) {
    const r = result.recurrence.rule;
    const byday = /BYDAY=([A-Z,]+)/.exec(r)?.[1];
    if (byday) {
      const days = byday.split(',').map((c) => WEEKDAY_CODES.indexOf(c as WeekdayCode));
      result.date = days
        .map((d) => nextWeekday(today, d, true))
        .sort()[0];
    } else {
      result.date = today;
    }
  }

  // Título: o que sobrou, sem conectores soltos no fim ou no começo.
  let title = Array.from(original)
    .map((c, i) => (used.some((u) => i >= u.start && i < u.end) ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const DANGLING = /(?:\s+|^)(?:as|às|a|à|na|no|nas|nos|em|de|do|da|para|pra|e|,|-|ate|até|dia|a partir)$/i;
  for (let i = 0; i < 4; i++) title = title.replace(DANGLING, '').trim();
  title = title.replace(/^(?:de|do|da|para|pra|que)\s+/i, '').replace(/[,;:-]+$/, '').trim();
  result.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';

  // Evento: faixa de horário, ou palavra de compromisso com horário.
  if (result.kind !== 'reminder' && (result.endTime || (result.time && EVENT_WORDS.test(n)))) {
    result.kind = 'event';
  }
  if (result.kind === 'event' && result.time && !result.endTime) {
    const [h, mi] = result.time.split(':').map(Number);
    result.endTime = `${pad(Math.min(23, h + 1))}:${pad(h + 1 > 23 ? 59 : mi)}`;
  }
  if (result.endTime && result.time && result.endTime <= result.time) {
    result.ambiguities.push('O horário de término é antes do início. Confira.');
  }
  if (result.time && !result.date) {
    result.date = today;
  }
  if (!result.title) result.ambiguities.push('Falta o título.');
  return result;
}

function formatKey(key: DateKey): string {
  const { day, month, year } = dateKeyParts(key);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** Precisa de conferência antes de salvar? */
export function needsReview(parse: QuickParse): boolean {
  return parse.ambiguities.length > 0;
}
