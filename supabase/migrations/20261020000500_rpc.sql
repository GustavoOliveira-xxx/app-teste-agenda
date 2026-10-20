-- =====================================================================
-- Migration 5: funções chamadas pelo app (RPC)
--
-- Todas verificam quem está chamando (auth.uid()) e o papel na agenda.
-- Erros de regra de negócio usam códigos curtos em inglês (ex.:
-- 'FORBIDDEN', 'INVITE_EXPIRED'); o app traduz para mensagens amigáveis.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitários internos
-- ---------------------------------------------------------------------

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- Normaliza o código digitado (maiúsculas, sem traços, O->0, I/L->1) e
-- devolve o hash SHA-256. Códigos com tamanho errado devolvem null.
create or replace function private.invite_code_hash(p_code text)
returns bytea
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_norm text;
begin
  v_norm := translate(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011');
  if char_length(v_norm) <> 12 then
    return null;
  end if;
  return sha256(convert_to(v_norm, 'UTF8'));
end;
$$;

-- Código aleatório de 12 símbolos do alfabeto Crockford base32 (60 bits).
-- Usa bytes totalmente aleatórios de um UUID v4 (pula os bytes de versão).
create or replace function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
  i integer;
begin
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13] loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function private.effective_invite_status(p_status text, p_expires_at timestamptz, p_max_uses integer, p_use_count integer)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'pending' and p_expires_at is not null and p_expires_at <= now() then 'expired'
    when p_status = 'pending' and p_max_uses is not null and p_use_count >= p_max_uses then 'exhausted'
    else p_status
  end;
$$;

-- ---------------------------------------------------------------------
-- Conta
-- ---------------------------------------------------------------------

create or replace function public.get_my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'email_confirmed', u.email_confirmed_at is not null,
    'display_name', p.display_name,
    'avatar_color', p.avatar_color,
    'avatar_url', p.avatar_url,
    'account_status', p.account_status,
    'created_at', p.created_at,
    'last_seen_at', p.last_seen_at,
    'preferences', to_jsonb(up) - 'user_id',
    'notification_preferences', to_jsonb(np) - 'user_id')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_preferences up on up.user_id = p.id
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = auth.uid();
$$;

create or replace function public.register_device(
  p_installation_id text, p_platform text, p_device_name text default null,
  p_os_version text default null, p_app_version text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_id uuid;
begin
  insert into public.devices (user_id, installation_id, platform, device_name, os_version, app_version, last_seen_at)
  values (v_uid, p_installation_id, p_platform, left(p_device_name, 100), left(p_os_version, 50), left(p_app_version, 50), now())
  on conflict (user_id, installation_id) do update
    set platform = excluded.platform,
        device_name = excluded.device_name,
        os_version = excluded.os_version,
        app_version = excluded.app_version,
        last_seen_at = now()
  returning id into v_id;

  update public.profiles set last_seen_at = now() where id = v_uid;

  -- Mantém no máximo 20 aparelhos por pessoa (remove os mais antigos).
  delete from public.devices d
  where d.user_id = v_uid
    and d.id not in (select x.id from public.devices x where x.user_id = v_uid order by x.last_seen_at desc limit 20);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Agendas
-- ---------------------------------------------------------------------

create or replace function public.list_my_calendars()
returns table (
  id uuid, name text, description text, color text, icon text, kind text, status text,
  default_timezone text, default_member_role text, admins_can_invite boolean,
  members_can_invite boolean, editors_can_edit_all boolean, allow_private_events boolean,
  conflict_policy text, notify_members_on_changes boolean, owner_id uuid,
  archived_at timestamptz, deleted_at timestamptz, created_at timestamptz, updated_at timestamptz,
  my_role text, my_notifications_enabled boolean, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.description, c.color, c.icon, c.kind, c.status,
         c.default_timezone, c.default_member_role, c.admins_can_invite,
         c.members_can_invite, c.editors_can_edit_all, c.allow_private_events,
         c.conflict_policy, c.notify_members_on_changes, c.owner_id,
         c.archived_at, c.deleted_at, c.created_at, c.updated_at,
         m.role, m.notifications_enabled,
         (select count(*)::integer from public.calendar_members x
           where x.calendar_id = c.id and x.status = 'active')
  from public.calendars c
  join public.calendar_members m
    on m.calendar_id = c.id and m.user_id = auth.uid() and m.status = 'active'
  where c.deleted_at is null or m.role = 'owner'
  order by (c.kind = 'personal') desc, c.created_at;
$$;

-- Arquivar, desarquivar, mover para a lixeira, restaurar ou excluir de vez.
create or replace function public.set_calendar_state(p_calendar_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role text;
  v_count integer;
begin
  select m.role into v_role from public.calendar_members m
   where m.calendar_id = p_calendar_id and m.user_id = v_uid and m.status = 'active';
  if v_role is distinct from 'owner' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_action = 'archive' then
    update public.calendars set status = 'archived', archived_at = now()
     where id = p_calendar_id and status = 'active' and deleted_at is null;
  elsif p_action = 'unarchive' then
    update public.calendars set status = 'active', archived_at = null
     where id = p_calendar_id and status = 'archived' and deleted_at is null;
  elsif p_action = 'trash' then
    update public.calendars set deleted_at = now()
     where id = p_calendar_id and deleted_at is null;
  elsif p_action = 'restore' then
    update public.calendars set deleted_at = null
     where id = p_calendar_id and deleted_at is not null;
  elsif p_action = 'purge' then
    delete from public.calendars where id = p_calendar_id and deleted_at is not null;
  else
    raise exception 'INVALID_ACTION' using errcode = 'P0001';
  end if;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  perform private.audit('calendar_' || p_action, 'calendar', p_calendar_id);
end;
$$;

create or replace function public.duplicate_calendar(p_calendar_id uuid, p_name text default null, p_include_events boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role text := private.calendar_role(p_calendar_id);
  v_new uuid;
  v_new_event uuid;
  e record;
begin
  if v_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.calendars (owner_id, name, description, color, icon, kind, default_timezone,
    default_member_role, admins_can_invite, members_can_invite, editors_can_edit_all,
    allow_private_events, conflict_policy, notify_members_on_changes)
  select v_uid, left(coalesce(nullif(btrim(p_name), ''), c.name || ' (cópia)'), 80), c.description, c.color,
         c.icon, case when c.kind = 'personal' then 'custom' else c.kind end, c.default_timezone,
         c.default_member_role, c.admins_can_invite, c.members_can_invite, c.editors_can_edit_all,
         c.allow_private_events, c.conflict_policy, c.notify_members_on_changes
  from public.calendars c where c.id = p_calendar_id
  returning id into v_new;

  if p_include_events then
    for e in
      select * from public.events ev
      where ev.calendar_id = p_calendar_id and ev.deleted_at is null
        and private.event_access_for(v_role, v_uid, ev.id, ev.created_by, ev.privacy) = 'full'
    loop
      insert into public.events (calendar_id, title, description, location, address, url, all_day,
        starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, color, event_type,
        status, privacy, change_origin)
      values (v_new, e.title, e.description, e.location, e.address, e.url, e.all_day,
        e.starts_at, e.ends_at, e.start_date, e.end_date, e.timezone, e.recurrence_rule, e.color,
        e.event_type, e.status, case when e.privacy = 'participants' then 'members' else e.privacy end, 'system')
      returning id into v_new_event;

      insert into public.recurrence_exceptions (event_id, original_date, is_cancelled, title, description, location, starts_at, ends_at)
      select v_new_event, x.original_date, x.is_cancelled, x.title, x.description, x.location, x.starts_at, x.ends_at
      from public.recurrence_exceptions x where x.event_id = e.id;
    end loop;
  end if;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- Membros
-- ---------------------------------------------------------------------

create or replace function public.list_calendar_members(p_calendar_id uuid)
returns table (
  member_id uuid, user_id uuid, role text, joined_at timestamptz, last_activity_at timestamptz,
  display_name text, avatar_color text, notifications_enabled boolean, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.calendar_role(p_calendar_id) as role)
  select m.id, m.user_id, m.role, m.joined_at,
         case when (select role from me) in ('owner', 'admin') or m.user_id = auth.uid()
              then m.last_activity_at else null end,
         p.display_name, p.avatar_color,
         case when m.user_id = auth.uid() then m.notifications_enabled else null end,
         m.user_id = auth.uid()
  from public.calendar_members m
  join public.profiles p on p.id = m.user_id
  where m.calendar_id = p_calendar_id
    and m.status = 'active'
    and (select role from me) is not null
  order by private.role_rank(m.role) desc, p.display_name;
$$;

create or replace function public.change_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_target public.calendar_members;
  v_my_role text;
begin
  if p_role not in ('admin', 'editor', 'collaborator', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  select * into v_target from public.calendar_members where id = p_member_id and status = 'active';
  if v_target.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_my_role := private.calendar_role(v_target.calendar_id);
  if v_my_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.user_id = v_uid then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' then
    raise exception 'USE_TRANSFER_OWNERSHIP' using errcode = 'P0001';
  end if;
  -- Administrador só gerencia papéis abaixo de administrador.
  if not (v_my_role = 'owner'
          or (v_my_role = 'admin'
              and private.role_rank(v_target.role) < private.role_rank('admin')
              and private.role_rank(p_role) < private.role_rank('admin'))) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.calendar_members set role = p_role where id = p_member_id;
  perform private.audit('member_role_changed', 'calendar_member', p_member_id,
    jsonb_build_object('calendar_id', v_target.calendar_id, 'from', v_target.role, 'to', p_role));
end;
$$;

create or replace function private.revoke_member_data(p_calendar_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.reminders r
   using public.events e
   where r.event_id = e.id and e.calendar_id = p_calendar_id and r.user_id = p_user_id;
  delete from public.event_attendees a
   using public.events e
   where a.event_id = e.id and e.calendar_id = p_calendar_id and a.user_id = p_user_id;
$$;

create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_target public.calendar_members;
  v_my_role text;
begin
  select * into v_target from public.calendar_members where id = p_member_id and status = 'active';
  if v_target.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_my_role := private.calendar_role(v_target.calendar_id);
  if v_my_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.user_id = v_uid then
    raise exception 'USE_LEAVE_CALENDAR' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if not (v_my_role = 'owner'
          or (v_my_role = 'admin' and private.role_rank(v_target.role) < private.role_rank('admin'))) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.calendar_members
     set status = 'removed', removed_at = now(), removed_by = v_uid
   where id = p_member_id;
  perform private.revoke_member_data(v_target.calendar_id, v_target.user_id);
  perform private.audit('member_removed', 'calendar_member', p_member_id,
    jsonb_build_object('calendar_id', v_target.calendar_id, 'user_id', v_target.user_id));
end;
$$;

create or replace function public.leave_calendar(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role text := private.calendar_role(p_calendar_id);
begin
  if v_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_role = 'owner' then
    -- Regra 3: o proprietário precisa transferir ou excluir a agenda antes.
    raise exception 'OWNER_CANNOT_LEAVE' using errcode = 'P0001';
  end if;
  update public.calendar_members
     set status = 'left', removed_at = now(), removed_by = v_uid
   where calendar_id = p_calendar_id and user_id = v_uid;
  perform private.revoke_member_data(p_calendar_id, v_uid);
end;
$$;

create or replace function public.transfer_ownership(p_calendar_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if private.calendar_role(p_calendar_id) is distinct from 'owner' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_new_owner_id = v_uid then
    raise exception 'INVALID_TARGET' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.calendar_members
    where calendar_id = p_calendar_id and user_id = p_new_owner_id and status = 'active'
  ) then
    raise exception 'TARGET_NOT_MEMBER' using errcode = 'P0001';
  end if;

  -- Ordem importa: só pode haver um proprietário ativo por vez.
  update public.calendar_members set role = 'admin'
   where calendar_id = p_calendar_id and user_id = v_uid;
  update public.calendar_members set role = 'owner'
   where calendar_id = p_calendar_id and user_id = p_new_owner_id;
  update public.calendars set owner_id = p_new_owner_id where id = p_calendar_id;

  perform private.audit('ownership_transferred', 'calendar', p_calendar_id,
    jsonb_build_object('from', v_uid, 'to', p_new_owner_id));
end;
$$;

-- ---------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------

create or replace function public.create_invitation(
  p_calendar_id uuid, p_role text, p_email text default null,
  p_expires_in_hours integer default 168, p_max_uses integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role text := private.calendar_role(p_calendar_id);
  v_cal public.calendars;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_code text;
  v_inv public.invitations;
  v_target uuid;
  v_max_uses integer := p_max_uses;
begin
  if v_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into v_cal from public.calendars where id = p_calendar_id;
  if v_cal.status <> 'active' then
    raise exception 'CALENDAR_NOT_WRITABLE' using errcode = 'P0001';
  end if;

  -- Quem pode convidar (regra 27).
  if not (v_role = 'owner'
          or (v_role = 'admin' and v_cal.admins_can_invite)
          or (v_role in ('editor', 'collaborator') and v_cal.members_can_invite)) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  -- Ninguém concede papel igual ou maior que o próprio (exceto o proprietário).
  if p_role not in ('admin', 'editor', 'collaborator', 'viewer')
     or (v_role <> 'owner' and private.role_rank(p_role) >= private.role_rank(v_role)) then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if p_expires_in_hours is not null and (p_expires_in_hours < 1 or p_expires_in_hours > 2160) then
    raise exception 'INVALID_EXPIRATION' using errcode = 'P0001';
  end if;
  if v_max_uses is not null and (v_max_uses < 1 or v_max_uses > 100) then
    raise exception 'INVALID_MAX_USES' using errcode = 'P0001';
  end if;
  if private.rate_limited('create_invitation', 30, interval '1 hour') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  if v_email is not null then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
      raise exception 'INVALID_EMAIL' using errcode = 'P0001';
    end if;
    select u.id into v_target from auth.users u where lower(u.email) = v_email;
    if v_target is not null and exists (
      select 1 from public.calendar_members m
      where m.calendar_id = p_calendar_id and m.user_id = v_target and m.status = 'active'
    ) then
      raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
    end if;
    -- Convite por e-mail é de uso único e substitui um pendente anterior.
    v_max_uses := 1;
    update public.invitations
       set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
     where calendar_id = p_calendar_id and invited_email = v_email and status = 'pending';
  end if;

  v_code := private.generate_invite_code();
  insert into public.invitations (calendar_id, created_by, invited_email, role, code_hash, code_hint,
                                  expires_at, max_uses)
  values (p_calendar_id, v_uid, v_email, p_role, private.invite_code_hash(v_code), right(v_code, 4),
          case when p_expires_in_hours is null then null else now() + make_interval(hours => p_expires_in_hours) end,
          v_max_uses)
  returning * into v_inv;

  perform private.record_rate_hit('create_invitation');
  perform private.log_activity(p_calendar_id, null, v_uid, 'invite_created',
    jsonb_build_object('role', p_role, 'by_email', v_email is not null), 'admins');
  perform private.audit('invitation_created', 'invitation', v_inv.id,
    jsonb_build_object('calendar_id', p_calendar_id, 'role', p_role));

  if v_target is not null and exists (
    select 1 from auth.users u where u.id = v_target and u.email_confirmed_at is not null
  ) then
    perform private.notify(v_target, 'invite_received', p_calendar_id, null, v_uid,
      'Convite para ' || v_cal.name,
      private.display_name(v_uid) || ' convidou você como ' || private.role_label(p_role) || '.',
      jsonb_build_object('invitation_id', v_inv.id));
  end if;

  return jsonb_build_object(
    'id', v_inv.id,
    'code', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4),
    'role', v_inv.role,
    'expires_at', v_inv.expires_at,
    'max_uses', v_inv.max_uses,
    'invited_email', v_inv.invited_email);
end;
$$;

create or replace function public.list_calendar_invitations(p_calendar_id uuid)
returns table (
  id uuid, invited_email text, role text, code_hint text, created_at timestamptz,
  expires_at timestamptz, max_uses integer, use_count integer, status text,
  created_by_name text, accepted_by_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.invited_email, i.role, i.code_hint, i.created_at, i.expires_at, i.max_uses,
         i.use_count, private.effective_invite_status(i.status, i.expires_at, i.max_uses, i.use_count),
         private.display_name(i.created_by),
         case when i.accepted_by is null then null else private.display_name(i.accepted_by) end
  from public.invitations i
  where i.calendar_id = p_calendar_id
    and (private.calendar_role(p_calendar_id) in ('owner', 'admin') or i.created_by = auth.uid())
  order by i.created_at desc
  limit 100;
$$;

create or replace function public.cancel_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation_id;
  if v_inv.id is null or private.calendar_role(v_inv.calendar_id) is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not (private.calendar_role(v_inv.calendar_id) in ('owner', 'admin') or v_inv.created_by = v_uid) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.invitations set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
   where id = p_invitation_id;
  perform private.log_activity(v_inv.calendar_id, null, v_uid, 'invite_cancelled', '{}'::jsonb, 'admins');
  perform private.audit('invitation_cancelled', 'invitation', p_invitation_id);
end;
$$;

-- Regra 6: o proprietário pode alterar o papel antes da aceitação.
create or replace function public.update_invitation_role(p_invitation_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  perform private.require_user();
  select * into v_inv from public.invitations where id = p_invitation_id;
  if v_inv.id is null or private.calendar_role(v_inv.calendar_id) is distinct from 'owner' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'editor', 'collaborator', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if private.effective_invite_status(v_inv.status, v_inv.expires_at, v_inv.max_uses, v_inv.use_count) <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.invitations set role = p_role where id = p_invitation_id;
end;
$$;

-- Lógica comum de aceitação (por código ou pela lista de convites recebidos).
-- Devolve jsonb em vez de lançar erro para que tentativas inválidas fiquem
-- registradas no limite de requisições.
create or replace function private.accept_invitation_internal(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_cal public.calendars;
  v_email text;
  v_confirmed boolean;
  v_member public.calendar_members;
  v_creator_role text;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv.id is null then
    return jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  end if;
  select * into v_cal from public.calendars where id = v_inv.calendar_id;
  if v_cal.deleted_at is not null or v_cal.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'INVITE_CALENDAR_UNAVAILABLE');
  end if;

  select lower(u.email), u.email_confirmed_at is not null into v_email, v_confirmed
    from auth.users u where u.id = v_uid;
  if v_inv.invited_email is not null then
    if v_email is distinct from v_inv.invited_email then
      return jsonb_build_object('ok', false, 'error', 'INVITE_FOR_OTHER_EMAIL');
    end if;
    if not v_confirmed then
      return jsonb_build_object('ok', false, 'error', 'EMAIL_NOT_CONFIRMED');
    end if;
  end if;

  select * into v_member from public.calendar_members
   where calendar_id = v_inv.calendar_id and user_id = v_uid;
  -- Idempotente: aceitar de novo não duplica nem gasta usos (regra 18).
  if v_member.id is not null and v_member.status = 'active' then
    return jsonb_build_object('ok', true, 'calendar_id', v_inv.calendar_id, 'already_member', true);
  end if;

  if v_inv.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'INVITE_CANCELLED');
  elsif v_inv.status = 'declined' then
    return jsonb_build_object('ok', false, 'error', 'INVITE_DECLINED');
  elsif v_inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'INVITE_ALREADY_USED');
  elsif v_inv.status = 'expired' or (v_inv.expires_at is not null and v_inv.expires_at <= now()) then
    update public.invitations set status = 'expired' where id = v_inv.id and status = 'pending';
    return jsonb_build_object('ok', false, 'error', 'INVITE_EXPIRED');
  elsif v_inv.status = 'exhausted' or (v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses) then
    return jsonb_build_object('ok', false, 'error', 'INVITE_EXHAUSTED');
  end if;

  if v_member.id is not null then
    update public.calendar_members
       set status = 'active', role = v_inv.role, joined_at = now(), granted_by = v_inv.created_by,
           invitation_id = v_inv.id, removed_at = null, removed_by = null
     where id = v_member.id;
  else
    insert into public.calendar_members (calendar_id, user_id, role, status, granted_by, invitation_id)
    values (v_inv.calendar_id, v_uid, v_inv.role, 'active', v_inv.created_by, v_inv.id);
  end if;

  update public.invitations
     set use_count = use_count + 1,
         accepted_at = now(),
         accepted_by = v_uid,
         status = case
           when max_uses = 1 then 'accepted'
           when max_uses is not null and use_count + 1 >= max_uses then 'exhausted'
           else 'pending' end
   where id = v_inv.id;

  -- Proprietário e administradores já recebem "nova pessoa na agenda".
  select m.role into v_creator_role from public.calendar_members m
   where m.calendar_id = v_inv.calendar_id and m.user_id = v_inv.created_by and m.status = 'active';
  if v_inv.created_by is not null and v_creator_role not in ('owner', 'admin') then
    perform private.notify(v_inv.created_by, 'invite_accepted', v_inv.calendar_id, null, v_uid,
      'Convite aceito', private.display_name(v_uid) || ' entrou em ' || v_cal.name || '.');
  end if;

  return jsonb_build_object('ok', true, 'calendar_id', v_inv.calendar_id, 'already_member', false);
end;
$$;

create or replace function public.preview_invitation(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_inv public.invitations;
  v_cal public.calendars;
  v_email text;
  v_status text;
begin
  if private.rate_limited('invite_code_fail', 10, interval '15 minutes') then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select * into v_inv from public.invitations where code_hash = private.invite_code_hash(p_code);
  if v_inv.id is null then
    perform private.record_rate_hit('invite_code_fail');
    return jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  end if;
  select * into v_cal from public.calendars where id = v_inv.calendar_id;
  if v_cal.deleted_at is not null or v_cal.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'INVITE_CALENDAR_UNAVAILABLE');
  end if;
  if v_inv.invited_email is not null then
    select lower(u.email) into v_email from auth.users u where u.id = v_uid;
    if v_email is distinct from v_inv.invited_email then
      return jsonb_build_object('ok', false, 'error', 'INVITE_FOR_OTHER_EMAIL');
    end if;
  end if;
  v_status := private.effective_invite_status(v_inv.status, v_inv.expires_at, v_inv.max_uses, v_inv.use_count);

  -- Regras 3 e 4: mostrar qual agenda e qual papel ANTES da confirmação.
  return jsonb_build_object(
    'ok', true,
    'invitation_id', v_inv.id,
    'status', v_status,
    'calendar_id', v_cal.id,
    'calendar_name', v_cal.name,
    'calendar_color', v_cal.color,
    'calendar_kind', v_cal.kind,
    'role', v_inv.role,
    'inviter_name', private.display_name(v_inv.created_by),
    'expires_at', v_inv.expires_at,
    'already_member', exists (
      select 1 from public.calendar_members m
      where m.calendar_id = v_cal.id and m.user_id = v_uid and m.status = 'active'));
end;
$$;

create or replace function public.accept_invitation(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_user();
  if private.rate_limited('invite_code_fail', 10, interval '15 minutes') then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select id into v_id from public.invitations where code_hash = private.invite_code_hash(p_code);
  if v_id is null then
    perform private.record_rate_hit('invite_code_fail');
    return jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  end if;
  return private.accept_invitation_internal(v_id);
end;
$$;

-- Convites enviados para o e-mail (confirmado) da pessoa logada.
create or replace function public.my_invitations()
returns table (
  id uuid, calendar_id uuid, calendar_name text, calendar_color text, role text,
  inviter_name text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, c.id, c.name, c.color, i.role, private.display_name(i.created_by), i.created_at, i.expires_at
  from public.invitations i
  join public.calendars c on c.id = i.calendar_id
  join auth.users u on u.id = auth.uid()
  where i.invited_email = lower(u.email)
    and u.email_confirmed_at is not null
    and private.effective_invite_status(i.status, i.expires_at, i.max_uses, i.use_count) = 'pending'
    and c.deleted_at is null and c.status = 'active'
    and not exists (
      select 1 from public.calendar_members m
      where m.calendar_id = c.id and m.user_id = auth.uid() and m.status = 'active')
  order by i.created_at desc;
$$;

create or replace function public.respond_invitation(p_invitation_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_inv public.invitations;
  v_email text;
  v_confirmed boolean;
begin
  select * into v_inv from public.invitations where id = p_invitation_id;
  select lower(u.email), u.email_confirmed_at is not null into v_email, v_confirmed
    from auth.users u where u.id = v_uid;
  if v_inv.id is null or v_inv.invited_email is null or v_inv.invited_email is distinct from v_email then
    return jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  end if;
  if not v_confirmed then
    return jsonb_build_object('ok', false, 'error', 'EMAIL_NOT_CONFIRMED');
  end if;
  if p_accept then
    return private.accept_invitation_internal(p_invitation_id);
  end if;
  if private.effective_invite_status(v_inv.status, v_inv.expires_at, v_inv.max_uses, v_inv.use_count) <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATE');
  end if;
  update public.invitations set status = 'declined' where id = p_invitation_id;
  perform private.log_activity(v_inv.calendar_id, null, v_uid, 'invite_declined', '{}'::jsonb, 'admins');
  perform private.notify(v_inv.created_by, 'invite_declined', v_inv.calendar_id, null, v_uid,
    'Convite recusado', private.display_name(v_uid) || ' recusou o convite.');
  return jsonb_build_object('ok', true, 'declined', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Eventos: leitura
-- ---------------------------------------------------------------------

-- Lista eventos visíveis no período. Eventos "ocupado" de outras pessoas
-- voltam mascarados (sem título nem detalhes). Séries recorrentes que
-- começaram antes do fim do período sempre voltam (o app calcula as
-- ocorrências).
create or replace function public.list_events(p_calendar_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, calendar_id uuid, title text, description text, location text, address text, url text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
  timezone text, recurrence_rule text, created_by uuid, assignee_id uuid, color text,
  event_type text, status text, privacy text, version integer, created_at timestamptz,
  updated_at timestamptz, updated_by uuid, completed_at timestamptz, is_masked boolean,
  exceptions jsonb, attendee_ids uuid[], my_reminders integer[])
language sql
stable
security definer
set search_path = ''
as $$
  with my_cals as (
    select m.calendar_id, m.role
    from public.calendar_members m
    join public.calendars c on c.id = m.calendar_id
    where m.user_id = auth.uid() and m.status = 'active' and c.deleted_at is null
      and (p_calendar_ids is null or m.calendar_id = any (p_calendar_ids))
  ),
  visible as (
    select e.*, private.event_access_for(mc.role, auth.uid(), e.id, e.created_by, e.privacy) as access
    from public.events e
    join my_cals mc on mc.calendar_id = e.calendar_id
    where e.deleted_at is null
      and e.starts_at < p_to
      and (e.recurrence_rule is not null or e.ends_at > p_from)
  )
  select v.id, v.calendar_id,
         case when v.access = 'full' then v.title end,
         case when v.access = 'full' then v.description end,
         case when v.access = 'full' then v.location end,
         case when v.access = 'full' then v.address end,
         case when v.access = 'full' then v.url end,
         v.all_day, v.starts_at, v.ends_at, v.start_date, v.end_date, v.timezone, v.recurrence_rule,
         case when v.access = 'full' then v.created_by end,
         case when v.access = 'full' then v.assignee_id end,
         v.color,
         case when v.access = 'full' then v.event_type else 'custom' end,
         v.status, v.privacy, v.version, v.created_at, v.updated_at,
         case when v.access = 'full' then v.updated_by end,
         v.completed_at,
         v.access = 'masked',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'original_date', x.original_date,
             'is_cancelled', x.is_cancelled,
             'title', case when v.access = 'full' then x.title end,
             'description', case when v.access = 'full' then x.description end,
             'location', case when v.access = 'full' then x.location end,
             'starts_at', x.starts_at,
             'ends_at', x.ends_at) order by x.original_date)
           from public.recurrence_exceptions x where x.event_id = v.id), '[]'::jsonb),
         case when v.access = 'full' then coalesce((
           select array_agg(a.user_id order by a.user_id) from public.event_attendees a where a.event_id = v.id),
           '{}'::uuid[]) else '{}'::uuid[] end,
         coalesce((
           select array_agg(r.minutes_before order by r.minutes_before)
           from public.reminders r where r.event_id = v.id and r.user_id = auth.uid()), '{}'::integer[])
  from visible v
  where v.access is not null
  order by v.starts_at
  limit 5000;
$$;

-- Busca textual que só retorna o que a pessoa pode ver por completo.
create or replace function public.search_events(p_query text, p_calendar_ids uuid[] default null, p_limit integer default 50)
returns table (
  id uuid, calendar_id uuid, title text, description text, location text, address text, url text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
  timezone text, recurrence_rule text, created_by uuid, assignee_id uuid, color text,
  event_type text, status text, privacy text, version integer, created_at timestamptz,
  updated_at timestamptz, updated_by uuid, completed_at timestamptz, is_masked boolean,
  exceptions jsonb, attendee_ids uuid[], my_reminders integer[])
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           char_length(btrim(coalesce(p_query, ''))) as len
  ),
  my_cals as (
    select m.calendar_id, m.role, c.name as calendar_name
    from public.calendar_members m
    join public.calendars c on c.id = m.calendar_id
    where m.user_id = auth.uid() and m.status = 'active' and c.deleted_at is null
      and (p_calendar_ids is null or m.calendar_id = any (p_calendar_ids))
  )
  select e.id, e.calendar_id, e.title, e.description, e.location, e.address, e.url,
         e.all_day, e.starts_at, e.ends_at, e.start_date, e.end_date, e.timezone, e.recurrence_rule,
         e.created_by, e.assignee_id, e.color, e.event_type, e.status, e.privacy, e.version,
         e.created_at, e.updated_at, e.updated_by, e.completed_at, false,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'original_date', x.original_date, 'is_cancelled', x.is_cancelled, 'title', x.title,
             'description', x.description, 'location', x.location, 'starts_at', x.starts_at,
             'ends_at', x.ends_at) order by x.original_date)
           from public.recurrence_exceptions x where x.event_id = e.id), '[]'::jsonb),
         coalesce((select array_agg(a.user_id order by a.user_id) from public.event_attendees a where a.event_id = e.id), '{}'::uuid[]),
         coalesce((select array_agg(r.minutes_before order by r.minutes_before) from public.reminders r
                   where r.event_id = e.id and r.user_id = auth.uid()), '{}'::integer[])
  from public.events e
  join my_cals mc on mc.calendar_id = e.calendar_id
  cross join q
  where q.len between 2 and 100
    and e.deleted_at is null
    and private.event_access_for(mc.role, auth.uid(), e.id, e.created_by, e.privacy) = 'full'
    and (e.title ilike q.pattern
         or e.description ilike q.pattern
         or e.location ilike q.pattern
         or e.address ilike q.pattern
         or mc.calendar_name ilike q.pattern
         or exists (select 1 from public.comments cm
                    where cm.event_id = e.id and cm.deleted_at is null and cm.body ilike q.pattern))
  order by e.starts_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------
-- Eventos: escrita idempotente com controle de versão
--
-- SECURITY INVOKER: as regras de acesso (RLS) das tabelas valem aqui.
-- Resultado:
--   {status:'ok', event:{...}}
--   {status:'conflict', reason:'version'|'deleted', event:{versão do servidor}}
--   {status:'error', code:'FORBIDDEN'|'NOT_FOUND'|'INVALID_DATA'|...}
-- ---------------------------------------------------------------------
create or replace function public.apply_event_op(
  p_op_id uuid, p_kind text, p_event_id uuid, p_payload jsonb default '{}'::jsonb,
  p_base_version integer default null, p_origin text default 'app')
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_prev jsonb;
  v_result jsonb;
  v_row public.events;
  v_current public.events;
  v_new public.events;
  v_exc public.recurrence_exceptions;
  v_origin text := case when p_origin = 'offline_sync' then 'offline_sync' else 'app' end;
  v_p jsonb := coalesce(p_payload, '{}'::jsonb);
  v_n jsonb;
begin
  if p_op_id is null or p_event_id is null then
    raise exception 'INVALID_OPERATION' using errcode = 'P0001';
  end if;

  -- Reenvio da mesma operação: devolve o resultado guardado (regra 17).
  select s.result into v_prev from public.sync_operations s where s.id = p_op_id and s.user_id = v_uid;
  if v_prev is not null then
    return v_prev || jsonb_build_object('replayed', true);
  end if;

  begin
    if p_kind = 'create' then
      insert into public.events (id, calendar_id, title, description, location, address, url, all_day,
        starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, assignee_id, color,
        event_type, status, privacy, change_origin)
      values (p_event_id, (v_p ->> 'calendar_id')::uuid, v_p ->> 'title', v_p ->> 'description',
        v_p ->> 'location', v_p ->> 'address', v_p ->> 'url', coalesce((v_p ->> 'all_day')::boolean, false),
        (v_p ->> 'starts_at')::timestamptz, (v_p ->> 'ends_at')::timestamptz,
        (v_p ->> 'start_date')::date, (v_p ->> 'end_date')::date,
        coalesce(v_p ->> 'timezone', 'America/Sao_Paulo'), v_p ->> 'recurrence_rule',
        (v_p ->> 'assignee_id')::uuid, v_p ->> 'color',
        coalesce(v_p ->> 'event_type', 'appointment'), coalesce(v_p ->> 'status', 'planned'),
        coalesce(v_p ->> 'privacy', 'members'), v_origin)
      on conflict (id) do nothing
      returning * into v_row;

      if v_row.id is null then
        select * into v_current from public.events e where e.id = p_event_id;
        if v_current.id is not null and v_current.created_by = v_uid then
          v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_current));
        else
          v_result := jsonb_build_object('status', 'error', 'code', 'DUPLICATE_ID');
        end if;
      else
        v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_row));
      end if;

    elsif p_kind in ('update', 'delete', 'restore', 'split_series') then
      if p_kind = 'update' then
        update public.events e set
          title = case when v_p ? 'title' then v_p ->> 'title' else e.title end,
          description = case when v_p ? 'description' then v_p ->> 'description' else e.description end,
          location = case when v_p ? 'location' then v_p ->> 'location' else e.location end,
          address = case when v_p ? 'address' then v_p ->> 'address' else e.address end,
          url = case when v_p ? 'url' then v_p ->> 'url' else e.url end,
          all_day = case when v_p ? 'all_day' then (v_p ->> 'all_day')::boolean else e.all_day end,
          starts_at = case when v_p ? 'starts_at' then (v_p ->> 'starts_at')::timestamptz else e.starts_at end,
          ends_at = case when v_p ? 'ends_at' then (v_p ->> 'ends_at')::timestamptz else e.ends_at end,
          start_date = case when v_p ? 'start_date' then (v_p ->> 'start_date')::date else e.start_date end,
          end_date = case when v_p ? 'end_date' then (v_p ->> 'end_date')::date else e.end_date end,
          timezone = case when v_p ? 'timezone' then v_p ->> 'timezone' else e.timezone end,
          recurrence_rule = case when v_p ? 'recurrence_rule' then v_p ->> 'recurrence_rule' else e.recurrence_rule end,
          assignee_id = case when v_p ? 'assignee_id' then (v_p ->> 'assignee_id')::uuid else e.assignee_id end,
          color = case when v_p ? 'color' then v_p ->> 'color' else e.color end,
          event_type = case when v_p ? 'event_type' then v_p ->> 'event_type' else e.event_type end,
          status = case when v_p ? 'status' then v_p ->> 'status' else e.status end,
          privacy = case when v_p ? 'privacy' then v_p ->> 'privacy' else e.privacy end,
          change_origin = v_origin
        where e.id = p_event_id and e.version = p_base_version and e.deleted_at is null
        returning * into v_row;
      elsif p_kind = 'delete' then
        update public.events e set deleted_at = now(), change_origin = v_origin
        where e.id = p_event_id and (p_base_version is null or e.version = p_base_version) and e.deleted_at is null
        returning * into v_row;
      elsif p_kind = 'restore' then
        update public.events e set deleted_at = null, change_origin = v_origin
        where e.id = p_event_id and e.deleted_at is not null
        returning * into v_row;
      else
        -- "Esta e as próximas": encerra a série original e cria a nova, juntas.
        update public.events e set recurrence_rule = v_p ->> 'original_rule', change_origin = v_origin
        where e.id = p_event_id and e.version = p_base_version and e.deleted_at is null
          and e.recurrence_rule is not null
        returning * into v_row;
        if v_row.id is not null then
          v_n := v_p -> 'new_event';
          insert into public.events (id, calendar_id, title, description, location, address, url, all_day,
            starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, assignee_id, color,
            event_type, status, privacy, change_origin)
          values ((v_n ->> 'id')::uuid, v_row.calendar_id, v_n ->> 'title', v_n ->> 'description',
            v_n ->> 'location', v_n ->> 'address', v_n ->> 'url', coalesce((v_n ->> 'all_day')::boolean, false),
            (v_n ->> 'starts_at')::timestamptz, (v_n ->> 'ends_at')::timestamptz,
            (v_n ->> 'start_date')::date, (v_n ->> 'end_date')::date,
            coalesce(v_n ->> 'timezone', v_row.timezone), v_n ->> 'recurrence_rule',
            (v_n ->> 'assignee_id')::uuid, v_n ->> 'color',
            coalesce(v_n ->> 'event_type', v_row.event_type), coalesce(v_n ->> 'status', v_row.status),
            coalesce(v_n ->> 'privacy', v_row.privacy), v_origin)
          returning * into v_new;
        end if;
      end if;

      if v_row.id is not null then
        v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_row));
        if v_new.id is not null then
          v_result := v_result || jsonb_build_object('new_event', to_jsonb(v_new));
        end if;
      else
        select * into v_current from public.events e where e.id = p_event_id;
        if v_current.id is null then
          v_result := jsonb_build_object('status', 'error', 'code', 'NOT_FOUND');
        elsif p_kind = 'delete' and v_current.deleted_at is not null then
          v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_current));
        elsif p_kind = 'restore' and v_current.deleted_at is null then
          v_result := jsonb_build_object('status', 'ok', 'event', to_jsonb(v_current));
        elsif v_current.deleted_at is not null then
          v_result := jsonb_build_object('status', 'conflict', 'reason', 'deleted', 'event', to_jsonb(v_current));
        elsif p_base_version is not null and v_current.version <> p_base_version then
          v_result := jsonb_build_object('status', 'conflict', 'reason', 'version', 'event', to_jsonb(v_current));
        else
          v_result := jsonb_build_object('status', 'error', 'code', 'FORBIDDEN');
        end if;
      end if;

    elsif p_kind = 'exception_upsert' then
      insert into public.recurrence_exceptions (event_id, original_date, is_cancelled, title, description,
        location, starts_at, ends_at)
      values (p_event_id, (v_p ->> 'original_date')::date, coalesce((v_p ->> 'is_cancelled')::boolean, false),
        v_p ->> 'title', v_p ->> 'description', v_p ->> 'location',
        (v_p ->> 'starts_at')::timestamptz, (v_p ->> 'ends_at')::timestamptz)
      on conflict (event_id, original_date) do update set
        is_cancelled = excluded.is_cancelled,
        title = excluded.title,
        description = excluded.description,
        location = excluded.location,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at
      returning * into v_exc;
      v_result := jsonb_build_object('status', 'ok', 'exception', to_jsonb(v_exc));

    elsif p_kind = 'exception_delete' then
      delete from public.recurrence_exceptions x
       where x.event_id = p_event_id and x.original_date = (v_p ->> 'original_date')::date;
      v_result := jsonb_build_object('status', 'ok');

    else
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_OPERATION');
    end if;
  exception
    when insufficient_privilege then
      v_result := jsonb_build_object('status', 'error', 'code', 'FORBIDDEN');
    when check_violation or not_null_violation or invalid_text_representation
         or invalid_datetime_format or datetime_field_overflow or string_data_right_truncation then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_DATA');
    when foreign_key_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_REFERENCE');
    when unique_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'DUPLICATE_ID');
    when raise_exception then
      v_result := jsonb_build_object('status', 'error', 'code', sqlerrm);
  end;

  -- Guarda apenas o necessário para responder a reenvios (sem dados do evento).
  if v_result ->> 'status' in ('ok', 'error') then
    insert into public.sync_operations (id, user_id, kind, entity_id, result)
    values (p_op_id, v_uid, p_kind, p_event_id, jsonb_strip_nulls(jsonb_build_object(
      'status', v_result ->> 'status',
      'code', v_result ->> 'code',
      'event_id', p_event_id,
      'version', (v_result -> 'event' ->> 'version')::integer)))
    on conflict (id) do nothing;
  end if;

  return v_result;
end;
$$;

-- Lembretes pessoais de um evento (substitui a lista inteira).
create or replace function public.set_event_reminders(p_event_id uuid, p_minutes integer[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if coalesce(cardinality(p_minutes), 0) > 5 then
    raise exception 'TOO_MANY_REMINDERS' using errcode = 'P0001';
  end if;
  delete from public.reminders where event_id = p_event_id and user_id = v_uid;
  insert into public.reminders (event_id, user_id, minutes_before)
  select distinct p_event_id, v_uid, m from unnest(coalesce(p_minutes, '{}'::integer[])) as m;
end;
$$;

-- Participantes escolhidos (precisam ser membros ativos da agenda).
create or replace function public.set_event_attendees(p_event_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_cal uuid;
  v_ids uuid[] := coalesce(p_user_ids, '{}'::uuid[]);
begin
  if not private.can_edit_event_by_id(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if cardinality(v_ids) > 100 then
    raise exception 'TOO_MANY_ATTENDEES' using errcode = 'P0001';
  end if;
  select calendar_id into v_cal from public.events where id = p_event_id;
  if exists (
    select 1 from unnest(v_ids) as u(id)
    where not exists (
      select 1 from public.calendar_members m
      where m.calendar_id = v_cal and m.user_id = u.id and m.status = 'active')
  ) then
    raise exception 'INVALID_ATTENDEE' using errcode = 'P0001';
  end if;
  delete from public.event_attendees where event_id = p_event_id and user_id <> all (v_ids);
  insert into public.event_attendees (event_id, user_id, added_by)
  select distinct p_event_id, u, v_uid from unnest(v_ids) as u
  on conflict (event_id, user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Comentários e histórico
-- ---------------------------------------------------------------------

create or replace function public.list_event_comments(p_event_id uuid)
returns table (
  id uuid, author_id uuid, author_name text, author_color text, body text,
  created_at timestamptz, edited_at timestamptz, deleted_at timestamptz, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.author_id,
         case when c.author_id is null then 'Ex-membro' else coalesce(p.display_name, 'Ex-membro') end,
         coalesce(p.avatar_color, '#8B8D98'),
         case when c.deleted_at is null then c.body else null end,
         c.created_at, c.edited_at, c.deleted_at, c.author_id = auth.uid()
  from public.comments c
  left join public.profiles p on p.id = c.author_id
  where c.event_id = p_event_id
    and private.event_access_by_id(p_event_id) = 'full'
  order by c.created_at
  limit 500;
$$;

create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_comment public.comments;
  v_cal uuid;
begin
  select * into v_comment from public.comments where id = p_comment_id and deleted_at is null;
  if v_comment.id is null or private.event_access_by_id(v_comment.event_id) is distinct from 'full' then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select calendar_id into v_cal from public.events where id = v_comment.event_id;
  if not (v_comment.author_id = v_uid or private.calendar_role(v_cal) in ('owner', 'admin')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.comments set deleted_at = now(), body = '' where id = p_comment_id;
end;
$$;

create or replace function public.list_activity(
  p_calendar_id uuid, p_event_id uuid default null, p_limit integer default 50, p_before_id bigint default null)
returns table (
  id bigint, calendar_id uuid, event_id uuid, action text, details jsonb, created_at timestamptz,
  actor_id uuid, actor_name text, member_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.calendar_id, a.event_id, a.action, a.details, a.created_at, a.actor_id,
         private.display_name(a.actor_id),
         case when a.details ? 'member_id' then private.display_name((a.details ->> 'member_id')::uuid) end
  from public.activity_logs a
  where a.calendar_id = p_calendar_id
    and (p_event_id is null or a.event_id = p_event_id)
    and (p_before_id is null or a.id < p_before_id)
  order by a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------
-- LGPD: exportação e exclusão da conta
-- ---------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_data jsonb;
begin
  if private.rate_limited('export_my_data', 5, interval '1 hour') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  perform private.record_rate_hit('export_my_data');
  perform private.audit('data_exported', 'user', v_uid);

  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                  'email_confirmed_at', u.email_confirmed_at) from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'preferences', (select to_jsonb(x) - 'user_id' from public.user_preferences x where x.user_id = v_uid),
    'notification_preferences', (select to_jsonb(x) - 'user_id' from public.notification_preferences x where x.user_id = v_uid),
    'devices', coalesce((select jsonb_agg(to_jsonb(d) - 'push_token') from public.devices d where d.user_id = v_uid), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('calendar_id', m.calendar_id,
                  'calendar_name', c.name, 'role', m.role, 'status', m.status, 'joined_at', m.joined_at))
                  from public.calendar_members m join public.calendars c on c.id = m.calendar_id
                  where m.user_id = v_uid), '[]'::jsonb),
    'owned_calendars', coalesce((select jsonb_agg(to_jsonb(c)) from public.calendars c where c.owner_id = v_uid), '[]'::jsonb),
    'events_created', coalesce((select jsonb_agg(to_jsonb(e)) from public.events e where e.created_by = v_uid), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(to_jsonb(r)) from public.reminders r where r.user_id = v_uid), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c)) from public.comments c where c.author_id = v_uid), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n)) from (
                     select * from public.notifications n where n.user_id = v_uid
                     order by n.created_at desc limit 500) n), '[]'::jsonb)
  ) into v_data;
  return v_data;
end;
$$;

create or replace function public.account_deletion_impact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'blocking_calendars', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name,
        'member_count', (select count(*) from public.calendar_members m
                         where m.calendar_id = c.id and m.status = 'active')))
      from public.calendars c
      where c.owner_id = auth.uid() and c.deleted_at is null
        and exists (select 1 from public.calendar_members m
                    where m.calendar_id = c.id and m.status = 'active' and m.user_id <> auth.uid())), '[]'::jsonb),
    'calendars_to_delete', (select count(*) from public.calendars c where c.owner_id = auth.uid()),
    'events_kept_in_shared_calendars', (
      select count(*) from public.events e join public.calendars c on c.id = e.calendar_id
      where e.created_by = auth.uid() and c.owner_id <> auth.uid() and e.deleted_at is null),
    'comments_to_delete', (select count(*) from public.comments c where c.author_id = auth.uid()));
$$;

create or replace function public.delete_my_account(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if p_confirmation is distinct from 'EXCLUIR' then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;
  -- Regra 19: quem é proprietário de agenda compartilhada precisa transferir antes.
  if exists (
    select 1 from public.calendars c
    where c.owner_id = v_uid and c.deleted_at is null
      and exists (select 1 from public.calendar_members m
                  where m.calendar_id = c.id and m.status = 'active' and m.user_id <> v_uid)
  ) then
    raise exception 'OWNS_SHARED_CALENDARS' using errcode = 'P0001';
  end if;

  perform private.audit('account_deleted', 'user', v_uid);
  delete from public.comments where author_id = v_uid;
  delete from public.calendars where owner_id = v_uid;
  -- Apaga a conta de autenticação; perfil, preferências, dispositivos,
  -- participações, lembretes e avisos são apagados em cascata. Eventos
  -- criados em agendas de outras pessoas permanecem, sem autor.
  delete from auth.users where id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Manutenção (somente painel/service_role): esvazia lixeiras antigas
-- ---------------------------------------------------------------------
create or replace function public.purge_trash(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendars integer;
  v_events integer;
begin
  delete from public.calendars where deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_calendars = row_count;
  delete from public.events where deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_events = row_count;
  delete from public.sync_operations where created_at < now() - interval '30 days';
  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  delete from private.rate_limit_hits where created_at < now() - interval '1 day';
  return jsonb_build_object('calendars', v_calendars, 'events', v_events);
end;
$$;
