// Atualização em tempo real: quando alguém altera uma agenda em que estou,
// o servidor avisa e o app sincroniza. O Supabase Realtime respeita o RLS.
import type { RealtimeChannel } from '@supabase/supabase-js';

import { requestSync } from '@/offline/syncEngine';
import { useDataStore } from '@/stores/dataStore';
import type { AppNotification } from '@/models/types';

import { supabase } from './supabase';

let channel: RealtimeChannel | null = null;

export function startRealtime(userId: string): void {
  stopRealtime();
  channel = supabase
    .channel(`agenda-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
      requestSync({ pull: true });
    })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const note = payload.new as AppNotification;
        const current = useDataStore.getState().notifications;
        if (!current.some((n) => n.id === note.id)) {
          useDataStore.getState().set({ notifications: [note, ...current].slice(0, 100) });
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'calendar_members', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { calendar_id: string; status: string };
        // Perdeu o acesso: apaga do aparelho imediatamente.
        if (row.status !== 'active') useDataStore.getState().removeCalendar(row.calendar_id);
        requestSync({ pull: true });
      },
    )
    .subscribe();
}

export function stopRealtime(): void {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}
