import { t } from '@/i18n';

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
