import { useMemo } from 'react';

import type { DateFormat, TimeFormat } from '@/models/types';
import { useAuthStore } from '@/stores/authStore';

import { getDeviceTimezone } from './useDeviceTimezone';

export interface DisplaySettings {
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  weekStartsOn: 0 | 1;
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
    }),
    [prefs],
  );
}
