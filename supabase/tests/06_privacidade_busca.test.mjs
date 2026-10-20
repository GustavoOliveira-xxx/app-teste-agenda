import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup } from './helpers/scenario.mjs';

const RANGE = ['2026-01-01T00:00:00Z', '2027-12-31T00:00:00Z'];

async function create(db, userId, cal, overrides) {
  const id = uuid();
  const r = await db.rpc(userId, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal, overrides), null, 'app']);
  assert.equal(r.status, 'ok', JSON.stringify(r));
  return id;
}

async function titlesFor(db, userId, cal) {
  const { rows } = await db.as(userId, 'select title, is_masked from public.list_events($1, $2, $3) order by title nulls last', [[cal], ...RANGE]);
  return rows.map((r) => (r.is_masked ? '[ocupado]' : r.title));
}

test('privado: só quem criou vê; nem o proprietário (regra explícita da agenda)', async () => {
  const { db, ana, bruno, eva, cal } = await setupGroup();
  await create(db, bruno, cal, { title: 'Presente surpresa', privacy: 'private' });
  assert.deepEqual(await titlesFor(db, bruno, cal), ['Presente surpresa']);
  assert.deepEqual(await titlesFor(db, ana, cal), []);
  assert.deepEqual(await titlesFor(db, eva, cal), []);
  await db.close();
});

test('agenda que não permite privados recusa evento privado (regra 29)', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.as(ana, `update public.calendars set allow_private_events = false where id = '${cal}'`);
  const r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { privacy: 'private' }), null, 'app']);
  assert.deepEqual(r, { status: 'error', code: 'PRIVATE_EVENTS_DISABLED' });
  await db.close();
});

test('ocupado: membros veem só o horário; proprietário e administradores veem tudo', async () => {
  const { db, ana, bruno, carla, eva, cal } = await setupGroup();
  await create(db, bruno, cal, { title: 'Médico', privacy: 'busy', location: 'Clínica' });
  assert.deepEqual(await titlesFor(db, carla, cal), ['[ocupado]']);
  const masked = await db.as(carla, 'select location, description, created_by from public.list_events($1, $2, $3)', [[cal], ...RANGE]);
  assert.deepEqual(masked.rows[0], { location: null, description: null, created_by: null });
  assert.deepEqual(await titlesFor(db, ana, cal), ['Médico']);
  assert.deepEqual(await titlesFor(db, eva, cal), ['Médico']);
  // Leitura direta na tabela também não revela o evento a Carla.
  assert.equal((await db.as(carla, `select * from public.events where calendar_id = '${cal}'`)).rows.length, 0);
  await db.close();
});

test('só participantes: criador, participantes e administração veem', async () => {
  const { db, ana, bruno, carla, davi, cal } = await setupGroup();
  const id = await create(db, bruno, cal, { title: 'Reunião de condomínio', privacy: 'participants' });
  await db.rpc(bruno, 'set_event_attendees', [id, [carla]]);
  assert.deepEqual(await titlesFor(db, carla, cal), ['Reunião de condomínio']);
  assert.deepEqual(await titlesFor(db, davi, cal), []);
  assert.deepEqual(await titlesFor(db, ana, cal), ['Reunião de condomínio']);
  await db.close();
});

test('editor não consegue tornar privado o evento de outra pessoa (perderia o acesso)', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = await create(db, ana, cal, { title: 'Aniversário' });
  const r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', id, { privacy: 'private' }, 1, 'app']);
  assert.equal(r.status, 'error');
  await db.close();
});

test('busca respeita permissões e trata caracteres especiais', async () => {
  const { db, ana, bruno, carla, fabio, cal } = await setupGroup();
  await create(db, ana, cal, { title: 'Dentista', location: 'Centro' });
  await create(db, bruno, cal, { title: 'Dentista particular', privacy: 'private' });
  await create(db, ana, cal, { title: '100% de desconto' });
  const search = async (who, q) =>
    (await db.as(who, 'select title from public.search_events($1) order by title', [q])).rows.map((r) => r.title);

  assert.deepEqual(await search(carla, 'dentista'), ['Dentista']);
  assert.deepEqual(await search(bruno, 'dentista'), ['Dentista', 'Dentista particular']);
  assert.deepEqual(await search(carla, 'centro'), ['Dentista']);
  // "%" e "_" são tratados como texto, não como curinga.
  assert.deepEqual(await search(carla, '0% de'), ['100% de desconto']);
  assert.deepEqual(await search(carla, '%e'), []);
  assert.deepEqual(await search(carla, '__'), []);
  assert.deepEqual(await search(fabio, 'dentista'), []);
  assert.deepEqual(await search(carla, 'a'), []);
  await db.close();
});

test('histórico de evento privado não revela o título', async () => {
  const { db, bruno, carla, cal } = await setupGroup();
  await create(db, bruno, cal, { title: 'Segredo', privacy: 'private' });
  const forCarla = await db.as(carla, 'select action, details from public.list_activity($1) where event_id is not null', [cal]);
  assert.equal(forCarla.rows.length, 0);
  const forBruno = await db.as(bruno, 'select action, details from public.list_activity($1) where event_id is not null', [cal]);
  assert.equal(forBruno.rows.length, 1);
  assert.equal(forBruno.rows[0].details.title, null);
  await db.close();
});
