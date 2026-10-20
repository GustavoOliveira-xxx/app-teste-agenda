import { useEffect } from 'react';

import type { Member } from '@/models/types';
import * as api from '@/services/api';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';

const EMPTY: Member[] = [];

/** Membros de uma agenda: usa o que está no aparelho e atualiza se houver internet. */
export function useCalendarMembers(calendarId: string | undefined): Member[] {
  const cached = useDataStore((s) => (calendarId ? s.members[calendarId] : undefined));
  const online = useSyncStore((s) => s.online);
  useEffect(() => {
    if (!calendarId || !online) return;
    let alive = true;
    api
      .listMembers(calendarId)
      .then((list) => {
        if (alive)
          useDataStore
            .getState()
            .set({ members: { ...useDataStore.getState().members, [calendarId]: list } });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [calendarId, online]);
  return cached ?? EMPTY;
}
