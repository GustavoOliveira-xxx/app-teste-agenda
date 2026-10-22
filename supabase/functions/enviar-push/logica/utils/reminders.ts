// Cópia gerada de app-mobile/src/utils/reminders.ts por scripts/copiar-logica-push.mjs. Não edite aqui.
import { t } from '../i18n/index.ts';

/** Opções de antecedência dos lembretes (minutos antes do evento). */
export const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440];

export function reminderLabel(minutes: number): string {
  if (minutes === 0) return t('reminders.atTime');
  if (minutes % 1440 === 0)
    return minutes === 1440 ? t('reminders.dayBefore') : t('reminders.daysBefore', { n: minutes / 1440 });
  if (minutes % 60 === 0)
    return minutes === 60 ? t('reminders.hourBefore') : t('reminders.hoursBefore', { n: minutes / 60 });
  return t('reminders.minutesBefore', { n: minutes });
}

/** "Em 30 min: Revisão de Cálculo", "Em 1 h: ...", "Agora: ...": o que importa primeiro. */
export function reminderTitle(title: string, minutes: number): string {
  if (minutes <= 0) return t('reminders.titleNow', { title });
  if (minutes < 60) return t('reminders.titleIn', { when: `${minutes} min`, title });
  if (minutes < 1440 && minutes % 60 === 0) return t('reminders.titleIn', { when: `${minutes / 60} h`, title });
  if (minutes < 1440) {
    return t('reminders.titleIn', { when: `${Math.floor(minutes / 60)} h ${minutes % 60} min`, title });
  }
  if (minutes === 1440) return t('reminders.titleTomorrow', { title });
  return t('reminders.titleIn', { when: `${Math.round(minutes / 1440)} dias`, title });
}
