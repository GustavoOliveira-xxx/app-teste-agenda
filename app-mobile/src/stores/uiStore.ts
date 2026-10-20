// Preferências de tela guardadas neste aparelho (visão do calendário,
// filtros, onboarding). Não vão para o servidor.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DateKey } from '@/models/types';
import { DEFAULT_FILTERS, type EventFilters } from '@/utils/filters';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

interface UiState {
  onboardingDone: boolean;
  viewMode: CalendarViewMode;
  selectedDate: DateKey | null;
  filters: EventFilters;
  listTab: 'upcoming' | 'past';
  setOnboardingDone: () => void;
  setViewMode: (mode: CalendarViewMode) => void;
  setSelectedDate: (date: DateKey) => void;
  setFilters: (filters: EventFilters) => void;
  setListTab: (tab: 'upcoming' | 'past') => void;
  resetFilters: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      onboardingDone: false,
      viewMode: 'month',
      selectedDate: null,
      filters: DEFAULT_FILTERS,
      listTab: 'upcoming',
      setOnboardingDone: () => set({ onboardingDone: true }),
      setViewMode: (viewMode) => set({ viewMode }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      setFilters: (filters) => set({ filters }),
      setListTab: (listTab) => set({ listTab }),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    }),
    {
      name: 'ui-preferences-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ onboardingDone: s.onboardingDone, viewMode: s.viewMode, listTab: s.listTab }),
    },
  ),
);
