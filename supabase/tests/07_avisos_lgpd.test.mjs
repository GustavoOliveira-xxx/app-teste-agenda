import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectError, uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup, memberId } from './helpers/scenario.mjs';

test('criar evento avisa os outros membros; quem criou não recebe aviso', async () => {
  const { db, ana, bruno, davi, cal } = await setupGroup();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal), null, 'app']);
  const forBruno = await db.as(bruno, "select type, title, body from public.notifications where type = 'event_created'");
  assert.equal(forBruno.rows.length, 1);
  assert.equal(forBruno.rows[0].title, 'Novo evento em Casa');
  assert.equal(forBruno.rows[0].body, 'Ana: Jantar');
  assert.equal((await db.as(ana, "select 1 from public.notifications where type = 'event_created'")).rows.length, 0);

  // Davi desliga os avisos desta agenda.
  await db.as(davi, `update public.calendar_members set notifications_enabled = false where calendar_id = '${cal}' and user_id = '${davi}'`);
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { title: 'Outro' }), null, 'app']);
  const forDavi = await db.as(davi, "select 1 from public.notifications where type = 'event_created'");
  assert.equal(forDavi.rows.length, 1);
  await db.close();
});

test('evento privado não gera aviso para ninguém', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { privacy: 'private' }), null, 'app']);
  assert.equal((await db.as(ana, "select 1 from public.notifications where type = 'event_created'")).rows.length, 0);
  await db.close();
});

test('removido recebe o aviso de remoção e deixa de receber avisos da agenda (regra 10)', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'remove_member', [await memberId(db, cal, bruno)]);
  const removed = await db.as(bruno, "select title from public.notifications where type = 'member_removed'");
  assert.equal(removed.rows.length, 1);
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal), null, 'app']);
  assert.equal((await db.as(bruno, "select 1 from public.notifications where type = 'event_created'")).rows.length, 0);
  await db.close();
});

test('avisos: cada um vê e marca como lido só os seus', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal), null, 'app']);
  const hack = await db.as(ana, `update public.notifications set read_at = now() where user_id = '${bruno}'`);
  assert.equal(hack.affectedRows, 0);
  const own = await db.as(bruno, 'update public.notifications set read_at = now() where read_at is null');
  assert.ok(own.affectedRows >= 1);
  await expectError(db.as(bruno, "update public.notifications set title = 'x'"), 'permission denied');
  await db.close();
});

test('mudanças administrativas são auditadas e ninguém lê a auditoria pela API (regra 24)', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'change_member_role', [await memberId(db, cal, bruno), 'viewer']);
  const audit = await db.admin("select action from public.audit_logs where action = 'member_role_changed'");
  assert.equal(audit.rows.length, 1);
  await expectError(db.as(ana, 'select * from public.audit_logs'), 'permission denied');
  await db.close();
});

test('exportação traz os dados da própria pessoa', async () => {
  const { db, ana, cal } = await setupGroup();
  await db.rpc(ana, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal), null, 'app']);
  const data = await db.rpc(ana, 'export_my_data');
  assert.equal(data.account.email, 'ana@exemplo.test');
  assert.equal(data.events_created.length, 1);
  assert.ok(data.memberships.length >= 2);
  assert.ok(data.devices.every((d) => !('push_token' in d)));
  await db.close();
});

test('exclusão de conta: exige confirmação, bloqueia quem é dono de agenda compartilhada e informa o impacto', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const ev = uuid();
  await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', ev, eventPayload(cal, { title: 'Evento do Bruno' }), null, 'app']);

  const impact = await db.rpc(ana, 'account_deletion_impact');
  assert.equal(impact.blocking_calendars.length, 1);
  await expectError(db.rpc(ana, 'delete_my_account', ['sim']), 'CONFIRMATION_REQUIRED');
  await expectError(db.rpc(ana, 'delete_my_account', ['EXCLUIR']), 'OWNS_SHARED_CALENDARS');

  const brunoImpact = await db.rpc(bruno, 'account_deletion_impact');
  assert.equal(brunoImpact.events_kept_in_shared_calendars, 1);
  const res = await db.rpc(bruno, 'delete_my_account', ['EXCLUIR']);
  assert.deepEqual(res, { ok: true });

  // A conta e o perfil somem; o evento fica na agenda do grupo, sem autor.
  assert.equal((await db.admin(`select 1 from auth.users where id = '${bruno}'`)).rows.length, 0);
  assert.equal((await db.admin(`select 1 from public.profiles where id = '${bruno}'`)).rows.length, 0);
  const kept = await db.admin(`select created_by from public.events where id = '${ev}'`);
  assert.equal(kept.rows[0].created_by, null);
  const members = await db.as(ana, 'select user_id from public.list_calendar_members($1)', [cal]);
  assert.ok(!members.rows.some((m) => m.user_id === bruno));
  await db.close();
});

test('manutenção da lixeira não pode ser chamada pelo app', async () => {
  const { db, ana } = await setupGroup();
  await expectError(db.rpc(ana, 'purge_trash', [30]), 'permission denied');
  const res = await db.admin('select public.purge_trash(30) as r');
  assert.deepEqual(res.rows[0].r, { calendars: 0, events: 0 });
  await db.close();
});
