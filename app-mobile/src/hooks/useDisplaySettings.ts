import { useMemo } from 'react';

import type { DateFormat, TimeFormat } from '@/models/types';
import { useAuthStore } from '@/stores/authStore';

import { getDeviceTimezone } from './useDeviceTimezone';

export interface DisplaySettings {
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  weekStartsOn: 0 | 1;
  /** Janela do dia para horários livres e planejador (HH:MM). */
  dayStart: string;
  dayEnd: string;
}

/** Fuso e formatos de exibição escolhidos pela pessoa (ou os do celular). */
export function useDisplaySettings(): DisplaySettings {
  const prefs = useAuthStore((s) => s.account?.preferences);
  return useMemo(
    () => ({
      timezone: prefs && !prefs.use_device_timezone ? prefs.timezone : getDeviceTimezone(),
      dateFormat: prefs?.date_format ?? 'dd/MM/yyyy',
      timeFormat: prefs?.time_format ?? '24h',
      weekStartsOn: prefs?.week_starts_on ?? 0,
      dayStart: (prefs?.day_start ?? '08:00').slice(0, 5),
      dayEnd: (prefs?.day_end ?? '22:00').slice(0, 5),
    }),
    [prefs],
  );
}
