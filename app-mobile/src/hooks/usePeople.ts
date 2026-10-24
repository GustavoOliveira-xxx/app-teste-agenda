import { useEffect, useMemo } from 'react';

import * as api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';

export interface Person {
  name: string;
  color: string;
  isMe: boolean;
}

/** Nomes e cores de quem divide agenda com a pessoa (e dela mesma). */
export function usePeople(): Record<string, Person> {
  const members = useDataStore((s) => s.members);
  const account = useAuthStore((s) => s.account);
  return useMemo(() => {
    const map: Record<string, Person> = {};
    for (const list of Object.values(members)) {
      for (const m of list) map[m.user_id] = { name: m.display_name, color: m.avatar_color, isMe: m.is_me };
    }
    if (account) map[account.id] = { name: account.display_name, color: account.avatar_color, isMe: true };
    return map;
  }, [members, account]);
}

/** Carrega (uma vez por abertura) os membros das agendas compartilhadas. */
export function useSharedMembers(): void {
  const calendars = useDataStore((s) => s.calendars);
  const online = useSyncStore((s) => s.online);
  const ids = useMemo(
    () =>
      calendars
        .filter((c) => !c.deleted_at && c.member_count > 1)
        .map((c) => c.id)
        .join(','),
    [calendars],
  );
  useEffect(() => {
    if (!online || !ids) return;
    let alive = true;
    const missing = ids.split(',').filter((id) => !useDataStore.getState().members[id]);
    void Promise.all(
      missing.map((id) =>
        api
          .listMembers(id)
          .then((list) => [id, list] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (!alive) return;
      const next = { ...useDataStore.getState().members };
      for (const r of results) if (r) next[r[0]] = r[1];
      useDataStore.getState().set({ members: next });
    });
    return () => {
      alive = false;
    };
  }, [ids, online]);
}
