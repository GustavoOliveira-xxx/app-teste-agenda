import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectError, uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup, createCalendar, memberId } from './helpers/scenario.mjs';

test('quem não é membro não vê a agenda, nem membros, nem eventos', async () => {
  const { db, ana, fabio, cal } = await setupGroup();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal), null, 'app']);
  assert.equal((await db.as(fabio, `select * from public.calendars where id = '${cal}'`)).rows.length, 0);
  assert.equal((await db.as(fabio, `select * from public.calendar_members where calendar_id = '${cal}'`)).rows.length, 0);
  assert.equal((await db.as(fabio, `select * from public.events where calendar_id = '${cal}'`)).rows.length, 0);
  const listed = await db.as(fabio, 'select * from public.list_events($1, $2, $3)', [[cal], '2026-01-01', '2027-01-01']);
  assert.equal(listed.rows.length, 0);
  assert.equal((await db.as(fabio, 'select * from public.list_calendar_members($1)', [cal])).rows.length, 0);
  await db.close();
});

test('o cliente não escolhe outro proprietário ao criar agenda', async () => {
  const { db, ana, bruno } = await setupGroup();
  const { rows } = await db.as(bruno, "insert into public.calendars (name) values ('Trabalho') returning owner_id");
  assert.equal(rows[0].owner_id, bruno);
  await expectError(
    db.as(bruno, `insert into public.calendars (name, owner_id) values ('X', '${ana}')`),
    'permission denied',
  );
  await db.close();
});

test('administrador edita configurações comuns, mas não as exclusivas do proprietário', async () => {
  const { db, eva, bruno, cal } = await setupGroup();
  await db.as(eva, `update public.calendars set name = 'Casa nova', color = '#30A46C' where id = '${cal}'`);
  const { rows } = await db.admin(`select name, color from public.calendars where id = '${cal}'`);
  assert.deepEqual(rows[0], { name: 'Casa nova', color: '#30A46C' });

  await expectError(
    db.as(eva, `update public.calendars set allow_private_events = false where id = '${cal}'`),
    'ONLY_OWNER_CAN_CHANGE_SETTING',
  );
  // Editor não altera a agenda (nenhuma linha afetada pelo RLS).
  const res = await db.as(bruno, `update public.calendars set name = 'Hack' where id = '${cal}'`);
  assert.equal(res.affectedRows, 0);
  await db.close();
});

test('membros não podem ser inseridos diretamente (ninguém é adicionado em silêncio)', async () => {
  const { db, ana, fabio, cal } = await setupGroup();
  await expectError(
    db.as(ana, `insert into public.calendar_members (calendar_id, user_id, role) values ('${cal}', '${fabio}', 'viewer')`),
    'permission denied',
  );
  await db.close();
});

test('ninguém eleva o próprio papel (regra 9)', async () => {
  const { db, davi, eva, cal } = await setupGroup();
  await expectError(
    db.as(davi, `update public.calendar_members set role = 'owner' where calendar_id = '${cal}' and user_id = '${davi}'`),
    'permission denied',
  );
  const evaMember = await memberId(db, cal, eva);
  await expectError(db.rpc(eva, 'change_member_role', [evaMember, 'editor']), 'CANNOT_CHANGE_OWN_ROLE');
  // Mas pode mudar a própria preferência de avisos.
  await db.as(davi, `update public.calendar_members set notifications_enabled = false where calendar_id = '${cal}' and user_id = '${davi}'`);
  const { rows } = await db.admin(`select notifications_enabled from public.calendar_members where calendar_id = '${cal}' and user_id = '${davi}'`);
  assert.equal(rows[0].notifications_enabled, false);
  await db.close();
});

test('administrador gerencia papéis abaixo dele; proprietário gerencia todos', async () => {
  const { db, ana, eva, bruno, davi, cal } = await setupGroup();
  const brunoM = await memberId(db, cal, bruno);
  const daviM = await memberId(db, cal, davi);
  const evaM = await memberId(db, cal, eva);

  await db.rpc(eva, 'change_member_role', [daviM, 'collaborator']);
  await expectError(db.rpc(eva, 'change_member_role', [brunoM, 'admin']), 'FORBIDDEN');
  await expectError(db.rpc(bruno, 'change_member_role', [daviM, 'viewer']), 'FORBIDDEN');
  await db.rpc(ana, 'change_member_role', [evaM, 'editor']);
  await expectError(db.rpc(ana, 'change_member_role', [brunoM, 'owner']), 'INVALID_ROLE');

  const { rows } = await db.admin(`select user_id, role from public.calendar_members where calendar_id = '${cal}'`);
  const roles = Object.fromEntries(rows.map((r) => [r.user_id, r.role]));
  assert.equal(roles[davi], 'collaborator');
  assert.equal(roles[eva], 'editor');
  await db.close();
});

test('remover membro revoga o acesso imediatamente (regras 4 e 20)', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const ev = uuid();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', ev, eventPayload(cal), null, 'app']);
  assert.equal((await db.as(bruno, `select id from public.events where id = '${ev}'`)).rows.length, 1);

  await db.rpc(ana, 'remove_member', [await memberId(db, cal, bruno)]);

  assert.equal((await db.as(bruno, `select id from public.events where id = '${ev}'`)).rows.length, 0);
  assert.equal((await db.as(bruno, `select id from public.calendars where id = '${cal}'`)).rows.length, 0);
  const res = await db.rpc(bruno, 'apply_event_op', [uuid(), 'update', ev, { title: 'Hack' }, 1, 'app']);
  assert.equal(res.status, 'error');
  assert.equal(res.code, 'NOT_FOUND');
  // Continua vendo a própria participação (para o app saber que perdeu acesso).
  const own = await db.as(bruno, `select status from public.calendar_members where calendar_id = '${cal}' and user_id = '${bruno}'`);
  assert.equal(own.rows[0].status, 'removed');
  await db.close();
});

test('administrador não remove outro administrador nem o proprietário', async () => {
  const { db, ana, eva, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'change_member_role', [await memberId(db, cal, bruno), 'admin']);
  await expectError(db.rpc(eva, 'remove_member', [await memberId(db, cal, bruno)]), 'FORBIDDEN');
  await expectError(db.rpc(eva, 'remove_member', [await memberId(db, cal, ana)]), 'FORBIDDEN');
  await db.close();
});

test('proprietário não sai sem transferir (regra 3); transferência funciona', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await expectError(db.rpc(ana, 'leave_calendar', [cal]), 'OWNER_CANNOT_LEAVE');
  await expectError(db.rpc(bruno, 'transfer_ownership', [cal, bruno]), 'FORBIDDEN');
  await db.rpc(ana, 'transfer_ownership', [cal, bruno]);

  const { rows } = await db.admin(`select user_id, role from public.calendar_members where calendar_id = '${cal}' and role in ('owner','admin') order by role`);
  const roles = Object.fromEntries(rows.map((r) => [r.user_id, r.role]));
  assert.equal(roles[bruno], 'owner');
  assert.equal(roles[ana], 'admin');
  const owner = await db.admin(`select owner_id from public.calendars where id = '${cal}'`);
  assert.equal(owner.rows[0].owner_id, bruno);

  await db.rpc(ana, 'leave_calendar', [cal]);
  assert.equal((await db.as(ana, `select id from public.calendars where id = '${cal}'`)).rows.length, 0);
  await db.close();
});

test('arquivar deixa a agenda somente leitura; lixeira esconde de todos e só o proprietário restaura', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'set_calendar_state', [cal, 'archive']);
  const res = await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal), null, 'app']);
  assert.equal(res.code, 'FORBIDDEN');
  await expectError(db.rpc(bruno, 'set_calendar_state', [cal, 'unarchive']), 'FORBIDDEN');
  await db.rpc(ana, 'set_calendar_state', [cal, 'unarchive']);

  await db.rpc(ana, 'set_calendar_state', [cal, 'trash']);
  assert.equal((await db.as(bruno, `select id from public.calendars where id = '${cal}'`)).rows.length, 0);
  const anaList = await db.as(ana, 'select id, deleted_at from public.list_my_calendars()');
  assert.ok(anaList.rows.find((r) => r.id === cal && r.deleted_at));
  await db.rpc(ana, 'set_calendar_state', [cal, 'restore']);
  assert.equal((await db.as(bruno, `select id from public.calendars where id = '${cal}'`)).rows.length, 1);

  await expectError(db.rpc(ana, 'set_calendar_state', [cal, 'purge']), 'INVALID_STATE');
  await db.rpc(ana, 'set_calendar_state', [cal, 'trash']);
  await db.rpc(ana, 'set_calendar_state', [cal, 'purge']);
  assert.equal((await db.admin(`select id from public.calendars where id = '${cal}'`)).rows.length, 0);
  await db.close();
});

test('duplicar agenda copia configurações e só os eventos que a pessoa pode ver', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { title: 'Público' }), null, 'app']);
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { title: 'Segredo', privacy: 'private' }), null, 'app']);
  const copy = await db.rpc(bruno, 'duplicate_calendar', [cal, 'Cópia do Bruno', true]);
  const { rows } = await db.as(bruno, `select title from public.events where calendar_id = '${copy}' order by title`);
  assert.deepEqual(rows.map((r) => r.title), ['Público']);
  const mine = await db.as(bruno, `select my_role from public.list_my_calendars() where id = '${copy}'`);
  assert.equal(mine.rows[0].my_role, 'owner');
  await db.close();
});

test('lista de membros mostra papéis a todos, mas última atividade só a quem administra', async () => {
  const { db, ana, davi, cal } = await setupGroup();
  const forDavi = await db.as(davi, 'select * from public.list_calendar_members($1)', [cal]);
  assert.equal(forDavi.rows.length, 5);
  assert.ok(forDavi.rows.every((r) => r.role));
  const anaRow = forDavi.rows.find((r) => r.user_id === ana);
  assert.equal(anaRow.last_activity_at, null);
  assert.equal(anaRow.notifications_enabled, null);
  await db.close();
});

test('a agenda nova tem exatamente um proprietário', async () => {
  const { db, ana } = await setupGroup();
  const cal = await createCalendar(db, ana, 'Viagem', { kind: 'travel' });
  const { rows } = await db.admin(`select count(*)::int as n from public.calendar_members where calendar_id = '${cal}' and role = 'owner'`);
  assert.equal(rows[0].n, 1);
  await db.close();
});
