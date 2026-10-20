-- =====================================================================
-- Migration 4: histórico de atividades, central de avisos e auditoria
-- =====================================================================

-- ---------------------------------------------------------------------
-- Histórico de atividades (visível aos membros, respeitando permissões)
--   visibility = 'members' : todos os membros ativos veem
--   visibility = 'admins'  : só proprietário, administradores e o autor
-- Eventos que não são visíveis a todos registram histórico SEM título.
-- ---------------------------------------------------------------------
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'calendar_created', 'calendar_updated', 'calendar_archived', 'calendar_unarchived',
    'calendar_trashed', 'calendar_restored', 'ownership_transferred',
    'member_joined', 'member_left', 'member_removed', 'role_changed',
    'invite_created', 'invite_cancelled', 'invite_accepted', 'invite_declined',
    'event_created', 'event_updated', 'event_cancelled', 'event_completed',
    'event_deleted', 'event_restored', 'comment_added')),
  details jsonb not null default '{}'::jsonb,
  visibility text not null default 'members' check (visibility in ('members', 'admins')),
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_calendar_idx on public.activity_logs (calendar_id, created_at desc);
create index if not exists activity_logs_event_idx on public.activity_logs (event_id, created_at desc);

-- ---------------------------------------------------------------------
-- Central de avisos (notificações dentro do app)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'invite_received', 'invite_accepted', 'invite_declined',
    'event_created', 'event_updated', 'event_cancelled', 'event_deleted',
    'member_added', 'member_removed', 'role_changed', 'ownership_received',
    'comment_added')),
  calendar_id uuid references public.calendars (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) <= 200),
  body text check (body is null or char_length(body) <= 500),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Auditoria (interna: nenhuma regra de leitura para usuários; só o painel
-- do Supabase / service_role consegue ler). Regra 24.
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function private.audit(p_action text, p_target_type text, p_target_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function private.log_activity(
  p_calendar_id uuid, p_event_id uuid, p_actor_id uuid, p_action text,
  p_details jsonb default '{}'::jsonb, p_visibility text default 'members')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (calendar_id, event_id, actor_id, action, details, visibility)
  values (p_calendar_id, p_event_id, p_actor_id, p_action, coalesce(p_details, '{}'::jsonb), p_visibility);
$$;

create or replace function private.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.display_name from public.profiles p where p.id = p_user_id), 'Alguém');
$$;

-- Cria um aviso para uma pessoa, respeitando as preferências dela.
create or replace function private.notify(
  p_user_id uuid, p_type text, p_calendar_id uuid, p_event_id uuid, p_actor_id uuid,
  p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefs public.notification_preferences;
  v_wants boolean;
begin
  if p_user_id is null or p_user_id = p_actor_id then
    return;
  end if;
  select * into v_prefs from public.notification_preferences where user_id = p_user_id;
  if v_prefs.user_id is not null then
    v_wants := v_prefs.enabled and case
      when p_type in ('invite_received', 'invite_accepted', 'invite_declined') then v_prefs.notify_invites
      when p_type in ('event_created', 'event_updated', 'event_cancelled', 'event_deleted') then v_prefs.notify_event_changes
      when p_type in ('member_added', 'member_removed', 'role_changed', 'ownership_received') then v_prefs.notify_member_changes
      when p_type = 'comment_added' then v_prefs.notify_comments
      else true end;
    -- Avisos sobre o próprio acesso (removido, papel alterado) sempre chegam.
    if not v_wants and p_type not in ('member_removed', 'role_changed', 'ownership_received') then
      return;
    end if;
  end if;
  insert into public.notifications (user_id, type, calendar_id, event_id, actor_id, title, body, data)
  values (p_user_id, p_type, p_calendar_id, p_event_id, p_actor_id, left(p_title, 200), left(p_body, 500),
          coalesce(p_data, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Gatilho: alterações em eventos geram histórico e avisos
-- ---------------------------------------------------------------------
create or replace function private.events_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_changed text[] := '{}';
  v_actor uuid := coalesce(auth.uid(), new.updated_by, new.created_by);
  v_cal public.calendars;
  v_public boolean := new.privacy = 'members';
  v_title text;
  v_notif_type text;
  r record;
begin
  -- Ações em cascata da exclusão de uma conta não geram histórico.
  if v_actor is not null and not exists (select 1 from public.profiles p where p.id = v_actor) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'event_created';
  elsif old.deleted_at is null and new.deleted_at is not null then
    v_action := 'event_deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'event_restored';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_action := 'event_cancelled';
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    v_action := 'event_completed';
  else
    if new.title is distinct from old.title then v_changed := array_append(v_changed, 'title'); end if;
    if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
       or new.all_day is distinct from old.all_day or new.timezone is distinct from old.timezone then
      v_changed := array_append(v_changed, 'time');
    end if;
    if new.location is distinct from old.location or new.address is distinct from old.address then
      v_changed := array_append(v_changed, 'location');
    end if;
    if new.description is distinct from old.description then v_changed := array_append(v_changed, 'description'); end if;
    if new.recurrence_rule is distinct from old.recurrence_rule then v_changed := array_append(v_changed, 'recurrence'); end if;
    if new.privacy is distinct from old.privacy then v_changed := array_append(v_changed, 'privacy'); end if;
    if new.status is distinct from old.status then v_changed := array_append(v_changed, 'status'); end if;
    if new.assignee_id is distinct from old.assignee_id then v_changed := array_append(v_changed, 'assignee'); end if;
    if new.url is distinct from old.url or new.color is distinct from old.color
       or new.event_type is distinct from old.event_type then
      v_changed := array_append(v_changed, 'other');
    end if;
    if cardinality(v_changed) = 0 then
      return new;
    end if;
    v_action := 'event_updated';
  end if;

  perform private.log_activity(
    new.calendar_id, new.id, v_actor, v_action,
    jsonb_build_object(
      'title', case when v_public then new.title else null end,
      'changed', to_jsonb(v_changed),
      'starts_at', case when v_public then new.starts_at else null end),
    case when v_public then 'members' else 'admins' end);

  update public.calendar_members
     set last_activity_at = now()
   where calendar_id = new.calendar_id and user_id = v_actor and status = 'active';

  select * into v_cal from public.calendars where id = new.calendar_id;
  if not v_cal.notify_members_on_changes or new.privacy in ('private', 'busy') then
    return new;
  end if;

  v_notif_type := case v_action
    when 'event_created' then 'event_created'
    when 'event_cancelled' then 'event_cancelled'
    when 'event_deleted' then 'event_deleted'
    when 'event_updated' then 'event_updated'
    else null end;
  -- Só avisa alterações relevantes (horário, local, título, status, recorrência).
  if v_notif_type is null
     or (v_action = 'event_updated' and not (v_changed && array['time', 'location', 'title', 'status', 'recurrence'])) then
    return new;
  end if;

  v_title := case v_notif_type
    when 'event_created' then 'Novo evento em ' || v_cal.name
    when 'event_updated' then 'Evento alterado em ' || v_cal.name
    when 'event_cancelled' then 'Evento cancelado em ' || v_cal.name
    when 'event_deleted' then 'Evento excluído em ' || v_cal.name
  end;

  for r in
    select m.user_id, m.role
    from public.calendar_members m
    where m.calendar_id = new.calendar_id
      and m.status = 'active'
      and m.notifications_enabled
      and m.user_id is distinct from v_actor
  loop
    if private.event_access_for(r.role, r.user_id, new.id, new.created_by, new.privacy) = 'full' then
      perform private.notify(r.user_id, v_notif_type, new.calendar_id, new.id, v_actor, v_title,
        private.display_name(v_actor) || ': ' || new.title,
        jsonb_build_object('changed', to_jsonb(v_changed)));
    end if;
  end loop;

  return new;
end;
$$;

create trigger events_after_write
  after insert or update on public.events
  for each row execute function private.events_after_write();

-- ---------------------------------------------------------------------
-- Gatilho: entrada, saída, remoção e mudança de papel de membros
-- ---------------------------------------------------------------------
create or replace function private.calendar_members_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cal_name text;
  v_actor uuid := auth.uid();
  v_name text := private.display_name(new.user_id);
  r record;
begin
  select name into v_cal_name from public.calendars where id = new.calendar_id;

  if tg_op = 'INSERT' or (old.status <> 'active' and new.status = 'active') then
    if new.role = 'owner' and tg_op = 'INSERT' then
      perform private.log_activity(new.calendar_id, null, new.user_id, 'calendar_created',
        jsonb_build_object('name', v_cal_name));
      return new;
    end if;
    perform private.log_activity(new.calendar_id, null, new.user_id, 'member_joined',
      jsonb_build_object('member_id', new.user_id, 'role', new.role));
    for r in
      select m.user_id from public.calendar_members m
      where m.calendar_id = new.calendar_id and m.status = 'active'
        and m.role in ('owner', 'admin') and m.user_id <> new.user_id
    loop
      perform private.notify(r.user_id, 'member_added', new.calendar_id, null, new.user_id,
        'Nova pessoa em ' || v_cal_name, v_name || ' entrou na agenda.');
    end loop;
    return new;
  end if;

  if old.status = 'active' and new.status = 'removed' then
    perform private.log_activity(new.calendar_id, null, v_actor, 'member_removed',
      jsonb_build_object('member_id', new.user_id));
    perform private.notify(new.user_id, 'member_removed', new.calendar_id, null, v_actor,
      'Acesso encerrado', 'Seu acesso à agenda "' || v_cal_name || '" foi encerrado.');
    return new;
  end if;

  if old.status = 'active' and new.status = 'left' then
    perform private.log_activity(new.calendar_id, null, new.user_id, 'member_left',
      jsonb_build_object('member_id', new.user_id));
    return new;
  end if;

  if new.status = 'active' and old.role is distinct from new.role then
    perform private.log_activity(new.calendar_id, null, v_actor, 'role_changed',
      jsonb_build_object('member_id', new.user_id, 'from', old.role, 'to', new.role));
    if new.role = 'owner' then
      perform private.notify(new.user_id, 'ownership_received', new.calendar_id, null, v_actor,
        'A agenda ' || v_cal_name || ' agora é sua', 'A propriedade da agenda foi transferida para você.');
    elsif old.role <> 'owner' then
      perform private.notify(new.user_id, 'role_changed', new.calendar_id, null, v_actor,
        'Seu papel mudou em ' || v_cal_name, 'Novo papel: ' || private.role_label(new.role), jsonb_build_object('role', new.role));
    end if;
  end if;
  return new;
end;
$$;

create trigger calendar_members_after_write
  after insert or update on public.calendar_members
  for each row execute function private.calendar_members_after_write();

-- ---------------------------------------------------------------------
-- Gatilho: mudanças de configuração da agenda
-- ---------------------------------------------------------------------
create or replace function private.calendars_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    v_action := 'calendar_trashed';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'calendar_restored';
  elsif old.status = 'active' and new.status = 'archived' then
    v_action := 'calendar_archived';
  elsif old.status = 'archived' and new.status = 'active' then
    v_action := 'calendar_unarchived';
  elsif old.owner_id is distinct from new.owner_id then
    v_action := 'ownership_transferred';
  else
    v_action := 'calendar_updated';
  end if;
  perform private.log_activity(new.id, null, auth.uid(), v_action,
    jsonb_build_object('name', new.name, 'new_owner_id',
      case when v_action = 'ownership_transferred' then new.owner_id else null end));
  return new;
end;
$$;

create trigger calendars_after_update
  after update on public.calendars
  for each row execute function private.calendars_after_update();

-- ---------------------------------------------------------------------
-- Gatilho: comentários avisam quem criou o evento e os participantes
-- ---------------------------------------------------------------------
create or replace function private.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_cal_name text;
  r record;
begin
  select * into v_event from public.events where id = new.event_id;
  select name into v_cal_name from public.calendars where id = v_event.calendar_id;

  perform private.log_activity(v_event.calendar_id, v_event.id, new.author_id, 'comment_added',
    jsonb_build_object('title', case when v_event.privacy = 'members' then v_event.title else null end),
    case when v_event.privacy = 'members' then 'members' else 'admins' end);

  if v_event.privacy in ('private', 'busy') then
    return new;
  end if;

  for r in
    select distinct u.user_id, m.role
    from (
      select v_event.created_by as user_id
      union
      select a.user_id from public.event_attendees a where a.event_id = v_event.id
    ) u
    join public.calendar_members m on m.user_id = u.user_id and m.calendar_id = v_event.calendar_id
    where m.status = 'active' and m.notifications_enabled and u.user_id is distinct from new.author_id
  loop
    if private.event_access_for(r.role, r.user_id, v_event.id, v_event.created_by, v_event.privacy) = 'full' then
      perform private.notify(r.user_id, 'comment_added', v_event.calendar_id, v_event.id, new.author_id,
        'Novo comentário em ' || v_cal_name,
        private.display_name(new.author_id) || ' comentou em "' || v_event.title || '"');
    end if;
  end loop;
  return new;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function private.comments_after_insert();
