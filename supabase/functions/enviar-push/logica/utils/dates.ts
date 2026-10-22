// Cópia gerada de app-mobile/src/utils/dates.ts por scripts/copiar-logica-push.mjs. Não edite aqui.
// Funções de data e fuso horário.
//
// Regras (veja DECISOES.md, D06):
//  * Instantes (Date) representam um momento absoluto (UTC).
//  * DateKey (AAAA-MM-DD) representa um dia do calendário, sem fuso.
//  * Toda conversão entre os dois exige dizer o fuso (IANA, ex.: America/Sao_Paulo).
// A biblioteca Luxon faz as contas de fuso e horário de verão.
import { DateTime } from 'npm:luxon@3.7.2';

import { strings } from '../i18n/index.ts';
import type { DateFormat, DateKey, TimeFormat } from '../models/types.ts';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  return DateTime.now().setZone(tz).isValid;
}

export function safeTimezone(tz: string | null | undefined): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Interpreta uma DateKey como data de calendário (sem fuso). */
function keyToUtcDate(key: DateKey): DateTime {
  return DateTime.fromISO(key, { zone: 'utc' });
}

export function isValidDateKey(key: string | null | undefined): key is DateKey {
  return !!key && /^\d{4}-\d{2}-\d{2}$/.test(key) && keyToUtcDate(key).isValid;
}

export function toDateKey(date: Date, tz: string): DateKey {
  return DateTime.fromJSDate(date).setZone(safeTimezone(tz)).toISODate() as DateKey;
}

export function todayKey(tz: string, now: Date = new Date()): DateKey {
  return toDateKey(now, tz);
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  return keyToUtcDate(key).plus({ days }).toISODate() as DateKey;
}

export function addMonthsToKey(key: DateKey, months: number): DateKey {
  return keyToUtcDate(key).plus({ months }).toISODate() as DateKey;
}

/** Quantos dias de b até a (a - b). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round(keyToUtcDate(a).diff(keyToUtcDate(b), 'days').days);
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Dia da semana: 0 = domingo ... 6 = sábado. */
export function weekdayOfKey(key: DateKey): number {
  return keyToUtcDate(key).weekday % 7;
}

export function dateKeyParts(key: DateKey): { year: number; month: number; day: number } {
  const d = keyToUtcDate(key);
  return { year: d.year, month: d.month, day: d.day };
}

export function makeDateKey(year: number, month: number, day: number): DateKey {
  return DateTime.utc(year, month, day).toISODate() as DateKey;
}

export function startOfWeekKey(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const offset = (weekdayOfKey(key) - weekStartsOn + 7) % 7;
  return addDaysToKey(key, -offset);
}

export function weekKeys(key: DateKey, weekStartsOn: 0 | 1): DateKey[] {
  const start = startOfWeekKey(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

/** Grade do mês: 6 semanas x 7 dias, incluindo dias dos meses vizinhos. */
export function monthMatrix(year: number, month: number, weekStartsOn: 0 | 1): DateKey[][] {
  const first = makeDateKey(year, month, 1);
  const start = startOfWeekKey(first, weekStartsOn);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDaysToKey(start, week * 7 + day)),
  );
}

/** Converte data local + hora local (HH:mm) num fuso para o instante absoluto. */
export function localToInstant(key: DateKey, time: string, tz: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const { year, month, day } = dateKeyParts(key);
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: safeTimezone(tz) }).toJSDate();
}

export function instantToLocal(date: Date, tz: string): { dateKey: DateKey; time: string } {
  const d = DateTime.fromJSDate(date).setZone(safeTimezone(tz));
  return { dateKey: d.toISODate() as DateKey, time: d.toFormat('HH:mm') };
}

/** Início do dia (00:00) de uma data local, como instante. */
export function startOfDayInstant(key: DateKey, tz: string): Date {
  return localToInstant(key, '00:00', tz);
}

/**
 * Instantes de um evento de dia inteiro, igual ao cálculo do servidor:
 * início = 00:00 do primeiro dia; fim = 00:00 do dia seguinte ao último.
 */
export function allDayInstants(
  startDate: DateKey,
  endDate: DateKey,
  tz: string,
): { startsAt: string; endsAt: string } {
  return {
    startsAt: startOfDayInstant(startDate, tz).toISOString(),
    endsAt: startOfDayInstant(addDaysToKey(endDate, 1), tz).toISOString(),
  };
}

/** Dias (no fuso de exibição) em que uma ocorrência aparece. */
export function spannedDayKeys(
  occ: { start: Date; end: Date; allDay: boolean; startDate: DateKey | null; endDate: DateKey | null },
  displayTz: string,
): DateKey[] {
  let first: DateKey;
  let last: DateKey;
  if (occ.allDay && occ.startDate && occ.endDate) {
    // Dia inteiro: as datas locais valem em qualquer fuso (não "pula" de dia).
    first = occ.startDate;
    last = occ.endDate;
  } else {
    first = toDateKey(occ.start, displayTz);
    // Um evento que termina exatamente à meia-noite não ocupa o dia seguinte.
    last = toDateKey(new Date(Math.max(occ.start.getTime(), occ.end.getTime() - 1)), displayTz);
  }
  const days: DateKey[] = [];
  for (let k = first; compareKeys(k, last) <= 0 && days.length < 400; k = addDaysToKey(k, 1)) {
    days.push(k);
  }
  return days;
}

// ---------------------------------------------------------------------
// Formatação (sem depender do suporte de idiomas do aparelho)
// ---------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateKey(key: DateKey, format: DateFormat = 'dd/MM/yyyy'): string {
  const { year, month, day } = dateKeyParts(key);
  if (format === 'yyyy-MM-dd') return `${year}-${pad(month)}-${pad(day)}`;
  if (format === 'MM/dd/yyyy') return `${pad(month)}/${pad(day)}/${year}`;
  return `${pad(day)}/${pad(month)}/${year}`;
}

export function formatClock(hour: number, minute: number, timeFormat: TimeFormat = '24h'): string {
  if (timeFormat === '24h') return `${pad(hour)}:${pad(minute)}`;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${pad(minute)} ${suffix}`;
}

export function formatTime(date: Date, tz: string, timeFormat: TimeFormat = '24h'): string {
  const d = DateTime.fromJSDate(date).setZone(safeTimezone(tz));
  return formatClock(d.hour, d.minute, timeFormat);
}

export function formatDateTime(
  date: Date,
  tz: string,
  dateFormat: DateFormat = 'dd/MM/yyyy',
  timeFormat: TimeFormat = '24h',
): string {
  return `${formatDateKey(toDateKey(date, tz), dateFormat)} ${formatTime(date, tz, timeFormat)}`;
}

/** Ex.: "sexta-feira, 25 de dezembro" (com ano se pedido). */
export function formatLongDate(key: DateKey, withYear = false): string {
  const { year, month, day } = dateKeyParts(key);
  const weekday = strings.weekdays.long[weekdayOfKey(key)];
  const base = `${weekday}, ${day} de ${strings.months.long[month - 1]}`;
  return withYear ? `${base} de ${year}` : base;
}

/** Ex.: "25 dez" */
export function formatShortDate(key: DateKey): string {
  const { month, day } = dateKeyParts(key);
  return `${day} ${strings.months.short[month - 1]}`;
}

/** Ex.: "outubro de 2026" */
export function formatMonthYear(year: number, month: number): string {
  return `${strings.months.long[month - 1]} de ${year}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Texto do horário de uma ocorrência, ex.: "14:30 às 15:30" ou "Dia inteiro". */
export function formatOccurrenceTime(
  occ: { start: Date; end: Date; allDay: boolean; startDate: DateKey | null; endDate: DateKey | null },
  tz: string,
  timeFormat: TimeFormat = '24h',
  dateFormat: DateFormat = 'dd/MM/yyyy',
): string {
  if (occ.allDay) {
    if (occ.startDate && occ.endDate && occ.startDate !== occ.endDate) {
      return `${formatDateKey(occ.startDate, dateFormat)} a ${formatDateKey(occ.endDate, dateFormat)}`;
    }
    return strings.calendarView.allDay;
  }
  const startKey = toDateKey(occ.start, tz);
  const endKey = toDateKey(new Date(occ.end.getTime() - 1), tz);
  if (startKey !== endKey) {
    return `${formatDateTime(occ.start, tz, dateFormat, timeFormat)} a ${formatDateTime(occ.end, tz, dateFormat, timeFormat)}`;
  }
  return `${formatTime(occ.start, tz, timeFormat)} às ${formatTime(occ.end, tz, timeFormat)}`;
}

/** Diferença de minutos entre dois horários HH:mm (usado no horário de silêncio). */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** O instante cai dentro do intervalo de silêncio (pode atravessar a meia-noite)? */
export function isWithinQuietHours(
  date: Date,
  tz: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end) return false;
  const local = DateTime.fromJSDate(date).setZone(safeTimezone(tz));
  const minutes = local.hour * 60 + local.minute;
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

/** Tempo desde um instante, curto: "agora", "12 min", "3 h", "ontem" ou a data. */
export function formatRelative(
  date: Date,
  now: number,
  tz: string,
  dateFormat: DateFormat = 'dd/MM/yyyy',
): string {
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60 && toDateKey(date, tz) === toDateKey(new Date(now), tz))
    return `${Math.floor(minutes / 60)} h`;
  const days = diffDays(toDateKey(new Date(now), tz), toDateKey(date, tz));
  if (days === 1) return 'ontem';
  if (days < 7) return `${days} dias`;
  return formatDateKey(toDateKey(date, tz), dateFormat);
}
