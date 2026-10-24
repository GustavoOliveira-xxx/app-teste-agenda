import { useMemo } from 'react';

import type { Habit, Note, Task, TaskList } from '@/models/types';
import { overlayItems, type ItemsState } from '@/offline/itemOverlay';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { todayKey } from '@/utils/dates';

import { useDisplaySettings } from './useDisplaySettings';
import { useCalendarsMap } from './useEventsView';

/**
 * Tarefas, listas, anotações e hábitos como a pessoa deve ver: servidor +
 * alterações locais ainda não enviadas. Itens de agendas na lixeira somem.
 */
export function useItems(): ItemsState {
  const tasks = useDataStore((s) => s.tasks);
  const lists = useDataStore((s) => s.lists);
  const notes = useDataStore((s) => s.notes);
  const habits = useDataStore((s) => s.habits);
  const checkins = useDataStore((s) => s.checkins);
  const outbox = useSyncStore((s) => s.outbox);
  const calendars = useCalendarsMap();
  const userId = useUserId();
  const { timezone } = useDisplaySettings();
  const today = todayKey(timezone);
  return useMemo(() => {
    const merged = overlayItems({ tasks, lists, notes, habits, checkins }, outbox, userId, today);
    const alive = <T extends { calendar_id: string | null }>(map: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(map).filter(
          ([, x]) => !x.calendar_id || (calendars[x.calendar_id] && !calendars[x.calendar_id].deleted_at),
        ),
      );
    return {
      tasks: alive(merged.tasks),
      lists: alive(merged.lists),
      notes: alive(merged.notes),
      habits: alive(merged.habits),
      checkins: merged.checkins,
    };
  }, [tasks, lists, notes, habits, checkins, outbox, userId, today, calendars]);
}

export function useTasks(): Task[] {
  const { tasks } = useItems();
  return useMemo(() => Object.values(tasks), [tasks]);
}

export function useTask(id: string | undefined): Task | undefined {
  const { tasks } = useItems();
  return id ? tasks[id] : undefined;
}

export function useLists(): TaskList[] {
  const { lists } = useItems();
  return useMemo(
    () => Object.values(lists).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [lists],
  );
}

export function useNotes(): Note[] {
  const { notes } = useItems();
  return useMemo(
    () =>
      Object.values(notes).sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
      ),
    [notes],
  );
}

export function useHabits(): Habit[] {
  const { habits } = useItems();
  return useMemo(() => Object.values(habits).sort((a, b) => a.title.localeCompare(b.title)), [habits]);
}
