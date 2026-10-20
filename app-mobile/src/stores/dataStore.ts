// Dados sincronizados com o servidor (agendas, eventos, membros, avisos).
// Os eventos aqui são a versão do SERVIDOR; as alterações locais ainda não
// enviadas ficam na fila (syncStore.outbox) e são aplicadas por cima na tela.
import { create } from 'zustand';

import type { AppNotification, Calendar, CalendarEvent, Member } from '@/models/types';

export interface LoadedWindow {
  from: string;
  to: string;
}

interface DataState {
  hydrated: boolean;
  calendars: Calendar[];
  events: Record<string, CalendarEvent>;
  members: Record<string, Member[]>;
  window: LoadedWindow | null;
  notifications: AppNotification[];
  loading: boolean;
  error: string | null;
  set: (changes: Partial<Omit<DataState, 'set' | 'upsertEvents' | 'removeCalendar' | 'reset'>>) => void;
  upsertEvents: (events: CalendarEvent[]) => void;
  removeCalendar: (calendarId: string) => void;
  reset: () => void;
}

const initial = {
  hydrated: false,
  calendars: [] as Calendar[],
  events: {} as Record<string, CalendarEvent>,
  members: {} as Record<string, Member[]>,
  window: null as LoadedWindow | null,
  notifications: [] as AppNotification[],
  loading: false,
  error: null as string | null,
};

export const useDataStore = create<DataState>((set) => ({
  ...initial,
  set: (changes) => set(changes),
  upsertEvents: (events) =>
    set((s) => {
      const next = { ...s.events };
      for (const e of events) next[e.id] = { ...next[e.id], ...e, pending: false };
      return { events: next };
    }),
  removeCalendar: (calendarId) =>
    set((s) => {
      const events = Object.fromEntries(
        Object.entries(s.events).filter(([, e]) => e.calendar_id !== calendarId),
      );
      const members = { ...s.members };
      delete members[calendarId];
      return { calendars: s.calendars.filter((c) => c.id !== calendarId), events, members };
    }),
  reset: () => set(initial),
}));
