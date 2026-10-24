import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectError, uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup, memberId } from './helpers/scenario.mjs';

// Atalho: operação de item com id de operação novo.
const op = (db, user, entity, kind, id, payload = {}, base = null, origin = 'app') =>
  db.rpc(user, 'apply_item_op', [uuid(), entity, kind, id, payload, base, origin]);

const items = async (db, user) => db.rpc(user, 'list_my_items', [null]);

test('tarefa simples exige só o título e nasce pendente', async () => {
  const { db, ana } = await setupGroup();
  const id = uuid();
  const r = await op(db, ana, 'task', 'create', id, { title: '  Comprar pão  ' });
  assert.equal(r.status, 'ok');
  assert.equal(r.task.title, 'Comprar pão');
  assert.equal(r.task.status, 'pending');
  assert.equal(r.task.priority, 0);
  assert.equal(r.task.item_type, 'task');
  assert.equal(r.task.calendar_id, null);
  assert.equal(r.task.version, 1);
  assert.deepEqual(r.task.checklist, []);

  const bad = await op(db, ana, 'task', 'create', uuid(), { title: '   ' });
  assert.deepEqual(bad, { status: 'error', code: 'INVALID_DATA' });
  const late = await op(db, ana, 'task', 'create', uuid(), { title: 'x', due_time: '10:00' });
  assert.equal(late.code, 'INVALID_DATA', 'horário sem data não é aceito');
  const link = await op(db, ana, 'task', 'create', uuid(), { title: 'x', links: ['javascript:alert(1)'] });
  assert.equal(link.code, 'INVALID_LINK');

  const tags = await op(db, ana, 'task', 'create', uuid(), { title: 'x', tags: ['#Casa', 'casa', ' Mercado '] });
  assert.deepEqual(tags.task.tags, ['casa', 'mercado']);
  await db.close();
});

test('tarefa pessoal é invisível para quem divide outra agenda; escrita direta é proibida', async () => {
  const { db, ana, bruno } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, { title: 'Exame particular' });
  const direct = await db.as(bruno, 'select id from public.tasks');
  assert.equal(direct.rows.length, 0, 'Bruno leu a tarefa pessoal da Ana');
  assert.equal((await items(db, bruno)).tasks.length, 0);
  const r = await op(db, bruno, 'task', 'update', id, { title: 'invadido' }, 1);
  assert.deepEqual(r, { status: 'error', code: 'NOT_FOUND' });
  await expectError(db.as(ana, `insert into public.tasks (title) values ('x')`), 'permission denied');
  await expectError(db.as(ana, `update public.tasks set title = 'x'`), 'permission denied');
  await expectError(db.as(ana, `delete from public.tasks`), 'permission denied');
  // Sem login, nada.
  await expectError(db.as(null, 'select * from public.tasks'), 'permission denied');
  await db.close();
});

test('tarefa compartilhada: papéis, privacidade e responsável', async () => {
  const { db, ana, bruno, carla, davi, fabio, cal } = await setupGroup();
  const shared = uuid();
  assert.equal((await op(db, carla, 'task', 'create', shared, { title: 'Lavar o carro', calendar_id: cal })).status, 'ok');
  // Visualizador não cria; quem não é membro também não.
  assert.equal((await op(db, davi, 'task', 'create', uuid(), { title: 'x', calendar_id: cal })).code, 'FORBIDDEN');
  assert.equal((await op(db, fabio, 'task', 'create', uuid(), { title: 'x', calendar_id: cal })).code, 'FORBIDDEN');
  // Todos os membros veem; quem está fora não.
  for (const u of [ana, bruno, davi]) assert.equal((await items(db, u)).tasks.length, 1);
  assert.equal((await items(db, fabio)).tasks.length, 0);

  // Colaboradora edita só o que é dela; editor edita tudo (agenda permite).
  const other = uuid();
  await op(db, bruno, 'task', 'create', other, { title: 'Do Bruno', calendar_id: cal });
  assert.equal((await op(db, carla, 'task', 'update', other, { title: 'mudei' }, 1)).code, 'FORBIDDEN');
  assert.equal((await op(db, bruno, 'task', 'update', shared, { priority: 3 }, 1)).status, 'ok');

  // Responsável precisa ser membro.
  assert.equal((await op(db, ana, 'task', 'update', shared, { assignee_id: fabio }, 2)).code, 'INVALID_ASSIGNEE');
  // Visualizador atribuído consegue concluir, mas não editar.
  const t = await op(db, ana, 'task', 'update', shared, { assignee_id: davi }, 2);
  assert.equal(t.task.assignee_id, davi);
  assert.equal((await op(db, davi, 'task', 'update', shared, { title: 'x' }, 3)).code, 'FORBIDDEN');
  assert.equal((await op(db, davi, 'task', 'update', shared, { status: 'in_progress' }, 3)).status, 'ok');
  const done = await op(db, davi, 'task', 'complete', shared, {});
  assert.equal(done.task.status, 'done');
  assert.equal(done.task.completed_by, davi);
  // Aviso de atribuição para Davi e de conclusão para Carla (quem criou).
  const davisNotes = await db.as(davi, `select type from public.notifications where type = 'task_assigned'`);
  assert.equal(davisNotes.rows.length, 1);
  const carlas = await db.as(carla, `select type, data from public.notifications where type = 'task_completed'`);
  assert.equal(carlas.rows.length, 1);
  assert.equal(carlas.rows[0].data.task_id, shared);

  // Privada dentro da agenda: só quem criou e o responsável.
  const secret = uuid();
  await op(db, carla, 'task', 'create', secret, { title: 'Surpresa', calendar_id: cal, privacy: 'private' });
  assert.equal((await items(db, ana)).tasks.some((x) => x.id === secret), false, 'proprietária viu tarefa privada');
  const direct = await db.as(bruno, `select id from public.tasks where id = $1`, [secret]);
  assert.equal(direct.rows.length, 0);
  // "Participantes": só os escolhidos (e proprietário/administração).
  const p = uuid();
  await op(db, carla, 'task', 'create', p, { title: 'Presente', calendar_id: cal, privacy: 'participants', participant_ids: [bruno] });
  assert.equal((await items(db, bruno)).tasks.some((x) => x.id === p), true);
  assert.equal((await items(db, davi)).tasks.some((x) => x.id === p), false);
  assert.equal((await items(db, ana)).tasks.some((x) => x.id === p), true);
  assert.equal((await op(db, carla, 'task', 'participants_set', p, { user_ids: [fabio] })).code, 'INVALID_PARTICIPANT');
  await db.close();
});

test('reenvio da mesma operação não duplica e devolve o estado atual', async () => {
  const { db, ana } = await setupGroup();
  const id = uuid();
  const opId = uuid();
  const a = await db.rpc(ana, 'apply_item_op', [opId, 'task', 'create', id, { title: 'Uma vez' }, null, 'offline_sync']);
  const b = await db.rpc(ana, 'apply_item_op', [opId, 'task', 'create', id, { title: 'Uma vez' }, null, 'offline_sync']);
  assert.equal(a.task.change_origin, 'offline_sync');
  assert.equal(b.replayed, true);
  assert.equal(b.task.id, id);
  const c = await op(db, ana, 'task', 'create', id, { title: 'Uma vez' });
  assert.equal(c.status, 'ok');
  const { rows } = await db.admin('select count(*)::int n from public.tasks');
  assert.equal(rows[0].n, 1);
  await db.close();
});

test('conflitos: versão antiga e tarefa excluída por outra pessoa', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, { title: 'Pintar a sala', calendar_id: cal });
  assert.equal((await op(db, ana, 'task', 'update', id, { priority: 2 }, 1)).status, 'ok');
  const c = await op(db, bruno, 'task', 'update', id, { title: 'Pintar a cozinha' }, 1);
  assert.equal(c.status, 'conflict');
  assert.equal(c.reason, 'version');
  assert.equal(c.task.priority, 2);
  await op(db, ana, 'task', 'delete', id, {}, 2);
  const d = await op(db, bruno, 'task', 'update', id, { title: 'x' }, 2);
  assert.equal(d.reason, 'deleted');
  // Restaurar volta a tarefa.
  assert.equal((await op(db, ana, 'task', 'restore', id)).task.deleted_at, null);
  await db.close();
});

test('recorrência por calendário: concluir avança uma vez, mesmo em dois aparelhos', async () => {
  const { db, ana } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, {
    title: 'Revisar orçamento', due_date: '2026-11-05', recurrence_rule: 'FREQ=MONTHLY', timezone: 'America/Sao_Paulo',
    checklist: [{ id: uuid(), title: 'Contas' }],
  });
  await op(db, ana, 'task', 'checklist_upsert', id, { id: (await items(db, ana)).tasks[0].checklist[0].id, done: true });
  const a = await op(db, ana, 'task', 'complete', id, { occurrence_date: '2026-11-05' });
  const b = await op(db, ana, 'task', 'complete', id, { occurrence_date: '2026-11-05' }, null, 'offline_sync');
  assert.equal(a.task.due_date, '2026-12-05');
  assert.equal(b.task.due_date, '2026-12-05', 'avançou duas vezes');
  assert.equal(a.task.status, 'pending');
  assert.equal(a.task.checklist[0].done, false, 'etapas voltam para a próxima ocorrência');
  const { rows } = await db.admin('select occurrence_date::text d from public.task_completions');
  assert.deepEqual(rows.map((r) => r.d), ['2026-11-05']);
  // Desfazer volta para a ocorrência desfeita.
  const u = await op(db, ana, 'task', 'reopen', id, { occurrence_date: '2026-11-05' });
  assert.equal(u.task.due_date, '2026-11-05');
  assert.equal((await db.admin('select count(*)::int n from public.task_completions')).rows[0].n, 0);

  // Série com fim: depois da última, a tarefa é concluída.
  const last = uuid();
  await op(db, ana, 'task', 'create', last, { title: 'Três vezes', due_date: '2026-11-01', recurrence_rule: 'FREQ=WEEKLY;COUNT=2' });
  assert.equal((await op(db, ana, 'task', 'complete', last, { occurrence_date: '2026-11-01' })).task.due_date, '2026-11-08');
  const end = await op(db, ana, 'task', 'complete', last, { occurrence_date: '2026-11-08' });
  assert.equal(end.task.status, 'done');
  const hist = await db.rpc(ana, 'list_task_history', [last]);
  assert.equal(hist.filter((h) => h.kind === 'completion').length, 2);
  await db.close();
});

test('recorrência depois da conclusão conta a partir do dia em que foi feita', async () => {
  const { db, ana } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, {
    title: 'Limpar o filtro', due_date: '2026-01-01', recurrence_rule: 'FREQ=DAILY;INTERVAL=30', recurrence_mode: 'completion',
  });
  const r = await op(db, ana, 'task', 'complete', id, {});
  const { rows } = await db.admin(`select ((now() at time zone 'America/Sao_Paulo')::date + 30)::text d`);
  assert.equal(r.task.due_date, rows[0].d);
  const bad = await op(db, ana, 'task', 'create', uuid(), {
    title: 'x', due_date: '2026-01-01', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO', recurrence_mode: 'completion',
  });
  assert.equal(bad.code, 'INVALID_RECURRENCE');
  await db.close();
});

test('alertas, "meu dia" e dias planejados são pessoais', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, { title: 'Reunião de condomínio', calendar_id: cal, due_date: '2026-11-10', due_time: '19:00', alerts: [30, 0] });
  await op(db, bruno, 'task', 'alerts_set', id, { minutes: [60] });
  await op(db, bruno, 'task', 'plan_set', id, { day: '2026-11-10' });
  const a = (await items(db, ana)).tasks[0];
  const b = (await items(db, bruno)).tasks[0];
  assert.deepEqual(a.my_alerts, [0, 30]);
  assert.deepEqual(b.my_alerts, [60]);
  assert.equal(a.plan_day, null);
  assert.equal(b.plan_day, '2026-11-10');
  assert.equal((await op(db, ana, 'task', 'alerts_set', id, { minutes: [1, 2, 3, 4, 5, 6] })).code, 'TOO_MANY_REMINDERS');

  await op(db, ana, 'checkin', 'mark', uuid(), { day: '2026-11-10' });
  await op(db, ana, 'checkin', 'mark', uuid(), { day: '2026-11-10' });
  assert.deepEqual((await items(db, ana)).checkins, ['2026-11-10']);
  assert.deepEqual((await items(db, bruno)).checkins, []);
  await db.close();
});

test('subtarefas: responsável marca, só quem edita cria ou apaga', async () => {
  const { db, ana, davi, cal } = await setupGroup();
  const id = uuid();
  const step = uuid();
  await op(db, ana, 'task', 'create', id, { title: 'Preparar apresentação', calendar_id: cal, assignee_id: davi,
    checklist: [{ id: step, title: 'Pesquisar referências', position: 1 }, { id: uuid(), title: 'Criar slides', position: 2 }] });
  const marked = await op(db, davi, 'task', 'checklist_upsert', id, { id: step, done: true });
  assert.equal(marked.task.checklist[0].done, true);
  assert.equal(marked.task.checklist[0].done_by, davi);
  assert.equal(marked.task.status, 'pending', 'a tarefa não pode ser concluída sozinha');
  assert.equal((await op(db, davi, 'task', 'checklist_upsert', id, { id: uuid(), title: 'novo' })).code, 'FORBIDDEN');
  assert.equal((await op(db, davi, 'task', 'checklist_delete', id, { id: step })).code, 'FORBIDDEN');
  assert.equal((await op(db, ana, 'task', 'checklist_delete', id, { id: step })).task.checklist.length, 1);
  await db.close();
});

test('listas: pessoal, compartilhada e tarefa precisa estar na mesma agenda da lista', async () => {
  const { db, ana, bruno, carla, fabio, cal } = await setupGroup();
  const personal = uuid();
  const shared = uuid();
  assert.equal((await op(db, ana, 'list', 'create', personal, { name: 'Estudos' })).status, 'ok');
  assert.equal((await op(db, carla, 'list', 'create', shared, { name: 'Compras da semana', calendar_id: cal })).status, 'ok');
  assert.deepEqual((await items(db, bruno)).lists.map((l) => l.name), ['Compras da semana']);
  assert.equal((await items(db, fabio)).lists.length, 0);

  const mismatch = await op(db, ana, 'task', 'create', uuid(), { title: 'Arroz', list_id: shared });
  assert.equal(mismatch.code, 'LIST_MISMATCH');
  const rice = uuid();
  await op(db, bruno, 'task', 'create', rice, { title: 'Arroz', list_id: shared, calendar_id: cal });
  // Carla criou a lista; Bruno (editor) pode renomear; Fabio não.
  assert.equal((await op(db, bruno, 'list', 'update', shared, { name: 'Mercado' })).list.name, 'Mercado');
  assert.equal((await op(db, fabio, 'list', 'update', shared, { name: 'x' })).code, 'NOT_FOUND');
  // Excluir a lista não apaga as tarefas.
  await op(db, carla, 'list', 'delete', shared);
  const t = (await items(db, bruno)).tasks.find((x) => x.id === rice);
  assert.equal(t.list_id, null);
  await db.close();
});

test('mover tarefa pessoal para agenda compartilhada e de volta', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, { title: 'Organizar documentos' });
  const moved = await op(db, ana, 'task', 'update', id, { calendar_id: cal, assignee_id: bruno }, 1);
  assert.equal(moved.task.calendar_id, cal);
  assert.equal((await items(db, bruno)).tasks.length, 1);
  // Só quem criou pode trazer de volta para o pessoal; responsável é limpo.
  assert.equal((await op(db, bruno, 'task', 'update', id, { calendar_id: null }, 2)).code, 'FORBIDDEN');
  const back = await op(db, ana, 'task', 'update', id, { calendar_id: null }, 2);
  assert.equal(back.task.assignee_id, null);
  assert.equal((await items(db, bruno)).tasks.length, 0);
  await db.close();
});

test('membro removido perde na hora tarefas, atribuições, alertas e planos da agenda', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'task', 'create', id, { title: 'Consertar portão', calendar_id: cal, assignee_id: bruno });
  await op(db, bruno, 'task', 'alerts_set', id, { minutes: [10] });
  await op(db, bruno, 'task', 'plan_set', id, { day: '2026-11-10' });
  await db.rpc(ana, 'remove_member', [await memberId(db, cal, bruno)]);
  assert.equal((await items(db, bruno)).tasks.length, 0);
  assert.equal((await db.as(bruno, 'select id from public.tasks')).rows.length, 0);
  const t = (await items(db, ana)).tasks[0];
  assert.equal(t.assignee_id, null);
  const left = await db.admin('select (select count(*) from public.task_alerts)::int a, (select count(*) from public.task_plans)::int p');
  assert.deepEqual(left.rows[0], { a: 0, p: 0 });
  assert.equal((await op(db, bruno, 'task', 'complete', id, {})).code, 'NOT_FOUND');
  await db.close();
});

test('comentários e histórico de tarefas respeitam a privacidade', async () => {
  const { db, ana, bruno, carla, davi, cal } = await setupGroup();
  const id = uuid();
  await op(db, carla, 'task', 'create', id, { title: 'Festa', calendar_id: cal, assignee_id: bruno });
  await db.rpc(bruno, 'add_task_comment', [id, 'Já comprei os balões']);
  const comments = await db.as(ana, 'select * from public.list_task_comments($1)', [id]);
  assert.equal(comments.rows.length, 1);
  await expectError(db.rpc(davi, 'add_task_comment', [id, 'oi']), 'FORBIDDEN');
  const notes = await db.as(carla, `select type from public.notifications where type = 'task_comment'`);
  assert.equal(notes.rows.length, 1);

  const secret = uuid();
  await op(db, carla, 'task', 'create', secret, { title: 'Segredo', calendar_id: cal, privacy: 'private' });
  const seen = await db.as(ana, `select details from public.item_activity where entity_id = $1`, [secret]);
  assert.equal(seen.rows.length, 0, 'histórico de tarefa privada vazou');
  const history = await db.rpc(ana, 'list_task_history', [id]);
  assert.ok(history.some((h) => h.action === 'created'));
  assert.ok(history.some((h) => h.action === 'commented'));
  assert.deepEqual(await db.rpc(ana, 'list_task_history', [secret]), []);
  await db.close();
});

test('anotações: pessoais, da agenda e permissões de edição', async () => {
  const { db, ana, bruno, carla, davi, fabio, cal } = await setupGroup();
  const mine = uuid();
  const shared = uuid();
  await op(db, ana, 'note', 'create', mine, { title: 'Senhas do wi-fi', body: 'só minhas' });
  await op(db, carla, 'note', 'create', shared, { title: 'Endereços', body: 'Rua A, 10', calendar_id: cal });
  assert.equal((await items(db, bruno)).notes.length, 1);
  assert.equal((await items(db, fabio)).notes.length, 0);
  assert.equal((await op(db, davi, 'note', 'create', uuid(), { body: 'x', calendar_id: cal })).code, 'FORBIDDEN');
  assert.equal((await op(db, bruno, 'note', 'update', mine, { body: 'x' }, 1)).code, 'NOT_FOUND');
  assert.equal((await op(db, bruno, 'note', 'update', shared, { pinned: true }, 1)).note.pinned, true);
  const stale = await op(db, carla, 'note', 'update', shared, { body: 'Rua B' }, 1);
  assert.equal(stale.status, 'conflict');
  assert.equal((await op(db, ana, 'note', 'create', uuid(), { title: null, body: '   ' })).code, 'INVALID_DATA');
  await op(db, carla, 'note', 'delete', shared);
  assert.equal((await items(db, bruno)).notes.length, 0);
  await db.close();
});

test('hábitos: rotina compartilhada, cada um registra a própria participação', async () => {
  const { db, ana, bruno, davi, cal } = await setupGroup();
  const id = uuid();
  await op(db, ana, 'habit', 'create', id, { title: 'Organizar a semana', calendar_id: cal, recurrence_rule: 'FREQ=WEEKLY;BYDAY=SU' });
  await op(db, bruno, 'habit', 'log_set', id, { day: '2026-10-18', done: true });
  await op(db, davi, 'habit', 'log_set', id, { day: '2026-10-18', done: true });
  const h = (await items(db, ana)).habits[0];
  // Os registros de 2026-10-18 só aparecem se estiverem nos últimos 70 dias.
  assert.ok(Array.isArray(h.logs));
  const { rows } = await db.admin('select count(*)::int n from public.habit_logs');
  assert.equal(rows[0].n, 2);
  await op(db, bruno, 'habit', 'log_set', id, { day: '2026-10-18', done: false });
  assert.equal((await db.admin('select count(*)::int n from public.habit_logs')).rows[0].n, 1);
  assert.equal((await op(db, davi, 'habit', 'update', id, { status: 'paused' })).code, 'FORBIDDEN');
  assert.equal((await op(db, ana, 'habit', 'update', id, { status: 'paused' })).habit.status, 'paused');
  assert.equal((await op(db, ana, 'habit', 'create', uuid(), { title: 'x', recurrence_rule: 'FREQ=YEARLY' })).code, 'INVALID_DATA');
  await db.close();
});

test('encontrar horário: só horários, nunca títulos, e outras agendas só com autorização', async () => {
  const { db, ana, bruno, carla, cal } = await setupGroup();
  const from = '2026-11-09T00:00:00Z';
  const to = '2026-11-16T00:00:00Z';
  // Evento da Carla na agenda compartilhada.
  await db.rpc(carla, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { title: 'Dentista' }), null, 'app']);
  // Evento privado do Bruno na agenda pessoal dele.
  const { rows } = await db.as(bruno, `select id from public.list_my_calendars() where kind = 'personal'`);
  const brunoPersonal = rows[0].id;
  await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(brunoPersonal, { title: 'Terapia', starts_at: '2026-11-11T12:00:00Z', ends_at: '2026-11-11T13:00:00Z' }), null, 'app']);

  let busy = await db.as(ana, 'select * from public.list_busy_times($1, $2, $3, $4)', [cal, [bruno, carla], from, to]);
  assert.equal(busy.rows.length, 1);
  assert.equal(busy.rows[0].user_id, carla);
  assert.ok(!('title' in busy.rows[0]));
  // Bruno autoriza: os horários dele aparecem, sem título.
  await db.as(bruno, 'update public.user_preferences set share_availability = true where user_id = $1', [bruno]);
  busy = await db.as(ana, 'select * from public.list_busy_times($1, $2, $3, $4)', [cal, [bruno, carla], from, to]);
  assert.equal(busy.rows.length, 2);
  await expectError(db.as(ana, 'select * from public.list_busy_times($1, $2, $3, $4)', [cal, [bruno], from, '2027-06-01T00:00:00Z']), 'INVALID_RANGE');
  await db.close();
});

test('enquete de horário: votos, encerramento e evento só depois da confirmação', async () => {
  const { db, ana, bruno, carla, davi, fabio, cal } = await setupGroup();
  const options = [
    { starts_at: '2026-11-12T22:00:00Z', ends_at: '2026-11-12T23:00:00Z' },
    { starts_at: '2026-11-13T22:00:00Z', ends_at: '2026-11-13T23:00:00Z' },
  ];
  await expectError(db.rpc(davi, 'create_poll', [cal, 'x', null, 60, 'America/Sao_Paulo', null, [bruno], options]), 'FORBIDDEN');
  await expectError(db.rpc(ana, 'create_poll', [cal, 'x', null, 60, 'America/Sao_Paulo', null, [fabio], options]), 'INVALID_PARTICIPANT');
  const poll = await db.rpc(ana, 'create_poll', [cal, 'Reunião de família', null, 60, 'America/Sao_Paulo', null, [bruno, carla], options]);
  const before = await db.admin('select count(*)::int n from public.events');
  const list = await db.rpc(bruno, 'list_polls', [cal]);
  assert.equal(list.length, 1);
  assert.equal(list[0].options.length, 2);
  // Davi não participa: não vê nem vota.
  assert.equal((await db.rpc(davi, 'list_polls', [cal])).length, 0);
  await expectError(db.rpc(davi, 'vote_poll', [list[0].options[0].id, 'yes']), 'NOT_FOUND');
  await db.rpc(bruno, 'vote_poll', [list[0].options[1].id, 'yes']);
  await db.rpc(carla, 'vote_poll', [list[0].options[1].id, 'maybe']);
  await db.rpc(carla, 'vote_poll', [list[0].options[1].id, 'yes']);
  assert.equal((await db.admin('select count(*)::int n from public.events')).rows[0].n, before.rows[0].n, 'evento criado antes da confirmação');
  await expectError(db.rpc(bruno, 'close_poll', [poll, list[0].options[1].id, true]), 'FORBIDDEN');
  const closed = await db.rpc(ana, 'close_poll', [poll, list[0].options[1].id, true]);
  assert.ok(closed.event_id);
  const ev = await db.admin('select title, starts_at from public.events where id = $1', [closed.event_id]);
  assert.equal(ev.rows[0].title, 'Reunião de família');
  const att = await db.admin(`select count(*)::int n from public.event_attendees where event_id = $1 and response = 'accepted'`, [closed.event_id]);
  assert.equal(att.rows[0].n, 2);
  await expectError(db.rpc(bruno, 'vote_poll', [list[0].options[0].id, 'yes']), 'POLL_CLOSED');
  await db.close();
});

test('bloco de tempo: evento ligado a uma tarefa visível; tarefa continua se o bloco sai', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const task = uuid();
  await op(db, ana, 'task', 'create', task, { title: 'Estudar matemática', due_date: '2026-11-13', estimated_minutes: 120 });
  const { rows } = await db.as(ana, `select id from public.list_my_calendars() where kind = 'personal'`);
  const block = uuid();
  const r = await db.rpc(ana, 'apply_event_op', [uuid(), 'create', block,
    eventPayload(rows[0].id, { title: 'Estudar matemática', task_id: task, event_type: 'custom' }), null, 'app']);
  assert.equal(r.status, 'ok');
  assert.equal(r.event.task_id, task);
  const listed = await db.as(ana, 'select task_id from public.list_events(null, $1, $2)', ['2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z']);
  assert.equal(listed.rows[0].task_id, task);
  // Bruno não pode ligar um evento à tarefa pessoal da Ana.
  const stolen = await db.rpc(bruno, 'apply_event_op', [uuid(), 'create', uuid(), eventPayload(cal, { task_id: task }), null, 'app']);
  assert.equal(stolen.code, 'TASK_NOT_FOUND');
  await db.rpc(ana, 'apply_event_op', [uuid(), 'delete', block, {}, 1, 'app']);
  assert.equal((await items(db, ana)).tasks[0].id, task);
  await db.close();
});

test('compatibilidade com a 2.0: eventos antigos e chamadas antigas continuam funcionando', async () => {
  const { db, ana, cal } = await setupGroup();
  // Evento do tipo "task" criado como na versão 2.0 continua evento.
  const id = uuid();
  const r = await db.rpc(ana, 'apply_event_op', [uuid(), 'create', id, eventPayload(cal, { event_type: 'task' }), null, 'app']);
  assert.equal(r.status, 'ok');
  const u = await db.rpc(ana, 'apply_event_op', [uuid(), 'update', id, { status: 'completed' }, 1, 'app']);
  assert.equal(u.event.status, 'completed');
  const listed = await db.as(ana, 'select id, event_type, my_reminders from public.list_events($1, $2, $3)', [[cal], '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z']);
  assert.equal(listed.rows[0].event_type, 'task');
  assert.equal((await items(db, ana)).tasks.length, 0, 'evento antigo virou tarefa sem pedir');
  // Preferências antigas e novas convivem.
  const acc = await db.rpc(ana, 'get_my_account');
  assert.equal(acc.preferences.daily_checkin, true);
  assert.equal(acc.preferences.share_availability, false);
  assert.equal(acc.notification_preferences.notify_tasks, true);
  await db.close();
});

test('exportação inclui os itens novos e exclusão da conta apaga os pessoais', async () => {
  const { db, ana, bruno, cal } = await setupGroup();
  const personal = uuid();
  const shared = uuid();
  await op(db, bruno, 'task', 'create', personal, { title: 'Pessoal do Bruno' });
  await op(db, bruno, 'task', 'create', shared, { title: 'Compartilhada do Bruno', calendar_id: cal });
  await op(db, bruno, 'note', 'create', uuid(), { body: 'nota' });
  const data = await db.rpc(bruno, 'export_my_data');
  assert.equal(data.tasks_created.length, 2);
  assert.equal(data.notes.length, 1);
  await db.rpc(bruno, 'delete_my_account', ['EXCLUIR']);
  const left = await db.admin('select id from public.tasks');
  assert.deepEqual(left.rows.map((r) => r.id), [shared]);
  assert.equal((await items(db, ana)).tasks.length, 1);
  await db.close();
});

test('próxima data da série: mesmos casos do app (fixtures/proxima-data.json)', async () => {
  const { readFileSync } = await import('node:fs');
  const { TestDb } = await import('./helpers/db.mjs');
  const { casos } = JSON.parse(readFileSync(new URL('./fixtures/proxima-data.json', import.meta.url), 'utf8'));
  const db = await TestDb.create();
  for (const c of casos) {
    const { rows } = await db.admin('select private.rrule_next($1, $2::date, $3::date)::text as d', [c.regra, c.inicio, c.depois]);
    assert.equal(rows[0].d, c.esperado, `${c.regra} desde ${c.inicio} depois de ${c.depois}`);
  }
  await db.close();
});
