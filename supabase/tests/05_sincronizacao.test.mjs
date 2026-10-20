import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup } from './helpers/scenario.mjs';

const RANGE = ['2026-01-01T00:00:00Z', '2027-12-31T00:00:00Z'];

test('reenvio da mesma criação não duplica o evento (regra 17)', async () => {
  const { db, ana, cal } = await setupGroup();
  const op = uuid();
  const id = uuid();
  const first = await db.rpc(ana, 'apply_event_op', [op, 'create', id, eventPayload(cal), null, 'offline_sync']);
  const second = await db.rpc(ana, 'apply_event_op', [op, 'create', id, eventPayload(cal), null, 'offline_sync']);
  assert.equal(first.status, 'ok');
  assert.equal(first.event.change_origin, 'offline_sync');
  assert.equal(second.replayed, true);
  // Mesmo com outro id de operação (ex.: app reinstalado), o id do evento evita a duplicata.
  const third = await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal), null, 'offline_sync']);
  assert.equal(third.status, 'ok');
  const { rows } = await db.admin(`select count(*)::int as n from public.events where id = '${id}'`);
  assert.equal(rows[0].n, 1);
  await db.close();
});

test('id de evento de outra pessoa não pode ser reutilizado', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal), null, 'app']);
  const r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal, { title: 'Outro' }), null, 'app']);
  assert.deepEqual(r, { status: 'error', code: 'DUPLICATE_ID' });
  await db.close();
});

test('duas pessoas editam o mesmo evento: a segunda recebe conflito com a versão do servidor', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal), null, 'app']);
  const a = await db.rpc(ana, 'apply_event_op', [uuid(), 'update', id, { location: 'Restaurante' }, 1, 'app']);
  assert.equal(a.status, 'ok');
  const b = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', id, { title: 'Jantar especial' }, 1, 'offline_sync']);
  assert.equal(b.status, 'conflict');
  assert.equal(b.reason, 'version');
  assert.equal(b.event.version, 2);
  assert.equal(b.event.location, 'Restaurante');
  // Depois de mesclar no app, Bruno reenvia com a versão nova.
  const c = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', id, { title: 'Jantar especial' }, 2, 'offline_sync']);
  assert.equal(c.status, 'ok');
  assert.equal(c.event.title, 'Jantar especial');
  assert.equal(c.event.location, 'Restaurante');
  await db.close();
});

test('edição offline de um evento que outra pessoa excluiu vira conflito "deleted"', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal), null, 'app']);
  await db.rpc(ana, 'apply_event_op', [uuid(), 'delete', id, {}, 1, 'app']);
  const r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', id, { title: 'x' }, 1, 'offline_sync']);
  assert.equal(r.status, 'conflict');
  assert.equal(r.reason, 'deleted');
  await db.close();
});

test('excluir com versão antiga também é conflito (para perguntar ao usuário)', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal), null, 'app']);
  await db.rpc(ana, 'apply_event_op', [uuid(), 'update', id, { title: 'Novo' }, 1, 'app']);
  const r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'delete', id, {}, 1, 'offline_sync']);
  assert.equal(r.status, 'conflict');
  await db.close();
});

test('exceção de recorrência: cancelar e alterar uma ocorrência preserva a série (regra 32)', async () => {
  const { db, ana, davi, cal } = await setupGroup();
  const id = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id,
    eventPayload(cal, { recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU' }), null, 'app']);
  let r = await db.rpc(ana, 'apply_event_op', [uuid(), 'exception_upsert', id,
    { original_date: '2026-11-17', is_cancelled: true }, null, 'app']);
  assert.equal(r.status, 'ok');
  r = await db.rpc(ana, 'apply_event_op', [uuid(), 'exception_upsert', id,
    { original_date: '2026-11-24', title: 'Jantar na casa da mãe', starts_at: '2026-11-24T21:00:00Z', ends_at: '2026-11-24T23:00:00Z' }, null, 'app']);
  assert.equal(r.status, 'ok');
  // Visualizador não cria exceções.
  r = await db.rpc(davi, 'apply_event_op', [uuid(), 'exception_upsert', id, { original_date: '2026-12-01', is_cancelled: true }, null, 'app']);
  assert.deepEqual(r, { status: 'error', code: 'FORBIDDEN' });

  const { rows } = await db.as(davi, 'select recurrence_rule, exceptions from public.list_events($1, $2, $3)', [[cal], ...RANGE]);
  assert.equal(rows[0].recurrence_rule, 'FREQ=WEEKLY;BYDAY=TU');
  assert.equal(rows[0].exceptions.length, 2);
  assert.equal(rows[0].exceptions[0].is_cancelled, true);
  assert.equal(rows[0].exceptions[1].title, 'Jantar na casa da mãe');

  r = await db.rpc(ana, 'apply_event_op', [uuid(), 'exception_delete', id, { original_date: '2026-11-17' }, null, 'app']);
  assert.equal(r.status, 'ok');
  const after = await db.as(davi, 'select exceptions from public.list_events($1, $2, $3)', [[cal], ...RANGE]);
  assert.equal(after.rows[0].exceptions.length, 1);
  await db.close();
});

test('"esta e as próximas" encerra a série e cria a nova numa única operação', async () => {
  const { db, ana, cal } = await setupGroup();
  const id = uuid();
  const newId = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal, { recurrence_rule: 'FREQ=DAILY' }), null, 'app']);
  const r = await db.rpc(ana, 'apply_event_op', [uuid(), 'split_series', id, {
    original_rule: 'FREQ=DAILY;UNTIL=20261119',
    new_event: { id: newId, title: 'Jantar (novo horário)', starts_at: '2026-11-20T23:00:00Z', ends_at: '2026-11-21T00:00:00Z', recurrence_rule: 'FREQ=DAILY' },
  }, 1, 'app']);
  assert.equal(r.status, 'ok');
  assert.equal(r.event.recurrence_rule, 'FREQ=DAILY;UNTIL=20261119');
  assert.equal(r.new_event.id, newId);
  assert.equal(r.new_event.calendar_id, cal);

  // Com versão antiga, nada é alterado (atômico).
  const stale = await db.rpc(ana, 'apply_event_op', [uuid(), 'split_series', id, {
    original_rule: 'FREQ=DAILY;UNTIL=20261101', new_event: { id: uuid(), title: 'x', starts_at: '2026-11-02T23:00:00Z', ends_at: '2026-11-03T00:00:00Z' },
  }, 1, 'app']);
  assert.equal(stale.status, 'conflict');
  const { rows } = await db.admin(`select count(*)::int as n from public.events where calendar_id = '${cal}'`);
  assert.equal(rows[0].n, 2);
  await db.close();
});

test('operação inválida e falta de login são recusadas', async () => {
  const { db, ana, cal } = await setupGroup();
  const r = await db.rpc(ana, 'apply_event_op', [uuid(), 'drop_table', uuid(), {}, null, 'app']);
  assert.deepEqual(r, { status: 'error', code: 'INVALID_OPERATION' });
  await assert.rejects(db.as(null, 'select public.apply_event_op($1, $2, $3, $4, null, $5)',
    [uuid(), 'create', uuid(), eventPayload(cal), 'app']));
  await db.close();
});
