import { makeTask } from '../../utils/__tests__/fixtures';
import { completeLocally, overlayItems, type ItemsState } from '../itemOverlay';
import { mergeFields, DUE_GROUP } from '../merge';
import { enqueue, makeOp, readyOps, type OutboxOp } from '../outbox';

let n = 0;
const op = (
  entity: OutboxOp['entity'],
  kind: OutboxOp['kind'],
  entityId: string,
  payload: Record<string, unknown> = {},
) => makeOp({ id: `op-${++n}`, entity, kind, entityId, calendarId: null, payload }, new Date('2026-10-23T12:00:00Z'));

const empty: ItemsState = { tasks: {}, lists: {}, notes: {}, habits: {}, checkins: [] };
const today = '2026-10-23';

describe('itens offline (tarefas, listas, anotações, hábitos)', () => {
  it('tarefa criada sem internet aparece na hora, com etapas e avisos', () => {
    const q = [
      op('task', 'create', 't1', {
        title: 'Preparar apresentação',
        due_date: '2026-10-30',
        alerts: [30],
        checklist: [{ id: 'c1', title: 'Pesquisar' }],
        plan_day: today,
      }),
    ];
    const s = overlayItems(empty, q, 'me', today);
    expect(s.tasks.t1).toMatchObject({
      title: 'Preparar apresentação',
      status: 'pending',
      my_alerts: [30],
      plan_day: today,
      pending: true,
      created_by: 'me',
    });
    expect(s.tasks.t1.checklist).toEqual([
      { id: 'c1', title: 'Pesquisar', done: false, done_at: null, done_by: null, position: 0 },
    ]);
  });

  it('concluir recorrente avança o prazo; desfazer volta', () => {
    const base = makeTask({ id: 't', recurrence_rule: 'FREQ=WEEKLY', due_date: '2026-10-23', recurrence_start: '2026-10-02' });
    const done = overlayItems({ ...empty, tasks: { t: base } }, [op('task', 'complete', 't', { occurrence_date: '2026-10-23' })], 'me', today);
    expect(done.tasks.t).toMatchObject({ due_date: '2026-10-30', status: 'pending' });
    const undone = overlayItems(done, [op('task', 'reopen', 't', { occurrence_date: '2026-10-23' })], 'me', today);
    expect(undone.tasks.t.due_date).toBe('2026-10-23');
    // Sem repetição: fica concluída.
    expect(completeLocally(makeTask(), null, today, 'agora')).toMatchObject({ status: 'done', completed_at: 'agora' });
  });

  it('etapas: marcar, criar, remover', () => {
    const base = makeTask({
      id: 't',
      checklist: [{ id: 'a', title: 'A', done: false, done_at: null, done_by: null, position: 1 }],
    });
    const s = overlayItems(
      { ...empty, tasks: { t: base } },
      [
        op('task', 'checklist_upsert', 't', { id: 'a', done: true }),
        op('task', 'checklist_upsert', 't', { id: 'b', title: 'B', position: 2 }),
        op('task', 'checklist_delete', 't', { id: 'a' }),
      ],
      'me',
      today,
    );
    expect(s.tasks.t.checklist.map((c) => c.id)).toEqual(['b']);
  });

  it('excluir lista devolve as tarefas para a caixa de entrada', () => {
    const s = overlayItems(
      {
        ...empty,
        lists: { l: { id: 'l', calendar_id: null, name: 'Compras', color: null, icon: null, position: 1, created_by: 'me', version: 1, created_at: '', updated_at: '' } },
        tasks: { t: makeTask({ id: 't', list_id: 'l' }) },
      },
      [op('list', 'delete', 'l')],
      'me',
      today,
    );
    expect(s.lists.l).toBeUndefined();
    expect(s.tasks.t.list_id).toBeNull();
  });

  it('plano do dia e hábitos', () => {
    const habit = {
      id: 'h', calendar_id: null, title: 'Ler', description: null, color: null, recurrence_rule: 'FREQ=DAILY',
      start_date: '2026-10-01', status: 'active' as const, show_streak: false, created_by: 'me', version: 1,
      created_at: '', updated_at: '', logs: [],
    };
    const s = overlayItems(
      { ...empty, habits: { h: habit } },
      [op('checkin', 'mark', 'x', { day: today }), op('habit', 'log_set', 'h', { day: today, done: true })],
      'me',
      today,
    );
    expect(s.checkins).toEqual([today]);
    expect(s.habits.h.logs).toEqual([{ user_id: 'me', day: today }]);
  });

  it('fila: só a lista de avisos mais recente vale; uma operação por item de cada vez', () => {
    let q = enqueue([], op('task', 'alerts_set', 't', { minutes: [10] }));
    q = enqueue(q, op('task', 'alerts_set', 't', { minutes: [30] }));
    expect(q).toHaveLength(1);
    expect(q[0].payload).toEqual({ minutes: [30] });
    q = enqueue(q, op('task', 'complete', 't'));
    q = enqueue(q, op('task', 'reopen', 't'));
    expect(q).toHaveLength(3);
    expect(readyOps(q)).toHaveLength(1);
  });

  it('mesclagem de tarefas: prazo é um bloco; campos diferentes se juntam', () => {
    const base = { title: 'A', priority: 1, due_date: '2026-10-30', due_time: null };
    const server = { title: 'A', priority: 3, due_date: '2026-10-30', due_time: null, timezone: 'America/Sao_Paulo' };
    const local = { title: 'B' };
    expect(mergeFields(base, local, server, DUE_GROUP, 'due')).toEqual({ payload: { title: 'B' }, conflicts: [] });
    const both = mergeFields(
      { due_date: '2026-10-30', due_time: null, timezone: 'America/Sao_Paulo' },
      { due_date: '2026-10-31' },
      { due_date: '2026-11-02', due_time: '10:00:00', timezone: 'America/Sao_Paulo' },
      DUE_GROUP,
      'due',
    );
    expect(both.conflicts).toEqual(['due']);
    // "19:00" e "19:00:00" são o mesmo horário.
    expect(mergeFields({ due_time: '18:00' }, { due_time: '19:00' }, { due_time: '19:00:00' }).payload).toEqual({});
  });
});
