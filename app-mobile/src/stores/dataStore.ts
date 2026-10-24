// Dados sincronizados com o servidor (agendas, eventos, membros, avisos,
// tarefas, lembretes, listas, anotações, hábitos e dias já planejados).
// Os eventos aqui são a versão do SERVIDOR; as alterações locais ainda não
// enviadas ficam na fila (syncStore.outbox) e são aplicadas por cima na tela.
import { create } from 'zustand';

import type {
  AppNotification,
  Calendar,
  CalendarEvent,
  DateKey,
  Habit,
  Member,
  Note,
  Task,
  TaskList,
} from '@/models/types';

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
  tasks: Record<string, Task>;
  lists: Record<string, TaskList>;
  notes: Record<string, Note>;
  habits: Record<string, Habit>;
  /** Dias em que a pessoa já respondeu "O que você pretende fazer hoje?". */
  checkins: DateKey[];
  loading: boolean;
  error: string | null;
  set: (
    changes: Partial<Omit<DataState, 'set' | 'upsertEvents' | 'upsertItems' | 'removeCalendar' | 'reset'>>,
  ) => void;
  upsertEvents: (events: CalendarEvent[]) => void;
  /** Grava (ou remove, se veio com deleted_at) itens devolvidos pelo servidor. */
  upsertItems: (
    kind: 'tasks' | 'lists' | 'notes' | 'habits',
    items: { id: string; deleted_at?: string | null }[],
  ) => void;
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
  tasks: {} as Record<string, Task>,
  lists: {} as Record<string, TaskList>,
  notes: {} as Record<string, Note>,
  habits: {} as Record<string, Habit>,
  checkins: [] as DateKey[],
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
  upsertItems: (kind, items) =>
    set((s) => {
      const next = { ...(s[kind] as Record<string, { id: string }>) };
      for (const item of items) {
        if (item.deleted_at) delete next[item.id];
        else next[item.id] = { ...next[item.id], ...item, pending: false } as { id: string };
      }
      return { [kind]: next } as Partial<DataState>;
    }),
  removeCalendar: (calendarId) =>
    set((s) => {
      const events = Object.fromEntries(
        Object.entries(s.events).filter(([, e]) => e.calendar_id !== calendarId),
      );
      const members = { ...s.members };
      delete members[calendarId];
      const keep = <T extends { calendar_id: string | null }>(map: Record<string, T>) =>
        Object.fromEntries(Object.entries(map).filter(([, x]) => x.calendar_id !== calendarId));
      return {
        calendars: s.calendars.filter((c) => c.id !== calendarId),
        events,
        members,
        tasks: keep(s.tasks),
        lists: keep(s.lists),
        notes: keep(s.notes),
        habits: keep(s.habits),
      };
    }),
  reset: () => set(initial),
}));
