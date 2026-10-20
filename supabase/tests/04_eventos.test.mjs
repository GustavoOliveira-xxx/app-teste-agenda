import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectError, uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup } from './helpers/scenario.mjs';

const RANGE = ['2026-01-01T00:00:00Z', '2027-12-31T00:00:00Z'];

async function create(db, userId, cal, overrides = {}) {
  const id = uuid();
  const res = await db.rpc(userId, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal, overrides), null, 'app']);
  return { id, res };
}

test('papéis: editor, colaborador e proprietário criam; visualizador não (regra 13)', async () => {
  const { db, ana, bruno, carla, davi, cal } = await setupGroup();
  for (const who of [ana, bruno, carla]) {
    const { res } = await create(db, who, cal);
    assert.equal(res.status, 'ok');
  }
  const { res } = await create(db, davi, cal);
  assert.deepEqual(res, { status: 'error', code: 'FORBIDDEN' });
  // Mesmo tentando direto na tabela, o banco recusa.
  await expectError(
    db.as(davi, `insert into public.events (calendar_id, title, starts_at, ends_at) values ('${cal}', 'x', now(), now() + interval '1 hour')`),
    'row-level security',
  );
  await db.close();
});

test('o criador é sempre quem está logado, mesmo que o app envie outro', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const { res } = await create(db, bruno, cal, { created_by: ana });
  assert.equal(res.event.created_by, bruno);
  await db.close();
});

test('colaborador edita só os próprios eventos; editor edita todos conforme a política', async () => {
  const { db, ana, bruno, carla, cal } = await setupGroup();
  const anas = await create(db, ana, cal);
  const carlas = await create(db, carla, cal);

  let r = await db.rpc(carla, 'apply_event_op', [uuid(), 'update', anas.id, { title: 'Mudei' }, 1, 'app']);
  assert.deepEqual(r, { status: 'error', code: 'FORBIDDEN' });
  r = await db.rpc(carla, 'apply_event_op', [uuid(), 'update', carlas.id, { title: 'Meu' }, 1, 'app']);
  assert.equal(r.status, 'ok');
  assert.equal(r.event.version, 2);

  r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', anas.id, { title: 'Editado' }, 1, 'app']);
  assert.equal(r.status, 'ok');

  await db.as(ana, `update public.calendars set editors_can_edit_all = false where id = '${cal}'`);
  r = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', anas.id, { title: 'De novo' }, 2, 'app']);
  assert.deepEqual(r, { status: 'error', code: 'FORBIDDEN' });
  await db.close();
});

test('validações do servidor: término depois do início, URL, título e recorrência', async () => {
  const { db, ana, cal } = await setupGroup();
  let { res } = await create(db, ana, cal, { ends_at: '2026-11-10T21:00:00Z' });
  assert.deepEqual(res, { status: 'error', code: 'END_BEFORE_START' });
  ({ res } = await create(db, ana, cal, { url: 'javascript:alert(1)' }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_DATA' });
  ({ res } = await create(db, ana, cal, { title: '   ' }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_DATA' });
  ({ res } = await create(db, ana, cal, { title: 'x'.repeat(151) }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_DATA' });
  ({ res } = await create(db, ana, cal, { recurrence_rule: 'FREQ=HOURLY' }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_DATA' });
  ({ res } = await create(db, ana, cal, { recurrence_rule: 'FREQ=DAILY;COUNT=3;UNTIL=20261231' }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_RECURRENCE' });
  ({ res } = await create(db, ana, cal, { timezone: 'Marte/Olympus' }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_TIMEZONE' });
  ({ res } = await create(db, ana, cal, { starts_at: 'ontem' }));
  assert.deepEqual(res, { status: 'error', code: 'INVALID_DATA' });
  ({ res } = await create(db, ana, cal, { url: 'https://exemplo.test/reuniao', title: '  Reunião  ' }));
  assert.equal(res.status, 'ok');
  assert.equal(res.event.title, 'Reunião');
  await db.close();
});

test('dia inteiro: datas locais são a fonte da verdade e o instante é calculado no fuso do evento', async () => {
  const { db, ana, cal } = await setupGroup();
  const { res } = await create(db, ana, cal, {
    all_day: true, start_date: '2026-12-25', end_date: '2026-12-25',
    starts_at: '2000-01-01T00:00:00Z', ends_at: '2000-01-02T00:00:00Z', timezone: 'America/Sao_Paulo',
  });
  assert.equal(res.status, 'ok');
  assert.equal(res.event.start_date, '2026-12-25');
  assert.equal(new Date(res.event.starts_at).toISOString(), '2026-12-25T03:00:00.000Z');
  assert.equal(new Date(res.event.ends_at).toISOString(), '2026-12-26T03:00:00.000Z');
  await db.close();
});

test('excluir é lógico: some da agenda (regra 11), pode ser restaurado e o reenvio é idempotente', async () => {
  const { db, ana, bruno, davi, cal } = await setupGroup();
  const { id } = await create(db, ana, cal);
  const op = uuid();
  const del = await db.rpc(bruno, 'apply_event_op', [op, 'delete', id, {}, 1, 'app']);
  assert.equal(del.status, 'ok');
  const replay = await db.rpc(bruno, 'apply_event_op', [op, 'delete', id, {}, 1, 'app']);
  assert.equal(replay.replayed, true);
  assert.equal(replay.status, 'ok');

  const listed = await db.as(davi, 'select id from public.list_events($1, $2, $3)', [[cal], ...RANGE]);
  assert.equal(listed.rows.length, 0);
  // Visualizador não enxerga eventos na lixeira.
  assert.equal((await db.as(davi, `select id from public.events where id = '${id}'`)).rows.length, 0);

  const restore = await db.rpc(ana, 'apply_event_op', [uuid(), 'restore', id, {}, null, 'app']);
  assert.equal(restore.status, 'ok');
  assert.equal((await db.as(davi, 'select id from public.list_events($1, $2, $3)', [[cal], ...RANGE])).rows.length, 1);
  await db.close();
});

test('cancelado continua no histórico mas fica marcado (regra 31); concluir registra a data', async () => {
  const { db, ana, cal } = await setupGroup();
  const { id } = await create(db, ana, cal);
  let r = await db.rpc(ana, 'apply_event_op', [uuid(), 'update', id, { status: 'cancelled' }, 1, 'app']);
  assert.equal(r.event.status, 'cancelled');
  r = await db.rpc(ana, 'apply_event_op', [uuid(), 'update', id, { status: 'completed' }, 2, 'app']);
  assert.ok(r.event.completed_at);
  const logs = await db.as(ana, 'select action from public.list_activity($1) where event_id is not null', [cal]);
  assert.deepEqual(logs.rows.map((x) => x.action).sort(), ['event_cancelled', 'event_completed', 'event_created']);
  await db.close();
});

test('política de conflito "bloquear" recusa sobreposição; "avisar" permite (regra 30)', async () => {
  const { db, ana, cal } = await setupGroup();
  await create(db, ana, cal);
  let { res } = await create(db, ana, cal, { starts_at: '2026-11-10T23:00:00Z', ends_at: '2026-11-11T00:00:00Z' });
  assert.equal(res.status, 'ok');
  await db.as(ana, `update public.calendars set conflict_policy = 'block' where id = '${cal}'`);
  ({ res } = await create(db, ana, cal, { starts_at: '2026-11-10T22:30:00Z', ends_at: '2026-11-10T22:45:00Z' }));
  assert.deepEqual(res, { status: 'error', code: 'EVENT_TIME_CONFLICT' });
  ({ res } = await create(db, ana, cal, { starts_at: '2026-11-11T10:00:00Z', ends_at: '2026-11-11T11:00:00Z' }));
  assert.equal(res.status, 'ok');
  await db.close();
});

test('não é possível mover evento para outra agenda nem alterar campos protegidos', async () => {
  const { db, ana, cal } = await setupGroup();
  const { id } = await create(db, ana, cal);
  const other = (await db.as(ana, "insert into public.calendars (name) values ('Outra') returning id")).rows[0].id;
  await expectError(db.as(ana, `update public.events set calendar_id = '${other}' where id = '${id}'`), 'permission denied');
  await expectError(db.as(ana, `update public.events set version = 99 where id = '${id}'`), 'permission denied');
  await expectError(db.as(ana, `update public.events set created_by = null where id = '${id}'`), 'permission denied');
  await db.close();
});

test('lembretes são pessoais; participantes precisam ser membros', async () => {
  const { db, ana, bruno, fabio, cal } = await setupGroup();
  const { id } = await create(db, ana, cal);
  await db.rpc(ana, 'set_event_reminders', [id, [10, 60, 10]]);
  await db.rpc(bruno, 'set_event_reminders', [id, [1440]]);
  const forAna = await db.as(ana, 'select my_reminders from public.list_events($1, $2, $3)', [[cal], ...RANGE]);
  assert.deepEqual(forAna.rows[0].my_reminders, [10, 60]);
  const forBruno = await db.as(bruno, 'select my_reminders from public.list_events($1, $2, $3)', [[cal], ...RANGE]);
  assert.deepEqual(forBruno.rows[0].my_reminders, [1440]);
  await expectError(db.rpc(ana, 'set_event_reminders', [id, [1, 2, 3, 4, 5, 6]]), 'TOO_MANY_REMINDERS');

  await db.rpc(ana, 'set_event_attendees', [id, [bruno]]);
  await expectError(db.rpc(ana, 'set_event_attendees', [id, [fabio]]), 'INVALID_ATTENDEE');
  await db.close();
});

test('comentários: colaborador comenta, visualizador não; autor edita; administrador apaga', async () => {
  const { db, ana, carla, davi, eva, cal } = await setupGroup();
  const { id } = await create(db, ana, cal);
  await db.as(carla, `insert into public.comments (event_id, body) values ('${id}', 'Levo a sobremesa <b>!</b>')`);
  await expectError(db.as(davi, `insert into public.comments (event_id, body) values ('${id}', 'oi')`), 'row-level security');

  const list = await db.as(davi, 'select * from public.list_event_comments($1)', [id]);
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].author_name, 'Carla');
  assert.equal(list.rows[0].body, 'Levo a sobremesa <b>!</b>');

  await db.as(carla, `update public.comments set body = 'Levo o vinho' where event_id = '${id}'`);
  const edited = await db.as(carla, 'select body, edited_at from public.list_event_comments($1)', [id]);
  assert.equal(edited.rows[0].body, 'Levo o vinho');
  assert.ok(edited.rows[0].edited_at);
  // Outra pessoa não edita o comentário.
  const hack = await db.as(ana, `update public.comments set body = 'hack' where event_id = '${id}'`);
  assert.equal(hack.affectedRows, 0);

  await db.rpc(eva, 'delete_comment', [list.rows[0].id]);
  const after = await db.as(carla, 'select body, deleted_at from public.list_event_comments($1)', [id]);
  assert.equal(after.rows[0].body, null);
  assert.ok(after.rows[0].deleted_at);

  // Ana (que avisa por ser a criadora) recebeu aviso do comentário.
  const notes = await db.as(ana, "select type from public.notifications where type = 'comment_added'");
  assert.equal(notes.rows.length, 1);
  await db.close();
});
