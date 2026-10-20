import { getCalendars } from 'expo-localization';

import { DEFAULT_TIMEZONE, isValidTimezone } from '@/utils/dates';

/** Fuso horário configurado no celular (ex.: America/Sao_Paulo). */
export function getDeviceTimezone(): string {
  try {
    const tz = getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
