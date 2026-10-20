// Estado da sincronização: conexão, fila de operações e métricas.
import { create } from 'zustand';

import type { OutboxOp } from '@/offline/outbox';

export interface SyncMetrics {
  sent: number;
  failed: number;
  conflicts: number;
  lastDurationMs: number | null;
}

interface SyncState {
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  authRequired: boolean;
  outbox: OutboxOp[];
  metrics: SyncMetrics;
  setOnline: (online: boolean) => void;
  setOutbox: (outbox: OutboxOp[]) => void;
  patch: (changes: Partial<Omit<SyncState, 'setOnline' | 'setOutbox' | 'patch' | 'reset'>>) => void;
  reset: () => void;
}

const initial = {
  online: true,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
  authRequired: false,
  outbox: [] as OutboxOp[],
  metrics: { sent: 0, failed: 0, conflicts: 0, lastDurationMs: null } as SyncMetrics,
};

export const useSyncStore = create<SyncState>((set) => ({
  ...initial,
  setOnline: (online) => set({ online }),
  setOutbox: (outbox) => set({ outbox }),
  patch: (changes) => set(changes),
  reset: () => set((s) => ({ ...initial, online: s.online })),
}));
