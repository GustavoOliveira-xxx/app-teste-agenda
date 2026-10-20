import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TestDb, expectError } from './helpers/db.mjs';
import { createCalendar, addMember } from './helpers/scenario.mjs';

test('cadastro cria perfil, preferências e agenda pessoal com a pessoa como proprietária', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana', { timezone: 'America/Manaus' });
  const account = await db.rpc(ana, 'get_my_account');
  assert.equal(account.display_name, 'Ana');
  assert.equal(account.email, 'ana@exemplo.test');
  assert.equal(account.preferences.timezone, 'America/Manaus');
  assert.equal(account.notification_preferences.show_details_on_lock_screen, false);

  const { rows } = await db.as(ana, 'select * from public.list_my_calendars()');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'personal');
  assert.equal(rows[0].my_role, 'owner');
  await db.close();
});

test('fuso inválido no cadastro cai para America/Sao_Paulo', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana', { timezone: 'Lua/Base' });
  const account = await db.rpc(ana, 'get_my_account');
  assert.equal(account.preferences.timezone, 'America/Sao_Paulo');
  await db.close();
});

test('usuário anônimo não acessa nenhum dado (regra 1)', async () => {
  const db = await TestDb.create();
  await db.createUser('ana@exemplo.test', 'Ana');
  await expectError(db.as(null, 'select * from public.calendars'), 'permission denied');
  await expectError(db.as(null, 'select * from public.events'), 'permission denied');
  await expectError(db.as(null, 'select * from public.profiles'), 'permission denied');
  await expectError(db.as(null, 'select public.list_my_calendars()'), 'permission denied');
  await db.close();
});

test('perfil: vejo apenas quem divide agenda comigo e nunca o e-mail', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const bruno = await db.createUser('bruno@exemplo.test', 'Bruno');
  const carla = await db.createUser('carla@exemplo.test', 'Carla');
  const cal = await createCalendar(db, ana);
  await addMember(db, ana, cal, bruno, 'editor');

  const visible = await db.as(ana, 'select id, display_name from public.profiles order by display_name');
  assert.deepEqual(visible.rows.map((r) => r.display_name), ['Ana', 'Bruno']);

  const forCarla = await db.as(carla, 'select id from public.profiles');
  assert.deepEqual(forCarla.rows.map((r) => r.id), [carla]);

  // Colunas sensíveis não podem ser lidas diretamente.
  await expectError(db.as(ana, 'select last_seen_at from public.profiles'), 'permission denied');
  await db.close();
});

test('preferências: só a própria pessoa lê e altera; fuso é validado', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const bruno = await db.createUser('bruno@exemplo.test', 'Bruno');

  await db.as(ana, "update public.user_preferences set theme = 'dark', timezone = 'Europe/Lisbon'");
  const mine = await db.as(ana, 'select theme, timezone from public.user_preferences');
  assert.deepEqual(mine.rows, [{ theme: 'dark', timezone: 'Europe/Lisbon' }]);

  const other = await db.as(bruno, `select * from public.user_preferences where user_id = '${ana}'`);
  assert.equal(other.rows.length, 0);

  const changed = await db.as(bruno, `update public.user_preferences set theme = 'light' where user_id = '${ana}'`);
  assert.equal(changed.affectedRows, 0);

  await expectError(db.as(ana, "update public.user_preferences set timezone = 'Nada/Aqui'"), 'INVALID_TIMEZONE');
  await db.close();
});

test('dispositivos: registro idempotente por instalação e lista só os meus', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const bruno = await db.createUser('bruno@exemplo.test', 'Bruno');
  const id1 = await db.rpc(ana, 'register_device', ['inst-0001', 'android', 'Pixel', '15', '1.0.0']);
  const id2 = await db.rpc(ana, 'register_device', ['inst-0001', 'android', 'Pixel', '15', '1.0.1']);
  assert.equal(id1, id2);
  await db.rpc(bruno, 'register_device', ['inst-0002', 'android', 'Moto', '14', '1.0.0']);
  const mine = await db.as(ana, 'select device_name, app_version from public.devices');
  assert.deepEqual(mine.rows, [{ device_name: 'Pixel', app_version: '1.0.1' }]);
  await db.close();
});
