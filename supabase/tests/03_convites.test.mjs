import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TestDb, expectError } from './helpers/db.mjs';
import { createCalendar, invite, setupGroup, memberId } from './helpers/scenario.mjs';

async function base() {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const bruno = await db.createUser('bruno@exemplo.test', 'Bruno');
  const carla = await db.createUser('carla@exemplo.test', 'Carla');
  const cal = await createCalendar(db, ana, 'Nós dois');
  return { db, ana, bruno, carla, cal };
}

test('código: formato legível, guardado só como hash, prévia mostra agenda e papel', async () => {
  const { db, ana, bruno, cal } = await base();
  const inv = await invite(db, ana, cal, 'editor');
  assert.match(inv.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

  const stored = await db.admin('select code_hint, encode(code_hash, $1) as h from public.invitations', ['hex']);
  assert.equal(stored.rows[0].code_hint, inv.code.slice(-4));
  assert.notEqual(stored.rows[0].h, inv.code);
  const dump = await db.admin("select count(*)::int as n from public.invitations where code_hint || encode(code_hash, 'escape') like $1", [`%${inv.code.replace(/-/g, '')}%`]);
  assert.equal(dump.rows[0].n, 0);

  // Ninguém lê a tabela de convites diretamente.
  await expectError(db.as(ana, 'select * from public.invitations'), 'permission denied');

  const preview = await db.rpc(bruno, 'preview_invitation', [inv.code.toLowerCase()]);
  assert.equal(preview.ok, true);
  assert.equal(preview.calendar_name, 'Nós dois');
  assert.equal(preview.role, 'editor');
  assert.equal(preview.inviter_name, 'Ana');
  assert.equal(preview.status, 'pending');
  // A prévia não aceita.
  assert.equal((await db.as(bruno, `select id from public.calendars where id = '${cal}'`)).rows.length, 0);
  await db.close();
});

test('aceitar dá acesso com o papel do convite; aceitar de novo é idempotente (regra 18)', async () => {
  const { db, ana, bruno, cal } = await base();
  const inv = await invite(db, ana, cal, 'viewer');
  const first = await db.rpc(bruno, 'accept_invitation', [inv.code.replace(/-/g, ' ')]);
  assert.deepEqual(first, { ok: true, calendar_id: cal, already_member: false });
  const again = await db.rpc(bruno, 'accept_invitation', [inv.code]);
  assert.equal(again.ok, true);
  assert.equal(again.already_member, true);
  const { rows } = await db.admin(`select role from public.calendar_members where calendar_id = '${cal}' and user_id = '${bruno}'`);
  assert.equal(rows[0].role, 'viewer');
  const uses = await db.admin('select use_count, status from public.invitations');
  assert.deepEqual(uses.rows[0], { use_count: 1, status: 'accepted' });
  await db.close();
});

test('convite de uso único não serve para uma segunda pessoa', async () => {
  const { db, ana, bruno, carla, cal } = await base();
  const inv = await invite(db, ana, cal, 'editor');
  await db.rpc(bruno, 'accept_invitation', [inv.code]);
  const res = await db.rpc(carla, 'accept_invitation', [inv.code]);
  assert.deepEqual(res, { ok: false, error: 'INVITE_ALREADY_USED' });
  await db.close();
});

test('convite cancelado e convite expirado não podem ser aceitos (regras 5 e 6)', async () => {
  const { db, ana, bruno, carla, cal } = await base();
  const inv = await invite(db, ana, cal, 'editor');
  await db.rpc(ana, 'cancel_invitation', [inv.id]);
  assert.deepEqual(await db.rpc(bruno, 'accept_invitation', [inv.code]), { ok: false, error: 'INVITE_CANCELLED' });
  await expectError(db.rpc(ana, 'cancel_invitation', [inv.id]), 'INVALID_STATE');

  const inv2 = await invite(db, ana, cal, 'editor', { expiresInHours: 1 });
  await db.admin("update public.invitations set expires_at = now() - interval '1 minute' where id = $1", [inv2.id]);
  assert.deepEqual(await db.rpc(carla, 'accept_invitation', [inv2.code]), { ok: false, error: 'INVITE_EXPIRED' });
  const st = await db.admin('select status from public.invitations where id = $1', [inv2.id]);
  assert.equal(st.rows[0].status, 'expired');
  await db.close();
});

test('convite com vários usos fica "esgotado" ao atingir o limite', async () => {
  const { db, ana, bruno, carla, cal } = await base();
  const davi = await db.createUser('davi@exemplo.test', 'Davi');
  const inv = await invite(db, ana, cal, 'viewer', { maxUses: 2 });
  assert.equal((await db.rpc(bruno, 'accept_invitation', [inv.code])).ok, true);
  assert.equal((await db.rpc(carla, 'accept_invitation', [inv.code])).ok, true);
  assert.deepEqual(await db.rpc(davi, 'accept_invitation', [inv.code]), { ok: false, error: 'INVITE_EXHAUSTED' });
  const list = await db.as(ana, 'select status, use_count from public.list_calendar_invitations($1)', [cal]);
  assert.deepEqual(list.rows[0], { status: 'exhausted', use_count: 2 });
  await db.close();
});

test('códigos errados demais bloqueiam novas tentativas por um tempo', async () => {
  const { db, ana, bruno, cal } = await base();
  const inv = await invite(db, ana, cal, 'viewer');
  for (let i = 0; i < 10; i += 1) {
    const r = await db.rpc(bruno, 'accept_invitation', ['AAAA-BBBB-CCC' + (i % 10)]);
    assert.equal(r.error, 'INVITE_NOT_FOUND');
  }
  assert.deepEqual(await db.rpc(bruno, 'accept_invitation', [inv.code]), { ok: false, error: 'RATE_LIMITED' });
  assert.deepEqual(await db.rpc(bruno, 'preview_invitation', [inv.code]), { ok: false, error: 'RATE_LIMITED' });
  await db.close();
});

test('convite por e-mail: só o dono do e-mail confirmado aceita; aparece em "convites recebidos"', async () => {
  const { db, ana, bruno, carla, cal } = await base();
  const inv = await invite(db, ana, cal, 'editor', { email: 'Bruno@Exemplo.test ' });
  assert.equal(inv.invited_email, 'bruno@exemplo.test');

  assert.deepEqual(await db.rpc(carla, 'accept_invitation', [inv.code]), { ok: false, error: 'INVITE_FOR_OTHER_EMAIL' });
  const received = await db.as(bruno, 'select * from public.my_invitations()');
  assert.equal(received.rows.length, 1);
  assert.equal(received.rows[0].calendar_name, 'Nós dois');
  assert.equal((await db.as(carla, 'select * from public.my_invitations()')).rows.length, 0);

  // Bruno recebeu um aviso.
  const notes = await db.as(bruno, "select type from public.notifications where type = 'invite_received'");
  assert.equal(notes.rows.length, 1);

  const res = await db.rpc(bruno, 'respond_invitation', [received.rows[0].id, true]);
  assert.equal(res.ok, true);
  assert.equal((await db.as(bruno, 'select * from public.my_invitations()')).rows.length, 0);
  await db.close();
});

test('convite por e-mail exige e-mail confirmado', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const gabi = await db.createUser('gabi@exemplo.test', 'Gabi', { confirmed: false });
  const cal = await createCalendar(db, ana);
  const inv = await invite(db, ana, cal, 'viewer', { email: 'gabi@exemplo.test' });
  assert.deepEqual(await db.rpc(gabi, 'accept_invitation', [inv.code]), { ok: false, error: 'EMAIL_NOT_CONFIRMED' });
  assert.equal((await db.as(gabi, 'select * from public.my_invitations()')).rows.length, 0);
  await db.close();
});

test('recusar convite por e-mail avisa quem convidou', async () => {
  const { db, ana, bruno, cal } = await base();
  const inv = await invite(db, ana, cal, 'editor', { email: 'bruno@exemplo.test' });
  const res = await db.rpc(bruno, 'respond_invitation', [inv.id, false]);
  assert.deepEqual(res, { ok: true, declined: true });
  assert.deepEqual(await db.rpc(bruno, 'accept_invitation', [inv.code]), { ok: false, error: 'INVITE_DECLINED' });
  const notes = await db.as(ana, "select type from public.notifications where type = 'invite_declined'");
  assert.equal(notes.rows.length, 1);
  await db.close();
});

test('novo convite para o mesmo e-mail substitui o pendente (sem duplicados)', async () => {
  const { db, ana, bruno, cal } = await base();
  const first = await invite(db, ana, cal, 'viewer', { email: 'bruno@exemplo.test' });
  const second = await invite(db, ana, cal, 'editor', { email: 'bruno@exemplo.test' });
  const list = await db.as(ana, 'select id, status from public.list_calendar_invitations($1) order by created_at', [cal]);
  const byId = Object.fromEntries(list.rows.map((r) => [r.id, r.status]));
  assert.equal(byId[first.id], 'cancelled');
  assert.equal(byId[second.id], 'pending');
  await expectError(invite(db, ana, cal, 'viewer', { email: 'ana@exemplo.test' }), 'ALREADY_MEMBER');
  await db.close();
  void bruno;
});

test('quem pode convidar e qual papel pode conceder (regra 27)', async () => {
  const { db, ana, bruno, davi, eva, cal } = await setupGroup();
  await expectError(invite(db, davi, cal, 'viewer'), 'FORBIDDEN');
  await expectError(invite(db, bruno, cal, 'viewer'), 'FORBIDDEN');
  await expectError(invite(db, eva, cal, 'admin'), 'INVALID_ROLE');
  const ok = await invite(db, eva, cal, 'editor');
  assert.ok(ok.code);

  await db.as(ana, `update public.calendars set members_can_invite = true where id = '${cal}'`);
  await expectError(invite(db, bruno, cal, 'editor'), 'INVALID_ROLE');
  assert.ok((await invite(db, bruno, cal, 'collaborator')).code);

  await db.as(ana, `update public.calendars set admins_can_invite = false where id = '${cal}'`);
  await expectError(invite(db, eva, cal, 'viewer'), 'FORBIDDEN');
  await db.close();
});

test('proprietário altera o papel antes da aceitação (regra 6)', async () => {
  const { db, ana, bruno, cal } = await base();
  const inv = await invite(db, ana, cal, 'viewer');
  await db.rpc(ana, 'update_invitation_role', [inv.id, 'editor']);
  await db.rpc(bruno, 'accept_invitation', [inv.code]);
  const { rows } = await db.admin(`select role from public.calendar_members where calendar_id = '${cal}' and user_id = '${bruno}'`);
  assert.equal(rows[0].role, 'editor');
  await expectError(db.rpc(ana, 'update_invitation_role', [inv.id, 'viewer']), 'INVALID_STATE');
  await db.close();
});

test('quem foi removido pode voltar com um novo convite', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  await db.rpc(ana, 'remove_member', [await memberId(db, cal, bruno)]);
  const inv = await invite(db, ana, cal, 'viewer');
  const res = await db.rpc(bruno, 'accept_invitation', [inv.code]);
  assert.equal(res.ok, true);
  const { rows } = await db.admin(`select role, status from public.calendar_members where calendar_id = '${cal}' and user_id = '${bruno}'`);
  assert.deepEqual(rows[0], { role: 'viewer', status: 'active' });
  await db.close();
});

test('convite de agenda arquivada ou na lixeira não pode ser aceito', async () => {
  const { db, ana, bruno, cal } = await base();
  const inv = await invite(db, ana, cal, 'viewer');
  await db.rpc(ana, 'set_calendar_state', [cal, 'archive']);
  assert.deepEqual(await db.rpc(bruno, 'accept_invitation', [inv.code]), { ok: false, error: 'INVITE_CALENDAR_UNAVAILABLE' });
  await expectError(invite(db, ana, cal, 'viewer'), 'CALENDAR_NOT_WRITABLE');
  await db.close();
});
