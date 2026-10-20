-- =====================================================================
-- Migration 6: regras de acesso (Row Level Security), permissões de
-- tabelas e funções, e publicação de tempo real.
--
-- Princípio: tudo começa FECHADO. Só é liberado o que o app precisa.
-- Usuários anônimos (sem login) não acessam nada (regra 1).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares adicionais para as regras
-- ---------------------------------------------------------------------
create or replace function private.can_comment(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.event_access(e.calendar_id, e.id, e.created_by, e.privacy) = 'full'
       and private.role_rank(private.calendar_role(e.calendar_id)) >= private.role_rank('collaborator')
       and private.calendar_is_writable(e.calendar_id)
    from public.events e
    where e.id = p_event_id and e.deleted_at is null
  ), false);
$$;

-- ---------------------------------------------------------------------
-- Liga o RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.devices enable row level security;
alter table public.calendars enable row level security;
alter table public.calendar_members enable row level security;
alter table public.invitations enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.recurrence_exceptions enable row level security;
alter table public.reminders enable row level security;
alter table public.comments enable row level security;
alter table public.sync_operations enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------
-- Perfis: vejo o meu e o de quem divide agenda comigo
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_calendar_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Preferências: só as minhas
-- ---------------------------------------------------------------------
create policy user_preferences_select_own on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_preferences_update_own on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy devices_select_own on public.devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy devices_delete_own on public.devices for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Agendas
-- ---------------------------------------------------------------------
create policy calendars_select on public.calendars for select to authenticated
  using (private.calendar_role(id) is not null or owner_id = (select auth.uid()));
create policy calendars_insert on public.calendars for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy calendars_update on public.calendars for update to authenticated
  using (private.calendar_role(id) in ('owner', 'admin'))
  with check (private.calendar_role(id) in ('owner', 'admin'));

-- Membros: vejo os membros das agendas em que estou. Só altero minhas
-- próprias preferências de aviso; o resto passa por funções do servidor.
create policy calendar_members_select on public.calendar_members for select to authenticated
  using (user_id = (select auth.uid()) or private.calendar_role(calendar_id) is not null);
create policy calendar_members_update_own on public.calendar_members for update to authenticated
  using (user_id = (select auth.uid()) and status = 'active')
  with check (user_id = (select auth.uid()));

-- Convites: nenhuma regra = nenhum acesso direto. Só via funções.

-- ---------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------
create policy events_select on public.events for select to authenticated
  using (
    private.event_access(calendar_id, id, created_by, privacy) = 'full'
    and (deleted_at is null or private.can_edit_event(calendar_id, created_by))
  );
create policy events_insert on public.events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.calendar_role(calendar_id) in ('owner', 'admin', 'editor', 'collaborator')
    and private.calendar_is_writable(calendar_id)
  );
create policy events_update on public.events for update to authenticated
  using (
    private.event_access(calendar_id, id, created_by, privacy) = 'full'
    and private.can_edit_event(calendar_id, created_by)
  )
  with check (
    private.can_edit_event(calendar_id, created_by)
    and private.event_access(calendar_id, id, created_by, privacy) = 'full'
  );

create policy recurrence_exceptions_select on public.recurrence_exceptions for select to authenticated
  using (private.event_access_by_id(event_id) = 'full');
create policy recurrence_exceptions_insert on public.recurrence_exceptions for insert to authenticated
  with check (private.can_edit_event_by_id(event_id));
create policy recurrence_exceptions_update on public.recurrence_exceptions for update to authenticated
  using (private.can_edit_event_by_id(event_id)) with check (private.can_edit_event_by_id(event_id));
create policy recurrence_exceptions_delete on public.recurrence_exceptions for delete to authenticated
  using (private.can_edit_event_by_id(event_id));

create policy event_attendees_select on public.event_attendees for select to authenticated
  using (private.event_access_by_id(event_id) = 'full');
create policy event_attendees_update_own on public.event_attendees for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy reminders_select_own on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy reminders_insert_own on public.reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and private.event_access_by_id(event_id) is not null);
create policy reminders_delete_own on public.reminders for delete to authenticated
  using (user_id = (select auth.uid()));

create policy comments_select on public.comments for select to authenticated
  using (private.event_access_by_id(event_id) = 'full');
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_comment(event_id));
create policy comments_update_own on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null and private.can_comment(event_id))
  with check (author_id = (select auth.uid()));

create policy sync_operations_select_own on public.sync_operations for select to authenticated
  using (user_id = (select auth.uid()));
create policy sync_operations_insert_own on public.sync_operations for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Histórico e avisos
-- ---------------------------------------------------------------------
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (
    private.calendar_role(calendar_id) is not null
    and (visibility = 'members'
         or private.calendar_role(calendar_id) in ('owner', 'admin')
         or actor_id = (select auth.uid()))
  );

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- audit_logs: sem regras. Ninguém lê pela API (só o painel do Supabase).

-- ---------------------------------------------------------------------
-- Permissões de tabela (camada extra além do RLS)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated, public;

grant select (id, display_name, avatar_color, avatar_url, created_at) on public.profiles to authenticated;
grant update (display_name, avatar_color) on public.profiles to authenticated;

grant select on public.user_preferences to authenticated;
grant update (locale, timezone, use_device_timezone, date_format, time_format, theme, week_starts_on)
  on public.user_preferences to authenticated;

grant select on public.notification_preferences to authenticated;
grant update (enabled, quiet_hours_start, quiet_hours_end, show_details_on_lock_screen,
  default_reminder_minutes, notify_invites, notify_event_changes, notify_member_changes,
  notify_comments, notify_reminders, sound, vibration)
  on public.notification_preferences to authenticated;

grant select (id, installation_id, platform, device_name, os_version, app_version, last_seen_at, created_at)
  on public.devices to authenticated;
grant delete on public.devices to authenticated;

grant select on public.calendars to authenticated;
grant insert (name, description, color, icon, kind, default_timezone, default_member_role,
  admins_can_invite, members_can_invite, editors_can_edit_all, allow_private_events,
  conflict_policy, notify_members_on_changes) on public.calendars to authenticated;
grant update (name, description, color, icon, kind, default_timezone, default_member_role,
  admins_can_invite, members_can_invite, editors_can_edit_all, allow_private_events,
  conflict_policy, notify_members_on_changes) on public.calendars to authenticated;

grant select on public.calendar_members to authenticated;
grant update (notifications_enabled) on public.calendar_members to authenticated;

grant select on public.events to authenticated;
grant insert (id, calendar_id, title, description, location, address, url, all_day, starts_at, ends_at,
  start_date, end_date, timezone, recurrence_rule, assignee_id, color, event_type, status, privacy,
  change_origin) on public.events to authenticated;
grant update (title, description, location, address, url, all_day, starts_at, ends_at, start_date,
  end_date, timezone, recurrence_rule, assignee_id, color, event_type, status, privacy, change_origin,
  deleted_at) on public.events to authenticated;

grant select, delete on public.recurrence_exceptions to authenticated;
grant insert (event_id, original_date, is_cancelled, title, description, location, starts_at, ends_at)
  on public.recurrence_exceptions to authenticated;
grant update (is_cancelled, title, description, location, starts_at, ends_at)
  on public.recurrence_exceptions to authenticated;

grant select on public.event_attendees to authenticated;
grant update (response) on public.event_attendees to authenticated;

grant select, delete on public.reminders to authenticated;
grant insert (event_id, user_id, minutes_before) on public.reminders to authenticated;

grant select on public.comments to authenticated;
grant insert (event_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

grant select, insert on public.sync_operations to authenticated;
grant select on public.activity_logs to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- Permissões de funções
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;

-- Funções auxiliares: precisam ser executáveis para as regras de acesso
-- funcionarem, mas o esquema "private" não é exposto pela API.
grant execute on all functions in schema private to authenticated;

grant execute on function
  public.get_my_account(),
  public.register_device(text, text, text, text, text),
  public.list_my_calendars(),
  public.set_calendar_state(uuid, text),
  public.duplicate_calendar(uuid, text, boolean),
  public.list_calendar_members(uuid),
  public.change_member_role(uuid, text),
  public.remove_member(uuid),
  public.leave_calendar(uuid),
  public.transfer_ownership(uuid, uuid),
  public.create_invitation(uuid, text, text, integer, integer),
  public.list_calendar_invitations(uuid),
  public.cancel_invitation(uuid),
  public.update_invitation_role(uuid, text),
  public.preview_invitation(text),
  public.accept_invitation(text),
  public.my_invitations(),
  public.respond_invitation(uuid, boolean),
  public.list_events(uuid[], timestamptz, timestamptz),
  public.search_events(text, uuid[], integer),
  public.apply_event_op(uuid, text, uuid, jsonb, integer, text),
  public.set_event_reminders(uuid, integer[]),
  public.set_event_attendees(uuid, uuid[]),
  public.list_event_comments(uuid),
  public.delete_comment(uuid),
  public.list_activity(uuid, uuid, integer, bigint),
  public.export_my_data(),
  public.account_deletion_impact(),
  public.delete_my_account(text)
to authenticated;

-- purge_trash: apenas para manutenção (service_role / painel).
revoke execute on function public.purge_trash(integer) from authenticated;

-- ---------------------------------------------------------------------
-- Tempo real: o app escuta histórico (mudanças nas agendas), avisos e
-- participações (para saber na hora se perdeu acesso). O Supabase
-- Realtime respeita o RLS acima: cada pessoa só recebe o que pode ver.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity_logs, public.notifications, public.calendar_members;
  end if;
end;
$$;
