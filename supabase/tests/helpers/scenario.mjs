// Cenários reutilizáveis: pessoas fictícias e uma agenda compartilhada.
import { TestDb } from './db.mjs';

export async function createCalendar(db, ownerId, name = 'Casa', extra = {}) {
  const cols = ['name', ...Object.keys(extra)];
  const vals = [name, ...Object.values(extra)];
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await db.as(
    ownerId,
    `insert into public.calendars (${cols.join(', ')}) values (${placeholders}) returning id`,
    vals,
  );
  return rows[0].id;
}

export async function invite(db, fromId, calendarId, role, opts = {}) {
  return db.rpc(fromId, 'create_invitation', [
    calendarId,
    role,
    opts.email ?? null,
    opts.expiresInHours === undefined ? 168 : opts.expiresInHours,
    opts.maxUses === undefined ? 1 : opts.maxUses,
  ]);
}

// Convida e aceita, devolvendo o código usado.
export async function addMember(db, ownerId, calendarId, userId, role) {
  const inv = await invite(db, ownerId, calendarId, role);
  const res = await db.rpc(userId, 'accept_invitation', [inv.code]);
  if (!res.ok) throw new Error(`Aceite falhou: ${res.error}`);
  return inv;
}

export async function memberId(db, calendarId, userId) {
  const { rows } = await db.admin(
    'select id from public.calendar_members where calendar_id = $1 and user_id = $2',
    [calendarId, userId],
  );
  return rows[0]?.id;
}

// Ana (proprietária), Bruno (editor), Carla (colaboradora), Davi (visualizador),
// Eva (administradora) e Fabio (sem acesso).
export async function setupGroup() {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const bruno = await db.createUser('bruno@exemplo.test', 'Bruno');
  const carla = await db.createUser('carla@exemplo.test', 'Carla');
  const davi = await db.createUser('davi@exemplo.test', 'Davi');
  const eva = await db.createUser('eva@exemplo.test', 'Eva');
  const fabio = await db.createUser('fabio@exemplo.test', 'Fabio');
  const cal = await createCalendar(db, ana, 'Casa');
  await addMember(db, ana, cal, bruno, 'editor');
  await addMember(db, ana, cal, carla, 'collaborator');
  await addMember(db, ana, cal, davi, 'viewer');
  await addMember(db, ana, cal, eva, 'admin');
  return { db, ana, bruno, carla, davi, eva, fabio, cal };
}
