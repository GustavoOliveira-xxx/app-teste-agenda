-- =====================================================================
-- Migration 3: eventos, exceções de recorrência, participantes,
-- lembretes, comentários e registro de operações de sincronização
-- =====================================================================

-- ---------------------------------------------------------------------
-- Eventos
--
-- Datas (veja ARQUITETURA.md, seção "Datas e fusos horários"):
--   * starts_at / ends_at: instantes absolutos (UTC). Sempre preenchidos,
--     inclusive em eventos de dia inteiro, para permitir buscas por período.
--   * timezone: fuso IANA em que o evento foi pensado (usado na recorrência).
--   * start_date / end_date: datas locais, só para eventos de dia inteiro
--     (evita o evento "pular" para o dia anterior em outro fuso).
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 5000),
  location text check (location is null or char_length(location) <= 200),
  address text check (address is null or char_length(address) <= 300),
  url text check (url is null or (char_length(url) <= 2048 and url ~* '^https?://[^\s]+$')),
  all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  start_date date,
  end_date date,
  timezone text not null default 'America/Sao_Paulo',
  -- Subconjunto da RRULE (RFC 5545). Ex.: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231
  recurrence_rule text check (recurrence_rule is null or (char_length(recurrence_rule) <= 200 and recurrence_rule ~
    '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;(INTERVAL=[1-9][0-9]?|BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*|BYMONTHDAY=([1-9]|[12][0-9]|3[01])|UNTIL=[0-9]{8}|COUNT=[1-9][0-9]{0,2}))*$')),
  created_by uuid references public.profiles (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  event_type text not null default 'appointment' check (event_type in
    ('appointment', 'meeting', 'task', 'reminder', 'birthday', 'travel', 'holiday', 'social', 'work', 'custom')),
  status text not null default 'planned' check (status in
    ('planned', 'confirmed', 'completed', 'cancelled', 'postponed', 'archived')),
  privacy text not null default 'members' check (privacy in ('members', 'participants', 'private', 'busy')),
  version integer not null default 1,
  change_origin text not null default 'app' check (change_origin in ('app', 'offline_sync', 'system')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '366 days'),
  check ((all_day and start_date is not null and end_date is not null and end_date >= start_date)
      or (not all_day and start_date is null and end_date is null))
);
create index if not exists events_calendar_range_idx
  on public.events (calendar_id, starts_at, ends_at) where deleted_at is null;
create index if not exists events_calendar_recurring_idx
  on public.events (calendar_id) where deleted_at is null and recurrence_rule is not null;
create index if not exists events_created_by_idx on public.events (created_by);

-- ---------------------------------------------------------------------
-- Participantes de um evento (usado na privacidade "só participantes")
-- ---------------------------------------------------------------------
create table if not exists public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined', 'tentative')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_attendees_user_idx on public.event_attendees (user_id);

-- ---------------------------------------------------------------------
-- Funções de acesso a eventos
-- ---------------------------------------------------------------------

-- Nível de acesso a um evento, dado o papel do usuário na agenda:
--   'full'   = vê tudo
--   'masked' = vê só que existe um compromisso naquele horário ("Ocupado")
--   null     = não vê
create or replace function private.event_access_for(
  p_role text, p_uid uuid, p_event_id uuid, p_created_by uuid, p_privacy text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_role is null or p_uid is null then
    return null;
  end if;
  if p_created_by = p_uid then
    return 'full';
  end if;
  if p_privacy = 'members' then
    return 'full';
  elsif p_privacy = 'participants' then
    if p_role in ('owner', 'admin') or exists (
      select 1 from public.event_attendees a where a.event_id = p_event_id and a.user_id = p_uid
    ) then
      return 'full';
    end if;
    return null;
  elsif p_privacy = 'busy' then
    if p_role in ('owner', 'admin') then
      return 'full';
    end if;
    return 'masked';
  end if;
  -- 'private': só quem criou
  return null;
end;
$$;

create or replace function private.event_access(
  p_calendar_id uuid, p_event_id uuid, p_created_by uuid, p_privacy text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_access_for(private.calendar_role(p_calendar_id), auth.uid(), p_event_id, p_created_by, p_privacy);
$$;

-- Pode editar? Proprietário e administrador: sim. Editor: sim, se a agenda
-- permitir editar eventos de outras pessoas (ou se for dele). Colaborador:
-- só os próprios. Visualizador: não. Agenda arquivada: ninguém.
create or replace function private.can_edit_event(p_calendar_id uuid, p_created_by uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.calendar_role(p_calendar_id);
  v_editors_all boolean;
begin
  if v_role is null or not private.calendar_is_writable(p_calendar_id) then
    return false;
  end if;
  if v_role in ('owner', 'admin') then
    return true;
  end if;
  if v_role = 'editor' then
    select c.editors_can_edit_all into v_editors_all from public.calendars c where c.id = p_calendar_id;
    return coalesce(v_editors_all, false) or p_created_by = auth.uid();
  end if;
  if v_role = 'collaborator' then
    return p_created_by = auth.uid();
  end if;
  return false;
end;
$$;

-- Versão por id (usada pelas tabelas filhas de eventos).
create or replace function private.event_access_by_id(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_access(e.calendar_id, e.id, e.created_by, e.privacy)
  from public.events e
  where e.id = p_event_id and e.deleted_at is null;
$$;

create or replace function private.can_edit_event_by_id(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.event_access(e.calendar_id, e.id, e.created_by, e.privacy) = 'full'
       and private.can_edit_event(e.calendar_id, e.created_by)
    from public.events e
    where e.id = p_event_id and e.deleted_at is null
  ), false);
$$;

-- ---------------------------------------------------------------------
-- Validação e normalização de eventos (inserção e alteração)
-- ---------------------------------------------------------------------
create or replace function private.events_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cal record;
  v_rule text;
begin
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.location := nullif(btrim(new.location), '');
  new.address := nullif(btrim(new.address), '');
  new.url := nullif(btrim(new.url), '');

  if not private.is_valid_timezone(new.timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;

  -- Dia inteiro: o servidor calcula os instantes a partir das datas locais.
  if new.all_day then
    if new.start_date is null or new.end_date is null then
      raise exception 'ALL_DAY_REQUIRES_DATES' using errcode = 'P0001';
    end if;
    new.starts_at := (new.start_date::timestamp) at time zone new.timezone;
    new.ends_at := ((new.end_date + 1)::timestamp) at time zone new.timezone;
  else
    new.start_date := null;
    new.end_date := null;
  end if;

  if new.ends_at <= new.starts_at then
    raise exception 'END_BEFORE_START' using errcode = 'P0001';
  end if;

  -- Recorrência: UNTIL e COUNT não podem aparecer juntos.
  v_rule := new.recurrence_rule;
  if v_rule is not null and v_rule like '%UNTIL=%' and v_rule like '%COUNT=%' then
    raise exception 'INVALID_RECURRENCE' using errcode = 'P0001';
  end if;

  select c.allow_private_events, c.conflict_policy, c.status, c.deleted_at
    into v_cal
    from public.calendars c where c.id = new.calendar_id;

  if new.privacy = 'private'
     and (tg_op = 'INSERT' or old.privacy is distinct from 'private')
     and not coalesce(v_cal.allow_private_events, false) then
    raise exception 'PRIVATE_EVENTS_DISABLED' using errcode = 'P0001';
  end if;

  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;

  -- Política de conflito "bloquear": recusa sobreposição com outro evento
  -- único ativo da mesma agenda. Séries recorrentes são avisadas no app.
  if v_cal.conflict_policy = 'block'
     and new.deleted_at is null
     and new.status not in ('cancelled', 'archived')
     and new.recurrence_rule is null
     and (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
          or new.ends_at is distinct from old.ends_at or old.deleted_at is not null) then
    if exists (
      select 1 from public.events o
      where o.calendar_id = new.calendar_id
        and o.id <> new.id
        and o.deleted_at is null
        and o.recurrence_rule is null
        and o.status not in ('cancelled', 'archived')
        and o.starts_at < new.ends_at
        and o.ends_at > new.starts_at
    ) then
      raise exception 'EVENT_TIME_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.events_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  new.version := 1;
  new.deleted_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.events_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.calendar_id is distinct from old.calendar_id then
    raise exception 'CANNOT_MOVE_EVENT' using errcode = 'P0001';
  end if;
  -- id, criador e data de criação não podem ser alterados pelo app
  -- (as permissões de coluna não incluem esses campos).
  new.version := old.version + 1;
  new.updated_at := now();
  -- Em ações em cascata (ex.: exclusão de conta) o perfil de quem chama
  -- já não existe; nesse caso não registramos autor da alteração.
  if auth.uid() is not null and exists (select 1 from public.profiles p where p.id = auth.uid()) then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger events_before_insert
  before insert on public.events
  for each row execute function private.events_before_insert();
create trigger events_before_update
  before update on public.events
  for each row execute function private.events_before_update();
-- Nome com prefixo "events_v" para rodar depois dos dois acima (ordem alfabética).
create trigger events_validate
  before insert or update on public.events
  for each row execute function private.events_before_write();

-- ---------------------------------------------------------------------
-- Exceções de recorrência ("só esta ocorrência")
-- A chave é a data local da ocorrência original (no fuso do evento).
-- ---------------------------------------------------------------------
create table if not exists public.recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  original_date date not null,
  is_cancelled boolean not null default false,
  title text check (title is null or char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 5000),
  location text check (location is null or char_length(location) <= 200),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, original_date),
  check ((starts_at is null) = (ends_at is null)),
  check (starts_at is null or ends_at > starts_at)
);

create or replace function private.recurrence_exceptions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  if not exists (select 1 from public.events e where e.id = new.event_id and e.recurrence_rule is not null) then
    raise exception 'EVENT_NOT_RECURRING' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger recurrence_exceptions_before_write
  before insert or update on public.recurrence_exceptions
  for each row execute function private.recurrence_exceptions_before_write();

-- ---------------------------------------------------------------------
-- Lembretes (pessoais: cada pessoa define os seus)
-- ---------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  minutes_before integer not null check (minutes_before between 0 and 40320),
  created_at timestamptz not null default now(),
  unique (event_id, user_id, minutes_before)
);
create index if not exists reminders_user_idx on public.reminders (user_id);

-- ---------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) <= 2000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deleted_at is not null or char_length(btrim(body)) >= 1)
);
create index if not exists comments_event_idx on public.comments (event_id, created_at);

create or replace function private.comments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Remove caracteres de controle (exceto quebra de linha e tab).
  new.body := regexp_replace(new.body, '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.author_id := auth.uid();
    end if;
    new.edited_at := null;
    new.deleted_at := null;
  else
    if private.is_client_call() and (
         new.event_id is distinct from old.event_id
      or new.author_id is distinct from old.author_id
      or new.deleted_at is distinct from old.deleted_at
      or new.created_at is distinct from old.created_at) then
      raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
    end if;
    if new.body is distinct from old.body then
      new.edited_at := now();
    end if;
  end if;
  new.body := btrim(new.body);
  new.updated_at := now();
  return new;
end;
$$;

create trigger comments_before_write
  before insert or update on public.comments
  for each row execute function private.comments_before_write();

-- ---------------------------------------------------------------------
-- Operações de sincronização já processadas (idempotência / anti-replay).
-- Se o app reenviar a mesma operação (mesmo id), recebe o mesmo resultado
-- e nada é duplicado (regra 17).
-- ---------------------------------------------------------------------
create table if not exists public.sync_operations (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  entity_id uuid,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists sync_operations_user_idx on public.sync_operations (user_id, created_at desc);
