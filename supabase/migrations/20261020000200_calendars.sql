-- =====================================================================
-- Migration 2: agendas, membros e convites
-- =====================================================================

-- ---------------------------------------------------------------------
-- Agendas
-- ---------------------------------------------------------------------
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  color text not null default '#3358D4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text check (icon is null or char_length(icon) <= 40),
  kind text not null default 'shared'
    check (kind in ('personal', 'shared', 'family', 'work', 'project', 'travel', 'custom')),
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Toda agenda é privada (acesso só por convite). Link público é futuro.
  visibility text not null default 'private' check (visibility in ('private')),
  default_timezone text not null default 'America/Sao_Paulo',
  -- Configurações de convite
  default_member_role text not null default 'editor'
    check (default_member_role in ('admin', 'editor', 'collaborator', 'viewer')),
  admins_can_invite boolean not null default true,
  members_can_invite boolean not null default false,
  -- Configurações de eventos
  editors_can_edit_all boolean not null default true,
  allow_private_events boolean not null default true,
  conflict_policy text not null default 'warn' check (conflict_policy in ('warn', 'block', 'ignore')),
  -- Configurações de notificação
  notify_members_on_changes boolean not null default true,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendars_owner_idx on public.calendars (owner_id);

-- ---------------------------------------------------------------------
-- Membros (relação usuário x agenda)
-- ---------------------------------------------------------------------
create table if not exists public.calendar_members (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'collaborator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'removed', 'left')),
  joined_at timestamptz not null default now(),
  last_activity_at timestamptz,
  granted_by uuid references public.profiles (id) on delete set null,
  invitation_id uuid,
  notifications_enabled boolean not null default true,
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  unique (calendar_id, user_id)
);
create index if not exists calendar_members_user_idx
  on public.calendar_members (user_id) where status = 'active';
-- Uma agenda ativa tem exatamente um proprietário ativo (regra 26).
create unique index if not exists calendar_members_one_owner_idx
  on public.calendar_members (calendar_id) where role = 'owner' and status = 'active';

-- ---------------------------------------------------------------------
-- Convites
-- O código em texto puro NUNCA é gravado: apenas o hash SHA-256 (regra 35).
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  invited_email text check (invited_email is null or (invited_email = lower(invited_email)
    and invited_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(invited_email) <= 254)),
  role text not null check (role in ('admin', 'editor', 'collaborator', 'viewer')),
  code_hash bytea not null unique,
  code_hint text not null check (char_length(code_hint) = 4),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses between 1 and 100),
  use_count integer not null default 0 check (use_count >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired', 'exhausted')),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null
);
create index if not exists invitations_calendar_idx on public.invitations (calendar_id, status);
create index if not exists invitations_email_idx on public.invitations (invited_email) where status = 'pending';
-- Evita convites pendentes duplicados para o mesmo e-mail na mesma agenda.
create unique index if not exists invitations_pending_email_unique_idx
  on public.invitations (calendar_id, invited_email)
  where status = 'pending' and invited_email is not null;

alter table public.calendar_members
  add constraint calendar_members_invitation_fk
  foreign key (invitation_id) references public.invitations (id) on delete set null;

-- ---------------------------------------------------------------------
-- Funções auxiliares de pertencimento (usadas pelas regras de acesso)
-- ---------------------------------------------------------------------

-- Papel do usuário logado na agenda, considerando só membros ativos e agendas
-- fora da lixeira. Retorna null se não tiver acesso.
create or replace function private.calendar_role(p_calendar_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.calendar_members m
  join public.calendars c on c.id = m.calendar_id
  where m.calendar_id = p_calendar_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and c.deleted_at is null;
$$;

-- A agenda aceita alterações de conteúdo? (não arquivada e fora da lixeira)
create or replace function private.calendar_is_writable(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendars c
    where c.id = p_calendar_id and c.status = 'active' and c.deleted_at is null
  );
$$;

-- O usuário logado divide alguma agenda ativa com p_user_id?
create or replace function private.shares_calendar_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_members mine
    join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
    join public.calendars c on c.id = mine.calendar_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = p_user_id
      and c.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------
-- Gatilhos de agendas
-- ---------------------------------------------------------------------

create or replace function private.calendars_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Quem cria é sempre o proprietário (o cliente não escolhe outro dono).
  if auth.uid() is not null then
    new.owner_id := auth.uid();
  end if;
  new.name := btrim(new.name);
  new.status := 'active';
  new.archived_at := null;
  new.deleted_at := null;
  if not private.is_valid_timezone(new.default_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger calendars_before_insert
  before insert on public.calendars
  for each row execute function private.calendars_before_insert();

-- Cria automaticamente a participação do proprietário.
create or replace function private.calendars_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.calendar_members (calendar_id, user_id, role, status, granted_by)
  values (new.id, new.owner_id, 'owner', 'active', new.owner_id);
  return new;
end;
$$;

create trigger calendars_after_insert
  after insert on public.calendars
  for each row execute function private.calendars_after_insert();

-- Protege colunas críticas contra alteração direta pelo cliente.
-- Dono, status, arquivamento e lixeira só mudam pelas funções do servidor.
-- Administradores só alteram configurações não críticas.
create or replace function private.calendars_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  new.updated_at := now();
  new.name := btrim(new.name);

  if new.default_timezone is distinct from old.default_timezone
     and not private.is_valid_timezone(new.default_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;

  if private.is_client_call() then
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.status is distinct from old.status
       or new.archived_at is distinct from old.archived_at
       or new.deleted_at is distinct from old.deleted_at
       or new.visibility is distinct from old.visibility
       or new.created_at is distinct from old.created_at then
      raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
    end if;

    v_role := private.calendar_role(old.id);
    if v_role is distinct from 'owner' and (
         new.default_member_role is distinct from old.default_member_role
      or new.admins_can_invite is distinct from old.admins_can_invite
      or new.members_can_invite is distinct from old.members_can_invite
      or new.editors_can_edit_all is distinct from old.editors_can_edit_all
      or new.allow_private_events is distinct from old.allow_private_events) then
      raise exception 'ONLY_OWNER_CAN_CHANGE_SETTING' using errcode = 'P0001';
    end if;

    if old.status <> 'active' or old.deleted_at is not null then
      raise exception 'CALENDAR_NOT_WRITABLE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger calendars_before_update
  before update on public.calendars
  for each row execute function private.calendars_before_update();

-- ---------------------------------------------------------------------
-- Gatilhos de membros
-- ---------------------------------------------------------------------

-- O cliente só pode alterar as próprias preferências de notificação da agenda.
-- Papel, status e demais campos mudam apenas por funções do servidor.
create or replace function private.calendar_members_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_call() then
    if new.id is distinct from old.id
       or new.calendar_id is distinct from old.calendar_id
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.joined_at is distinct from old.joined_at
       or new.granted_by is distinct from old.granted_by
       or new.invitation_id is distinct from old.invitation_id
       or new.removed_at is distinct from old.removed_at
       or new.removed_by is distinct from old.removed_by then
      raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger calendar_members_before_update
  before update on public.calendar_members
  for each row execute function private.calendar_members_before_update();

-- ---------------------------------------------------------------------
-- Novo usuário: cria perfil, preferências e a agenda pessoal
-- (executado quando o Supabase Auth cria a conta em auth.users)
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_tz text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'Pessoa'), '@', 1);
  end if;
  v_name := left(v_name, 80);

  v_tz := new.raw_user_meta_data ->> 'timezone';
  if not private.is_valid_timezone(v_tz) then
    v_tz := 'America/Sao_Paulo';
  end if;

  insert into public.profiles (id, display_name, avatar_color)
  values (new.id, v_name, private.avatar_color_for(new.id));

  insert into public.user_preferences (user_id, timezone) values (new.id, v_tz);
  insert into public.notification_preferences (user_id) values (new.id);

  insert into public.calendars (owner_id, name, kind, color, default_timezone, default_member_role)
  values (new.id, 'Minha agenda', 'personal', '#3358D4', v_tz, 'viewer');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
