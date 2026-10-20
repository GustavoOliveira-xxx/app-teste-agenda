// Fila de operações locais ("outbox").
//
// Toda alteração de evento entra aqui primeiro (mesmo com internet) e o
// motor de sincronização envia na ordem. Cada operação tem um id único:
// se for reenviada (ex.: app fechou no meio), o servidor reconhece e não
// duplica nada. Este arquivo só tem funções puras (fáceis de testar).
import type { CalendarEvent, EventFields } from '@/models/types';

export type OpKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'split_series'
  | 'exception_upsert'
  | 'exception_delete'
  | 'reminders_set'
  | 'attendees_set';

export type OpStatus = 'pending' | 'syncing' | 'failed' | 'conflict';

export interface OpConflict {
  reason: 'version' | 'deleted';
  server: Partial<CalendarEvent>;
  fields: string[];
}

export interface OutboxOp {
  /** Identificador da operação (UUID). Também é a chave anti-duplicação no servidor. */
  id: string;
  createdAt: string;
  kind: OpKind;
  entity: 'event';
  entityId: string;
  calendarId: string;
  payload: Record<string, unknown>;
  /** Versão do evento em que a alteração se baseou (controle de concorrência). */
  baseVersion: number | null;
  /** Valores originais dos campos alterados (para mesclagem automática). */
  baseSnapshot: Partial<EventFields> | null;
  status: OpStatus;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  conflict: OpConflict | null;
}

export const MAX_AUTO_ATTEMPTS = 8;

export function makeOp(
  input: Pick<OutboxOp, 'id' | 'kind' | 'entityId' | 'calendarId' | 'payload'> &
    Partial<Pick<OutboxOp, 'baseVersion' | 'baseSnapshot'>>,
  now: Date = new Date(),
): OutboxOp {
  return {
    entity: 'event',
    baseVersion: null,
    baseSnapshot: null,
    ...input,
    createdAt: now.toISOString(),
    status: 'pending',
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
    nextAttemptAt: null,
    conflict: null,
  };
}

const isMutable = (op: OutboxOp) => op.status === 'pending' || op.status === 'failed';

/**
 * Adiciona uma operação, juntando com operações ainda não enviadas do mesmo
 * evento quando isso é seguro:
 *  - alterar um evento que ainda nem foi criado no servidor: junta na criação;
 *  - duas alterações seguidas: viram uma só (mantém a versão base da primeira);
 *  - excluir um evento que nunca foi enviado: as duas operações se anulam.
 */
export function enqueue(queue: OutboxOp[], op: OutboxOp): OutboxOp[] {
  const sameEntity = queue.filter((q) => q.entityId === op.entityId && isMutable(q));
  const pendingCreate = sameEntity.find((q) => q.kind === 'create');
  const pendingUpdate = sameEntity.find((q) => q.kind === 'update');

  if (op.kind === 'update' && pendingCreate) {
    return queue.map((q) => (q === pendingCreate ? { ...q, payload: { ...q.payload, ...op.payload } } : q));
  }
  if (op.kind === 'update' && pendingUpdate) {
    return queue.map((q) =>
      q === pendingUpdate
        ? {
            ...q,
            payload: { ...q.payload, ...op.payload },
            baseSnapshot: { ...(op.baseSnapshot ?? {}), ...(q.baseSnapshot ?? {}) },
          }
        : q,
    );
  }
  if (op.kind === 'delete' && pendingCreate) {
    // Nunca chegou ao servidor: basta esquecer tudo o que é deste evento.
    return queue.filter((q) => q.entityId !== op.entityId || !isMutable(q));
  }
  if (op.kind === 'delete' && pendingUpdate) {
    const withoutUpdate = queue.filter((q) => q !== pendingUpdate);
    return [...withoutUpdate, { ...op, baseVersion: pendingUpdate.baseVersion ?? op.baseVersion }];
  }
  if (op.kind === 'reminders_set' || op.kind === 'attendees_set') {
    // Só a lista mais recente importa.
    const rest = queue.filter((q) => !(q.entityId === op.entityId && q.kind === op.kind && isMutable(q)));
    return [...rest, op];
  }
  return [...queue, op];
}

/**
 * Operações prontas para envio, na ordem. No máximo uma por evento: a
 * seguinte só sai depois que a anterior der certo. Uma operação travada
 * (conflito ou falha aguardando) segura as próximas do mesmo evento.
 */
export function readyOps(queue: OutboxOp[], now: Date = new Date()): OutboxOp[] {
  const seen = new Set<string>();
  const ready: OutboxOp[] = [];
  for (const op of queue) {
    if (seen.has(op.entityId)) continue;
    seen.add(op.entityId);
    const due =
      op.status === 'pending' ||
      (op.status === 'failed' && !!op.nextAttemptAt && new Date(op.nextAttemptAt) <= now);
    if (due) ready.push(op);
  }
  return ready;
}

export function updateOp(queue: OutboxOp[], id: string, changes: Partial<OutboxOp>): OutboxOp[] {
  return queue.map((op) => (op.id === id ? { ...op, ...changes } : op));
}

export function removeOp(queue: OutboxOp[], id: string): OutboxOp[] {
  return queue.filter((op) => op.id !== id);
}

/** Espera crescente entre tentativas: 5s, 10s, 20s ... até 15 minutos. */
export function backoffMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000);
}

export function markFailed(
  queue: OutboxOp[],
  id: string,
  error: string,
  retryable: boolean,
  now: Date = new Date(),
): OutboxOp[] {
  return queue.map((op) => {
    if (op.id !== id) return op;
    const attempts = op.attempts + 1;
    const auto = retryable && attempts < MAX_AUTO_ATTEMPTS;
    return {
      ...op,
      status: 'failed',
      attempts,
      lastError: error,
      lastAttemptAt: now.toISOString(),
      nextAttemptAt: auto ? new Date(now.getTime() + backoffMs(attempts)).toISOString() : null,
    };
  });
}

export function markConflict(
  queue: OutboxOp[],
  id: string,
  conflict: OpConflict,
  now: Date = new Date(),
): OutboxOp[] {
  return updateOp(queue, id, { status: 'conflict', conflict, lastAttemptAt: now.toISOString() });
}

/** Nova tentativa manual (botão "Tentar de novo"). */
export function retryOp(queue: OutboxOp[], id: string): OutboxOp[] {
  return updateOp(queue, id, { status: 'pending', nextAttemptAt: null, lastError: null });
}

/** Ao abrir o app: operações que estavam "enviando" quando o app fechou voltam para a fila. */
export function recoverInterrupted(queue: OutboxOp[]): OutboxOp[] {
  return queue.map((op) => (op.status === 'syncing' ? { ...op, status: 'pending' as const } : op));
}

export function summarize(queue: OutboxOp[]): {
  pending: number;
  failed: number;
  conflicts: number;
  total: number;
} {
  return {
    pending: queue.filter((op) => op.status === 'pending' || op.status === 'syncing').length,
    failed: queue.filter((op) => op.status === 'failed').length,
    conflicts: queue.filter((op) => op.status === 'conflict').length,
    total: queue.length,
  };
}

/**
 * Aplica as operações ainda não enviadas sobre os eventos do servidor, para
 * a tela mostrar o estado mais recente (atualização "otimista").
 */
export function overlayPending(
  events: Record<string, CalendarEvent>,
  queue: OutboxOp[],
  userId: string | null,
): Record<string, CalendarEvent> {
  const result: Record<string, CalendarEvent> = { ...events };
  for (const op of queue) {
    const current = result[op.entityId];
    switch (op.kind) {
      case 'create': {
        const now = op.createdAt;
        result[op.entityId] = {
          version: 0,
          created_at: now,
          updated_at: now,
          completed_at: null,
          is_masked: false,
          exceptions: [],
          attendee_ids: [],
          my_reminders: [],
          ...(op.payload as unknown as EventFields),
          id: op.entityId,
          calendar_id: op.calendarId,
          created_by: userId,
          updated_by: userId,
          pending: true,
        } as CalendarEvent;
        break;
      }
      case 'update':
        if (current)
          result[op.entityId] = { ...current, ...(op.payload as Partial<CalendarEvent>), pending: true };
        break;
      case 'delete':
        delete result[op.entityId];
        break;
      case 'split_series':
        if (current) {
          result[op.entityId] = {
            ...current,
            recurrence_rule: op.payload.original_rule as string,
            pending: true,
          };
          const n = op.payload.new_event as Partial<CalendarEvent> & { id: string };
          result[n.id] = {
            ...current,
            ...n,
            exceptions: [],
            version: 0,
            created_by: userId,
            pending: true,
          } as CalendarEvent;
        }
        break;
      case 'exception_upsert':
      case 'exception_delete':
        if (current) {
          const date = op.payload.original_date as string;
          const others = current.exceptions.filter((x) => x.original_date !== date);
          result[op.entityId] = {
            ...current,
            exceptions:
              op.kind === 'exception_delete'
                ? others
                : [
                    ...others,
                    {
                      original_date: date,
                      is_cancelled: Boolean(op.payload.is_cancelled),
                      title: (op.payload.title as string) ?? null,
                      description: (op.payload.description as string) ?? null,
                      location: (op.payload.location as string) ?? null,
                      starts_at: (op.payload.starts_at as string) ?? null,
                      ends_at: (op.payload.ends_at as string) ?? null,
                    },
                  ],
            pending: true,
          };
        }
        break;
      case 'reminders_set':
        if (current) result[op.entityId] = { ...current, my_reminders: op.payload.minutes as number[] };
        break;
      case 'attendees_set':
        if (current) result[op.entityId] = { ...current, attendee_ids: op.payload.user_ids as string[] };
        break;
      default:
        break;
    }
  }
  return result;
}
