// Aplica as operações ainda não enviadas de tarefas, listas, anotações,
// hábitos e do plano do dia sobre os dados do servidor, para a tela mostrar
// o estado mais recente na hora (inclusive sem internet). Funções puras.
import type { ChecklistItem, DateKey, Habit, Note, Task, TaskFields, TaskList } from '@/models/types';
import { nextDueAfterCompletion } from '@/utils/taskRecurrence';
import { addDaysToKey, compareKeys, diffDays } from '@/utils/dates';

import type { OutboxOp } from './outbox';

export interface ItemsState {
  tasks: Record<string, Task>;
  lists: Record<string, TaskList>;
  notes: Record<string, Note>;
  habits: Record<string, Habit>;
  checkins: DateKey[];
}

export const TASK_DEFAULTS: Omit<Task, 'id' | 'title' | 'created_at' | 'updated_at'> = {
  item_type: 'task',
  calendar_id: null,
  list_id: null,
  description: null,
  links: [],
  tags: [],
  start_date: null,
  due_date: null,
  due_time: null,
  timezone: 'America/Sao_Paulo',
  estimated_minutes: null,
  priority: 0,
  status: 'pending',
  recurrence_rule: null,
  recurrence_mode: 'calendar',
  recurrence_start: null,
  assignee_id: null,
  privacy: 'members',
  position: 0,
  created_by: null,
  updated_by: null,
  completed_at: null,
  completed_by: null,
  version: 0,
  checklist: [],
  participant_ids: [],
  my_alerts: [],
  plan_day: null,
  last_completed_at: null,
  comment_count: 0,
};

function checklistFrom(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const x = item as Partial<ChecklistItem> & { id: string; title: string };
    return {
      id: x.id,
      title: x.title,
      done: !!x.done,
      done_at: null,
      done_by: null,
      position: x.position ?? i,
    };
  });
}

function sortChecklist(list: ChecklistItem[]): ChecklistItem[] {
  return [...list].sort((a, b) => a.position - b.position);
}

/** Resultado local de concluir uma tarefa (o servidor faz o mesmo cálculo). */
export function completeLocally(task: Task, occurrence: DateKey | null, today: DateKey, now: string): Task {
  if (!task.recurrence_rule || task.status === 'done' || task.status === 'cancelled' || !task.due_date) {
    return { ...task, status: 'done', completed_at: now, last_completed_at: now };
  }
  const date = occurrence ?? task.due_date;
  if (compareKeys(date, task.due_date) < 0) return { ...task, last_completed_at: now };
  const next = nextDueAfterCompletion(task, date, today);
  if (!next) return { ...task, status: 'done', completed_at: now, last_completed_at: now };
  const shift = diffDays(next, task.due_date);
  return {
    ...task,
    due_date: next,
    start_date: task.start_date ? minKey(addDaysToKey(task.start_date, shift), next) : null,
    status: 'pending',
    last_completed_at: now,
    checklist: task.checklist.map((c) => ({ ...c, done: false, done_at: null, done_by: null })),
  };
}

function minKey(a: DateKey, b: DateKey): DateKey {
  return compareKeys(a, b) <= 0 ? a : b;
}

function applyTaskOp(tasks: Record<string, Task>, op: OutboxOp, userId: string | null, today: DateKey) {
  const current = tasks[op.entityId];
  const p = op.payload;
  switch (op.kind) {
    case 'create': {
      const { checklist, alerts, participant_ids, plan_day, ...fields } = p as Partial<TaskFields> & {
        checklist?: unknown;
        alerts?: number[];
        participant_ids?: string[];
        plan_day?: DateKey | null;
      };
      tasks[op.entityId] = {
        ...TASK_DEFAULTS,
        ...(fields as Partial<Task>),
        id: op.entityId,
        title: (fields.title as string) ?? '',
        calendar_id: (fields.calendar_id as string | null | undefined) ?? null,
        recurrence_start: fields.recurrence_rule ? (fields.due_date ?? null) : null,
        created_by: userId,
        updated_by: userId,
        created_at: op.createdAt,
        updated_at: op.createdAt,
        checklist: sortChecklist(checklistFrom(checklist)),
        my_alerts: alerts ?? [],
        participant_ids: participant_ids ?? [],
        plan_day: plan_day ?? null,
        completed_at: fields.status === 'done' ? op.createdAt : null,
        pending: true,
      };
      break;
    }
    case 'update':
      if (current) {
        const next = { ...current, ...(p as Partial<Task>), pending: true };
        if (p.status === 'done' && current.status !== 'done') next.completed_at = op.createdAt;
        if (p.status && p.status !== 'done') next.completed_at = null;
        if ('recurrence_rule' in p && p.recurrence_rule !== current.recurrence_rule) {
          next.recurrence_start = (next.recurrence_rule && next.due_date) || null;
        }
        tasks[op.entityId] = next;
      }
      break;
    case 'delete':
      delete tasks[op.entityId];
      break;
    case 'complete':
      if (current) {
        tasks[op.entityId] = {
          ...completeLocally(
            current,
            (p.occurrence_date as DateKey | undefined) ?? null,
            today,
            op.createdAt,
          ),
          pending: true,
        };
      }
      break;
    case 'reopen':
      if (current) {
        const date = (p.occurrence_date as DateKey | undefined) ?? null;
        if (current.recurrence_rule && date) {
          const back =
            current.status === 'done' || !current.due_date || compareKeys(date, current.due_date) < 0;
          tasks[op.entityId] = {
            ...current,
            due_date: back ? date : current.due_date,
            status: 'pending',
            completed_at: null,
            pending: true,
          };
        } else {
          tasks[op.entityId] = { ...current, status: 'pending', completed_at: null, pending: true };
        }
      }
      break;
    case 'checklist_upsert':
      if (current) {
        const id = p.id as string;
        const exists = current.checklist.some((c) => c.id === id);
        const list = exists
          ? current.checklist.map((c) =>
              c.id === id
                ? {
                    ...c,
                    ...(p as Partial<ChecklistItem>),
                    done_at: p.done === true && !c.done ? op.createdAt : p.done === false ? null : c.done_at,
                    done_by: p.done === true && !c.done ? userId : p.done === false ? null : c.done_by,
                  }
                : c,
            )
          : [
              ...current.checklist,
              {
                id,
                title: (p.title as string) ?? '',
                done: !!p.done,
                done_at: p.done ? op.createdAt : null,
                done_by: p.done ? userId : null,
                position:
                  (p.position as number | undefined) ??
                  Math.max(0, ...current.checklist.map((c) => c.position)) + 1,
              },
            ];
        tasks[op.entityId] = { ...current, checklist: sortChecklist(list), pending: true };
      }
      break;
    case 'checklist_delete':
      if (current) {
        tasks[op.entityId] = {
          ...current,
          checklist: current.checklist.filter((c) => c.id !== p.id),
          pending: true,
        };
      }
      break;
    case 'participants_set':
      if (current) tasks[op.entityId] = { ...current, participant_ids: (p.user_ids as string[]) ?? [] };
      break;
    case 'alerts_set':
      if (current) tasks[op.entityId] = { ...current, my_alerts: (p.minutes as number[]) ?? [] };
      break;
    case 'plan_set':
      if (current) tasks[op.entityId] = { ...current, plan_day: (p.day as DateKey | null) ?? null };
      break;
    default:
      break;
  }
}

function applySimple<T extends { id: string; created_at: string; updated_at: string }>(
  map: Record<string, T>,
  op: OutboxOp,
  defaults: Omit<T, 'id' | 'created_at' | 'updated_at'>,
  userId: string | null,
) {
  const current = map[op.entityId];
  if (op.kind === 'create') {
    map[op.entityId] = {
      ...defaults,
      ...(op.payload as Partial<T>),
      id: op.entityId,
      created_by: userId,
      created_at: op.createdAt,
      updated_at: op.createdAt,
      pending: true,
    } as unknown as T;
  } else if (op.kind === 'update' && current) {
    map[op.entityId] = { ...current, ...(op.payload as Partial<T>), pending: true };
  } else if (op.kind === 'delete') {
    delete map[op.entityId];
  }
}

const LIST_DEFAULTS: Omit<TaskList, 'id' | 'created_at' | 'updated_at'> = {
  calendar_id: null,
  name: '',
  color: null,
  icon: null,
  position: 0,
  created_by: null,
  version: 0,
};

const NOTE_DEFAULTS: Omit<Note, 'id' | 'created_at' | 'updated_at'> = {
  calendar_id: null,
  title: null,
  body: '',
  pinned: false,
  event_id: null,
  task_id: null,
  created_by: null,
  updated_by: null,
  version: 0,
};

const HABIT_DEFAULTS: Omit<Habit, 'id' | 'created_at' | 'updated_at'> = {
  calendar_id: null,
  title: '',
  description: null,
  color: null,
  recurrence_rule: 'FREQ=DAILY',
  start_date: '2026-01-01',
  status: 'active',
  show_streak: false,
  created_by: null,
  version: 0,
  logs: [],
};

export function overlayItems(
  state: ItemsState,
  queue: OutboxOp[],
  userId: string | null,
  today: DateKey,
): ItemsState {
  const tasks = { ...state.tasks };
  const lists = { ...state.lists };
  const notes = { ...state.notes };
  const habits = { ...state.habits };
  let checkins = state.checkins;
  for (const op of queue) {
    switch (op.entity) {
      case 'task':
        applyTaskOp(tasks, op, userId, today);
        break;
      case 'list':
        applySimple(lists, op, LIST_DEFAULTS, userId);
        // Tarefas de uma lista excluída voltam para a caixa de entrada.
        if (op.kind === 'delete') {
          for (const t of Object.values(tasks)) {
            if (t.list_id === op.entityId) tasks[t.id] = { ...t, list_id: null };
          }
        }
        break;
      case 'note':
        applySimple(notes, op, NOTE_DEFAULTS, userId);
        break;
      case 'habit':
        if (op.kind === 'log_set') {
          const h = habits[op.entityId];
          if (h && userId) {
            const day = op.payload.day as DateKey;
            const others = h.logs.filter((l) => !(l.user_id === userId && l.day === day));
            habits[op.entityId] = {
              ...h,
              logs: op.payload.done === false ? others : [{ user_id: userId, day }, ...others],
            };
          }
        } else {
          applySimple(habits, op, HABIT_DEFAULTS, userId);
        }
        break;
      case 'checkin': {
        const day = op.payload.day as DateKey;
        if (day && !checkins.includes(day)) checkins = [day, ...checkins];
        break;
      }
      default:
        break;
    }
  }
  return { tasks, lists, notes, habits, checkins };
}
