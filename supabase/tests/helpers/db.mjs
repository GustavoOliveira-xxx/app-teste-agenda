// Banco de testes: PostgreSQL real (PGlite) com as migrations do projeto
// aplicadas e um "login" simulado por usuário.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'migrations');
const shim = readFileSync(join(here, 'supabase-shim.sql'), 'utf8');

export class TestDb {
  constructor(pg) {
    this.pg = pg;
  }

  static async create() {
    const pg = new PGlite();
    await pg.exec(shim);
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      try {
        await pg.exec(readFileSync(join(migrationsDir, file), 'utf8'));
      } catch (error) {
        throw new Error(`Falha na migration ${file}: ${error.message}`);
      }
    }
    return new TestDb(pg);
  }

  // Cria uma conta como o Supabase Auth faria (dispara o gatilho de cadastro).
  async createUser(email, displayName, { confirmed = true, timezone } = {}) {
    const meta = { display_name: displayName };
    if (timezone) meta.timezone = timezone;
    const { rows } = await this.pg.query(
      `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
       values ($1, ${confirmed ? 'now()' : 'null'}, $2) returning id`,
      [email, JSON.stringify(meta)],
    );
    return rows[0].id;
  }

  // Executa SQL como um usuário logado (papel "authenticated" + claim sub).
  async as(userId, sql, params = []) {
    await this.pg.exec(`set request.jwt.claim.sub = '${userId ?? ''}'`);
    await this.pg.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
    try {
      return await this.pg.query(sql, params);
    } finally {
      await this.pg.exec('reset role');
      await this.pg.exec('reset request.jwt.claim.sub');
    }
  }

  // Atalho para funções RPC que retornam um único valor.
  async rpc(userId, fn, args = []) {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await this.as(userId, `select public.${fn}(${placeholders}) as r`, args);
    return rows[0].r;
  }

  // Executa como administrador do banco (sem RLS), para preparar cenários.
  async admin(sql, params = []) {
    return this.pg.query(sql, params);
  }

  async close() {
    await this.pg.close();
  }
}

// Espera que a promessa falhe com uma mensagem que contenha "expected".
export async function expectError(promise, expected) {
  try {
    await promise;
  } catch (error) {
    if (expected && !String(error.message).includes(expected)) {
      throw new Error(`Erro inesperado: "${error.message}" (esperado conter "${expected}")`);
    }
    return error;
  }
  throw new Error(`Era esperado um erro contendo "${expected}", mas a operação funcionou.`);
}

let counter = 0;
export function uuid() {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

// Monta o payload de um evento simples com horário.
export function eventPayload(calendarId, overrides = {}) {
  return {
    calendar_id: calendarId,
    title: 'Jantar',
    starts_at: '2026-11-10T22:00:00Z',
    ends_at: '2026-11-10T23:30:00Z',
    timezone: 'America/Sao_Paulo',
    ...overrides,
  };
}
