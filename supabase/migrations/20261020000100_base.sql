-- =====================================================================
-- Migration 1: base
-- Esquemas, funções auxiliares, perfis, preferências e dispositivos.
--
-- Convenções usadas em todas as migrations:
--   * Tabelas de dados ficam no esquema "public" (exposto pela API do Supabase).
--   * Funções auxiliares de segurança ficam no esquema "private", que NÃO é
--     exposto pela API. Elas são usadas dentro das regras de acesso (RLS).
--   * Funções SECURITY DEFINER sempre usam "set search_path = ''" e nomes
--     completos (esquema.tabela) para evitar sequestro de search_path.
--   * Enumerações são texto com CHECK, mais fáceis de evoluir que ENUM.
-- =====================================================================

create schema if not exists private;
-- Necessário para que as regras de acesso (executadas como o usuário logado)
-- consigam chamar as funções auxiliares. O esquema continua fora da API.
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Funções auxiliares genéricas
-- ---------------------------------------------------------------------

-- Hierarquia de papéis: quanto maior, mais poder.
create or replace function private.role_rank(p_role text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then 50
    when 'admin' then 40
    when 'editor' then 30
    when 'collaborator' then 20
    when 'viewer' then 10
    else 0
  end;
$$;

-- Nome do papel em português (usado em textos de avisos).
create or replace function private.role_label(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then 'Proprietário'
    when 'admin' then 'Administrador'
    when 'editor' then 'Editor'
    when 'collaborator' then 'Colaborador'
    when 'viewer' then 'Visualizador'
    else p_role
  end;
$$;

-- Confere se um fuso horário existe no padrão IANA (ex.: America/Sao_Paulo).
create or replace function private.is_valid_timezone(p_tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_tz is not null
     and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz);
$$;

-- Atualiza a coluna updated_at automaticamente.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Indica se a chamada veio direto do cliente (API) e não de uma função
-- SECURITY DEFINER do próprio banco. Dentro de funções SECURITY DEFINER,
-- current_user é o dono da função (postgres), e não "authenticated".
create or replace function private.is_client_call()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------------
-- Limite de requisições (rate limiting) para operações sensíveis
-- ---------------------------------------------------------------------
create table if not exists private.rate_limit_hits (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx
  on private.rate_limit_hits (user_id, action, created_at desc);

-- Retorna true se o usuário já atingiu o limite de "p_max" registros da ação
-- dentro da janela de tempo.
create or replace function private.rate_limited(p_action text, p_max integer, p_window interval)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= p_max
  from private.rate_limit_hits
  where user_id = auth.uid()
    and action = p_action
    and created_at > now() - p_window;
$$;

create or replace function private.record_rate_hit(p_action text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.rate_limit_hits (user_id, action) values (auth.uid(), p_action);
$$;

-- ---------------------------------------------------------------------
-- Perfis (dados mínimos visíveis para quem divide agenda com a pessoa)
-- O e-mail NÃO fica aqui: fica apenas em auth.users (privacidade).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 80),
  avatar_color text not null default '#4F7DF3'
    check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'pending_deletion')),
  last_seen_at timestamptz,
  deletion_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Preferências pessoais (privadas: só a própria pessoa vê)
-- ---------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  locale text not null default 'pt-BR' check (locale in ('pt-BR')),
  timezone text not null default 'America/Sao_Paulo',
  use_device_timezone boolean not null default true,
  date_format text not null default 'dd/MM/yyyy'
    check (date_format in ('dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy')),
  time_format text not null default '24h' check (time_format in ('24h', '12h')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  week_starts_on smallint not null default 0 check (week_starts_on in (0, 1)),
  updated_at timestamptz not null default now()
);

create or replace function private.validate_user_preferences()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_valid_timezone(new.timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_preferences_validate
  before insert or update on public.user_preferences
  for each row execute function private.validate_user_preferences();

-- ---------------------------------------------------------------------
-- Preferências de notificação (privadas)
-- ---------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  show_details_on_lock_screen boolean not null default false,
  default_reminder_minutes integer
    check (default_reminder_minutes is null or default_reminder_minutes between 0 and 40320),
  notify_invites boolean not null default true,
  notify_event_changes boolean not null default true,
  notify_member_changes boolean not null default true,
  notify_comments boolean not null default true,
  notify_reminders boolean not null default true,
  sound boolean not null default true,
  vibration boolean not null default true,
  updated_at timestamptz not null default now(),
  check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Dispositivos conectados (para listar aparelhos e, no futuro, push)
-- ---------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  installation_id text not null check (char_length(installation_id) between 8 and 100),
  platform text not null check (platform in ('android', 'ios', 'web')),
  device_name text check (device_name is null or char_length(device_name) <= 100),
  os_version text check (os_version is null or char_length(os_version) <= 50),
  app_version text check (app_version is null or char_length(app_version) <= 50),
  push_token text check (push_token is null or char_length(push_token) <= 500),
  push_token_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, installation_id)
);
create index if not exists devices_user_idx on public.devices (user_id);

-- ---------------------------------------------------------------------
-- Cores de avatar: escolhida de forma estável a partir do id do usuário.
-- ---------------------------------------------------------------------
create or replace function private.avatar_color_for(p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['#4F7DF3', '#E5484D', '#30A46C', '#F76B15', '#8E4EC6',
                '#0090FF', '#D6409F', '#12A594', '#AD7F58', '#5B5BD6'])
         [1 + (get_byte(uuid_send(p_id), 15) % 10)];
$$;
