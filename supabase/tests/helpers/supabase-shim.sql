-- =====================================================================
-- Simulação mínima do ambiente Supabase para os testes com PGlite.
-- NÃO é aplicada no Supabase real (lá isso já existe).
-- =====================================================================
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text
);

create table auth.identities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- No Supabase, crypt/gen_salt vêm da extensão pgcrypto no esquema "extensions".
-- Aqui bastam versões simplificadas, só para o seed rodar nos testes.
create schema if not exists extensions;
create function extensions.gen_salt(text) returns text language sql as $$ select 'salt' $$;
create function extensions.crypt(text, text) returns text language sql as $$ select md5($1 || $2) $$;

-- Igual ao Supabase: o id do usuário vem do token (claim "sub").
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
