import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestDb } from './helpers/db.mjs';

const seed = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql'), 'utf8');
const ANA = 'a0000000-0000-4000-8000-000000000001';
const BRUNO = 'a0000000-0000-4000-8000-000000000002';
const DAVI = 'a0000000-0000-4000-8000-000000000004';
const CAL = 'c0000000-0000-4000-8000-000000000001';

test('seed cria o cenário de demonstração completo e respeita a privacidade', async () => {
  const db = await TestDb.create();
  await db.pg.exec(seed);

  const range = [[CAL], new Date(Date.now() - 60 * 864e5).toISOString(), new Date(Date.now() + 60 * 864e5).toISOString()];
  const forDavi = await db.as(DAVI, 'select title, is_masked, status, recurrence_rule, exceptions from public.list_events($1, $2, $3)', range);
  const titles = forDavi.rows.map((r) => (r.is_masked ? '[ocupado]' : r.title)).sort();
  assert.deepEqual(titles, ['Academia', 'Cinema', 'Consulta no dentista', 'Jantar de aniversário', 'Viagem para a praia', '[ocupado]']);
  assert.ok(forDavi.rows.find((r) => r.title === 'Academia').exceptions.length === 1);
  assert.equal(forDavi.rows.find((r) => r.title === 'Cinema').status, 'cancelled');

  const forBruno = await db.as(BRUNO, 'select title from public.list_events($1, $2, $3)', range);
  assert.ok(forBruno.rows.some((r) => r.title === 'Comprar presente'));

  const history = await db.as(ANA, 'select action from public.list_activity($1)', [CAL]);
  assert.ok(history.rows.length >= 8);
  const comments = await db.as(DAVI, "select count(*)::int as n from public.comments");
  assert.equal(comments.rows[0].n, 2);
  const calendars = await db.as(DAVI, 'select name, my_role from public.list_my_calendars() order by name');
  assert.deepEqual(calendars.rows.map((r) => r.my_role), ['viewer', 'owner']);
  await db.close();
});

test('seed não roda em banco que já tem usuários (proteção para produção)', async () => {
  const db = await TestDb.create();
  await db.createUser('real@exemplo.test', 'Pessoa real');
  await db.pg.exec(seed);
  const { rows } = await db.admin('select count(*)::int as n from auth.users');
  assert.equal(rows[0].n, 1);
  await db.close();
});
