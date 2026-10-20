import { useDataStore } from '@/stores/dataStore';

export function useCalendar(id: string | undefined) {
  return useDataStore((s) => s.calendars.find((c) => c.id === id));
}
