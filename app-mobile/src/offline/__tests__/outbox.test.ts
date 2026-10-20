import { makeEvent } from '../../utils/__tests__/fixtures';
import { threeWayMerge } from '../merge';
import {
  enqueue,
  makeOp,
  markConflict,
  markFailed,
  MAX_AUTO_ATTEMPTS,
  overlayPending,
  readyOps,
  recoverInterrupted,
  retryOp,
  summarize,
  type OutboxOp,
} from '../outbox';

let n = 0;
const op = (
  kind: OutboxOp['kind'],
  entityId: string,
  payload: Record<string, unknown> = {},
  baseVersion: number | null = null,
) =>
  makeOp(
    { id: `op-${++n}`, kind, entityId, calendarId: 'cal-1', payload, baseVersion },
    new Date('2026-11-01T10:00:00Z'),
  );

describe('fila de operações (outbox)', () => {
  it('alterações num evento ainda não enviado entram na própria criação', () => {
    let q = enqueue([], op('create', 'e1', { title: 'A' }));
    q = enqueue(q, op('update', 'e1', { title: 'B', location: 'Casa' }, 0));
    expect(q).toHaveLength(1);
    expect(q[0].payload).toEqual({ title: 'B', location: 'Casa' });
  });

  it('criar e excluir antes de enviar: nada vai para o servidor', () => {
    let q = enqueue([], op('create', 'e1', { title: 'A' }));
    q = enqueue(q, op('update', 'e1', { title: 'B' }));
    q = enqueue(q, op('delete', 'e1', {}, 0));
    expect(q).toEqual([]);
  });

  it('duas edições seguidas viram uma, mantendo a versão base da primeira', () => {
    let q = enqueue([], { ...op('update', 'e1', { title: 'B' }, 3), baseSnapshot: { title: 'A' } });
    q = enqueue(q, {
      ...op('update', 'e1', { location: 'X' }, 4),
      baseSnapshot: { title: 'B', location: null },
    });
    expect(q).toHaveLength(1);
    expect(q[0].baseVersion).toBe(3);
    expect(q[0].payload).toEqual({ title: 'B', location: 'X' });
    expect(q[0].baseSnapshot).toEqual({ title: 'A', location: null });
  });

  it('não mexe em operações que já estão sendo enviadas', () => {
    let q = enqueue([], op('update', 'e1', { title: 'B' }, 3));
    q = q.map((x) => ({ ...x, status: 'syncing' as const }));
    q = enqueue(q, op('update', 'e1', { title: 'C' }, 4));
    expect(q).toHaveLength(2);
  });

  it('envia uma operação por evento, na ordem, e segura as seguintes se houver conflito', () => {
    let q = enqueue([], op('create', 'e1'));
    q = enqueue(q, op('exception_upsert', 'e1', { original_date: '2026-11-02' }));
    q = enqueue(q, op('create', 'e2'));
    expect(readyOps(q).map((x) => x.entityId)).toEqual(['e1', 'e2']);
    q = markConflict(q, q[0].id, { reason: 'version', server: {}, fields: ['title'] });
    expect(readyOps(q).map((x) => x.entityId)).toEqual(['e2']);
  });

  it('falha temporária espera cada vez mais e para depois de várias tentativas', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    let q = enqueue([], op('create', 'e1'));
    q = markFailed(q, q[0].id, 'NETWORK', true, now);
    expect(q[0].status).toBe('failed');
    expect(readyOps(q, now)).toEqual([]);
    expect(readyOps(q, new Date(now.getTime() + 6_000))).toHaveLength(1);
    for (let i = 1; i < MAX_AUTO_ATTEMPTS; i++) q = markFailed(q, q[0].id, 'NETWORK', true, now);
    expect(q[0].nextAttemptAt).toBeNull();
    expect(readyOps(q, new Date(now.getTime() + 86_400_000))).toEqual([]);
    q = retryOp(q, q[0].id);
    expect(readyOps(q)).toHaveLength(1);
  });

  it('erro permanente (ex.: sem permissão) não tenta sozinho de novo', () => {
    const q = markFailed(enqueue([], op('create', 'e1')), `op-${n}`, 'FORBIDDEN', false);
    expect(q[0].nextAttemptAt).toBeNull();
  });

  it('app fechado durante o envio: a operação volta para a fila', () => {
    const q = recoverInterrupted([{ ...op('create', 'e1'), status: 'syncing' }]);
    expect(q[0].status).toBe('pending');
    expect(summarize(q)).toEqual({ pending: 1, failed: 0, conflicts: 0, total: 1 });
  });

  it('a tela mostra as alterações locais por cima dos dados do servidor', () => {
    const server = { e1: makeEvent({ id: 'e1', title: 'Servidor' }), e2: makeEvent({ id: 'e2' }) };
    let q = enqueue([], op('update', 'e1', { title: 'Local' }, 1));
    q = enqueue(q, op('delete', 'e2', {}, 1));
    q = enqueue(q, op('create', 'e3', { ...makeEvent({ id: 'e3', title: 'Novo' }) }));
    const view = overlayPending(server, q, 'me');
    expect(view.e1.title).toBe('Local');
    expect(view.e1.pending).toBe(true);
    expect(view.e2).toBeUndefined();
    expect(view.e3.title).toBe('Novo');
    expect(view.e3.created_by).toBe('me');
  });
});

describe('mesclagem de conflitos', () => {
  it('campos diferentes: os dois lados são mantidos', () => {
    const r = threeWayMerge(
      { title: 'Jantar' },
      { title: 'Jantar especial' },
      makeEvent({ title: 'Jantar', location: 'Novo local' }),
    );
    expect(r).toEqual({ payload: { title: 'Jantar especial' }, conflicts: [] });
  });

  it('mesmo campo com valores diferentes: conflito para a pessoa decidir', () => {
    const r = threeWayMerge({ title: 'Jantar' }, { title: 'Jantar A' }, makeEvent({ title: 'Jantar B' }));
    expect(r.conflicts).toEqual(['title']);
  });

  it('os dois chegaram ao mesmo valor: nada a enviar', () => {
    const r = threeWayMerge({ title: 'Jantar' }, { title: 'Igual' }, makeEvent({ title: 'Igual' }));
    expect(r).toEqual({ payload: {}, conflicts: [] });
  });

  it('horário é tratado como bloco: mudar início de um lado e fim do outro é conflito', () => {
    const base = { starts_at: '2026-11-10T22:00:00.000Z', ends_at: '2026-11-10T23:00:00.000Z' };
    const r = threeWayMerge(
      base,
      { starts_at: '2026-11-10T21:00:00.000Z', ends_at: '2026-11-10T23:00:00.000Z' },
      makeEvent({ starts_at: '2026-11-10T22:00:00.000Z', ends_at: '2026-11-11T00:00:00.000Z' }),
    );
    expect(r.conflicts).toEqual(['time']);
  });
});
