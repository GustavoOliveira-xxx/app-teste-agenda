-- =====================================================================
-- Versão 3.0: tarefas, lembretes, listas, subtarefas, plano do dia,
-- anotações, hábitos, enquetes de horário e disponibilidade.
--
-- Decisões (detalhes em DECISOES.md, D30 a D38):
--   * Tarefas e lembretes independentes ficam na mesma tabela "tasks"
--     (coluna item_type), porque compartilham prazo, recorrência, alertas,
--     listas, sincronização e permissões. Eventos continuam em "events".
--   * Toda escrita passa por public.apply_item_op (SECURITY DEFINER), que
--     confere a permissão de cada operação. O app só tem leitura direta.
--   * Recorrência de tarefa não cria registros futuros: a tarefa guarda a
--     próxima data (due_date) e cada conclusão vira uma linha de histórico.
--   * Nada da versão 2.0 é apagado ou convertido. Eventos dos tipos
--     "task" e "reminder" continuam eventos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Preferências novas
-- ---------------------------------------------------------------------
alter table public.user_preferences
  add column if not exists daily_checkin boolean not null default true,
  add column if not exists share_availability boolean not null default false,
  add column if not exists day_start time not null default '08:00',
  add column if not exists day_end time not null default '22:00';
alter table public.user_preferences drop constraint if exists user_preferences_day_window;
alter table public.user_preferences
  add constraint user_preferences_day_window check (day_end > day_start);
grant update (daily_checkin, share_availability, day_start, day_end) on public.user_preferences to authenticated;

alter table public.notification_preferences
  add column if not exists notify_tasks boolean not null default true;
grant update (notify_tasks) on public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------
-- 2. Funções auxiliares
-- ---------------------------------------------------------------------

-- Lista JSON de textos para text[] (null quando não é lista).
create or replace function private.jsonb_text_array(p jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case when p is null or jsonb_typeof(p) <> 'array' then null
              else array(select jsonb_array_elements_text(p)) end;
$$;

-- Pode criar conteúdo nesta agenda? (null = item pessoal)
create or replace function private.can_create_in(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_calendar_id is null then true
    else coalesce(private.calendar_role(p_calendar_id) in ('owner', 'admin', 'editor', 'collaborator'), false)
         and private.calendar_is_writable(p_calendar_id)
  end;
$$;

-- Pode editar um item criado por p_created_by? Itens pessoais: só quem criou.
-- Itens de agenda: mesma regra dos eventos (papel, agenda ativa).
create or replace function private.can_edit_item(p_calendar_id uuid, p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_calendar_id is null then coalesce(p_created_by = auth.uid(), false)
    else private.can_edit_event(p_calendar_id, p_created_by)
  end;
$$;

-- ---------------------------------------------------------------------
-- 3. Recorrência de tarefas (mesmo subconjunto de RRULE dos eventos)
-- Espelha src/utils/recurrence.ts (seriesDates). Testes dos dois lados
-- usam os mesmos casos.
-- ---------------------------------------------------------------------
create or replace function private.rrule_part(p_rule text, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substring(p_rule from '(?:^|;)' || p_name || '=([^;]+)');
$$;

-- Primeira data da série estritamente depois de p_after (sem UNTIL/COUNT).
create or replace function private.rrule_after(p_rule text, p_start date, p_after date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_freq text := private.rrule_part(p_rule, 'FREQ');
  v_int integer := coalesce(private.rrule_part(p_rule, 'INTERVAL')::integer, 1);
  v_byday text := private.rrule_part(p_rule, 'BYDAY');
  v_bymd integer := private.rrule_part(p_rule, 'BYMONTHDAY')::integer;
  v_from date := greatest(p_after + 1, p_start);
  v_sy integer := extract(year from p_start)::integer;
  v_sm integer := extract(month from p_start)::integer;
  v_sd integer := extract(day from p_start)::integer;
  v_offsets integer[];
  v_off integer;
  v_ws date;
  v_w integer;
  v_m integer;
  v_total integer;
  v_y integer;
  v_mo integer;
  v_day integer;
  v_d date;
  i integer;
begin
  if p_rule is null or p_start is null or p_after is null then
    return null;
  end if;

  if v_freq = 'DAILY' then
    return p_start + (ceil((v_from - p_start)::numeric / v_int)::integer * v_int);
  end if;

  if v_freq = 'WEEKLY' then
    if v_byday is null then
      v_offsets := array[extract(isodow from p_start)::integer - 1];
    else
      select array_agg(distinct x order by x) into v_offsets
      from (
        select case d when 'MO' then 0 when 'TU' then 1 when 'WE' then 2 when 'TH' then 3
                      when 'FR' then 4 when 'SA' then 5 else 6 end as x
        from unnest(string_to_array(v_byday, ',')) as d
      ) s;
    end if;
    v_ws := p_start - (extract(isodow from p_start)::integer - 1);
    v_w := greatest(0, floor((v_from - v_ws)::numeric / 7 / v_int)::integer - 1);
    for i in 1..1000 loop
      foreach v_off in array v_offsets loop
        v_d := v_ws + (v_w * v_int * 7) + v_off;
        if v_d >= v_from then
          return v_d;
        end if;
      end loop;
      v_w := v_w + 1;
    end loop;
    return null;
  end if;

  if v_freq = 'MONTHLY' then
    v_day := coalesce(v_bymd, v_sd);
    v_m := greatest(0, ((extract(year from v_from)::integer - v_sy) * 12
                        + extract(month from v_from)::integer - v_sm) / v_int - 1);
    for i in 1..400 loop
      v_total := v_sm - 1 + v_m * v_int;
      v_y := v_sy + v_total / 12;
      v_mo := v_total % 12 + 1;
      -- Meses sem o dia (ex.: 31) são pulados, como na RFC 5545.
      if v_day <= extract(day from (make_date(v_y, v_mo, 1) + interval '1 month - 1 day'))::integer then
        v_d := make_date(v_y, v_mo, v_day);
        if v_d >= v_from then
          return v_d;
        end if;
      end if;
      v_m := v_m + 1;
    end loop;
    return null;
  end if;

  if v_freq = 'YEARLY' then
    v_y := greatest(0, (extract(year from v_from)::integer - v_sy) / v_int - 1);
    for i in 1..400 loop
      v_total := v_sy + v_y * v_int;
      if v_sd <= extract(day from (make_date(v_total, v_sm, 1) + interval '1 month - 1 day'))::integer then
        v_d := make_date(v_total, v_sm, v_sd);
        if v_d >= v_from then
          return v_d;
        end if;
      end if;
      v_y := v_y + 1;
    end loop;
  end if;
  return null;
end;
$$;

-- Próxima data da série depois de p_after, respeitando UNTIL e COUNT.
create or replace function private.rrule_next(p_rule text, p_start date, p_after date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_next date := private.rrule_after(p_rule, p_start, p_after);
  v_until text := private.rrule_part(p_rule, 'UNTIL');
  v_count integer := private.rrule_part(p_rule, 'COUNT')::integer;
  v_d date;
  v_n integer := 0;
begin
  if v_next is null then
    return null;
  end if;
  if v_until is not null and v_next > to_date(left(v_until, 8), 'YYYYMMDD') then
    return null;
  end if;
  if v_count is not null then
    v_d := p_start - 1;
    loop
      v_d := private.rrule_after(p_rule, p_start, v_d);
      exit when v_d is null;
      v_n := v_n + 1;
      if v_n > v_count then
        return null;
      end if;
      exit when v_d >= v_next;
    end loop;
  end if;
  return v_next;
end;
$$;

-- Repetição "depois da conclusão": soma o intervalo à data de conclusão.
create or replace function private.rrule_add(p_rule text, p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case private.rrule_part(p_rule, 'FREQ')
    when 'DAILY' then p_day + coalesce(private.rrule_part(p_rule, 'INTERVAL')::integer, 1)
    when 'WEEKLY' then p_day + 7 * coalesce(private.rrule_part(p_rule, 'INTERVAL')::integer, 1)
    when 'MONTHLY' then (p_day + make_interval(months => coalesce(private.rrule_part(p_rule, 'INTERVAL')::integer, 1)))::date
    when 'YEARLY' then (p_day + make_interval(years => coalesce(private.rrule_part(p_rule, 'INTERVAL')::integer, 1)))::date
  end;
$$;

-- ---------------------------------------------------------------------
-- 4. Listas de tarefas
-- calendar_id null = lista pessoal (só quem criou vê).
-- calendar_id preenchido = lista compartilhada com os membros da agenda.
-- ---------------------------------------------------------------------
create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text check (icon is null or char_length(icon) <= 40),
  position double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists task_lists_calendar_idx on public.task_lists (calendar_id) where deleted_at is null;
create index if not exists task_lists_owner_idx on public.task_lists (created_by) where calendar_id is null;

-- ---------------------------------------------------------------------
-- 5. Tarefas e lembretes
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  item_type text not null default 'task' check (item_type in ('task', 'reminder')),
  calendar_id uuid references public.calendars (id) on delete cascade,
  list_id uuid references public.task_lists (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  links text[] not null default '{}' check (cardinality(links) <= 5),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  start_date date,
  due_date date,
  due_time time,
  timezone text not null default 'America/Sao_Paulo',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 5 and 1440),
  -- 0 sem prioridade, 1 baixa, 2 média, 3 alta, 4 urgente
  priority smallint not null default 0 check (priority between 0 and 4),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'waiting', 'done', 'cancelled')),
  recurrence_rule text check (recurrence_rule is null or (char_length(recurrence_rule) <= 200 and recurrence_rule ~
    '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;(INTERVAL=[1-9][0-9]?|BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*|BYMONTHDAY=([1-9]|[12][0-9]|3[01])|UNTIL=[0-9]{8}|COUNT=[1-9][0-9]{0,2}))*$')),
  -- calendar: datas da regra ("todo dia 5"); completion: N após a última conclusão.
  recurrence_mode text not null default 'calendar' check (recurrence_mode in ('calendar', 'completion')),
  recurrence_start date,
  assignee_id uuid references public.profiles (id) on delete set null,
  privacy text not null default 'members' check (privacy in ('members', 'participants', 'private')),
  position double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  change_origin text not null default 'app' check (change_origin in ('app', 'offline_sync', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (due_time is null or due_date is not null),
  check (recurrence_rule is null or due_date is not null),
  check (start_date is null or due_date is null or start_date <= due_date)
);
create index if not exists tasks_calendar_idx on public.tasks (calendar_id) where deleted_at is null;
create index if not exists tasks_personal_idx on public.tasks (created_by) where calendar_id is null and deleted_at is null;
create index if not exists tasks_assignee_idx on public.tasks (assignee_id) where deleted_at is null;
create index if not exists tasks_list_idx on public.tasks (list_id);
create index if not exists tasks_due_idx on public.tasks (due_date) where deleted_at is null and status in ('pending', 'in_progress', 'waiting');

create table if not exists public.task_participants (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists task_participants_user_idx on public.task_participants (user_id);

-- Subtarefas (etapas). A tarefa principal NÃO é concluída sozinha quando
-- todas as etapas terminam: o app pergunta (a pessoa decide).
create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_checklist_task_idx on public.task_checklist_items (task_id, position);

-- Histórico de conclusões. Em tarefas recorrentes, uma linha por ocorrência
-- (chave única): dois aparelhos concluindo a mesma ocorrência não duplicam.
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  occurrence_date date,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (task_id, occurrence_date)
);
create index if not exists task_completions_task_idx on public.task_completions (task_id, completed_at desc);

-- Alertas pessoais (cada pessoa escolhe os seus), em minutos antes do prazo.
-- Sem horário no prazo, a base é 9h do dia do prazo, no fuso da tarefa.
create table if not exists public.task_alerts (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  minutes_before integer not null check (minutes_before between 0 and 40320),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id, minutes_before)
);
create index if not exists task_alerts_user_idx on public.task_alerts (user_id);

-- "Meu dia": tarefas que a pessoa pretende fazer num dia (pessoal).
create table if not exists public.task_plans (
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
create index if not exists task_plans_day_idx on public.task_plans (user_id, day);

-- Dias em que a pessoa já respondeu "O que você pretende fazer hoje?".
create table if not exists public.daily_checkins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) <= 2000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (deleted_at is not null or char_length(btrim(body)) >= 1)
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

-- ---------------------------------------------------------------------
-- 6. Anotações e hábitos
-- ---------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars (id) on delete cascade,
  title text check (title is null or char_length(btrim(title)) between 1 and 150),
  body text not null default '' check (char_length(body) <= 20000),
  pinned boolean not null default false,
  event_id uuid references public.events (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (title is not null or char_length(btrim(body)) > 0)
);
create index if not exists notes_calendar_idx on public.notes (calendar_id) where deleted_at is null;
create index if not exists notes_personal_idx on public.notes (created_by) where calendar_id is null;

-- Hábitos e rotinas: frequência pela mesma RRULE (sem prazo nem obrigação).
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  recurrence_rule text not null check (char_length(recurrence_rule) <= 200 and recurrence_rule ~
    '^FREQ=(DAILY|WEEKLY|MONTHLY)(;(INTERVAL=[1-9][0-9]?|BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*|BYMONTHDAY=([1-9]|[12][0-9]|3[01])))*$'),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  show_streak boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists habits_calendar_idx on public.habits (calendar_id) where deleted_at is null;
create index if not exists habits_personal_idx on public.habits (created_by) where calendar_id is null;

create table if not exists public.habit_logs (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, user_id, day)
);
create index if not exists habit_logs_day_idx on public.habit_logs (habit_id, day desc);

-- ---------------------------------------------------------------------
-- 7. Enquetes de horário ("Encontrar horário")
-- ---------------------------------------------------------------------
create table if not exists public.availability_polls (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 1000),
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'open' check (status in ('open', 'closed', 'scheduled')),
  closes_at timestamptz,
  chosen_option_id uuid,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists availability_polls_calendar_idx on public.availability_polls (calendar_id, created_at desc);

create table if not exists public.availability_poll_participants (
  poll_id uuid not null references public.availability_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (poll_id, user_id)
);
create index if not exists availability_poll_participants_user_idx on public.availability_poll_participants (user_id);

create table if not exists public.availability_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.availability_polls (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create index if not exists availability_poll_options_poll_idx on public.availability_poll_options (poll_id, starts_at);

create table if not exists public.availability_poll_votes (
  option_id uuid not null references public.availability_poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

-- ---------------------------------------------------------------------
-- 8. Histórico de tarefas, listas, anotações, hábitos e enquetes
-- Itens pessoais: calendar_id null e owner_id = dona. Detalhes nunca
-- trazem título de item que não seja visível a todos.
-- ---------------------------------------------------------------------
create table if not exists public.item_activity (
  id bigint generated always as identity primary key,
  calendar_id uuid references public.calendars (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete cascade,
  entity text not null check (entity in ('task', 'list', 'note', 'habit', 'poll')),
  entity_id uuid not null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('created', 'updated', 'completed', 'reopened', 'rescheduled',
    'assigned', 'deleted', 'restored', 'commented', 'moved', 'voted', 'closed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (calendar_id is not null or owner_id is not null)
);
create index if not exists item_activity_entity_idx on public.item_activity (entity_id, created_at desc);
create index if not exists item_activity_calendar_idx on public.item_activity (calendar_id, created_at desc);
create index if not exists item_activity_owner_idx on public.item_activity (owner_id, created_at desc);

-- ---------------------------------------------------------------------
-- 9. Eventos: bloco de tempo de uma tarefa e identificador externo (ICS)
-- ---------------------------------------------------------------------
alter table public.events add column if not exists task_id uuid references public.tasks (id) on delete set null;
alter table public.events add column if not exists external_uid text
  check (external_uid is null or char_length(external_uid) <= 255);
create index if not exists events_task_idx on public.events (task_id) where task_id is not null;
create unique index if not exists events_external_uid_idx
  on public.events (calendar_id, external_uid) where external_uid is not null and deleted_at is null;
grant insert (task_id, external_uid) on public.events to authenticated;
grant update (task_id) on public.events to authenticated;

-- ---------------------------------------------------------------------
-- 10. Regras de acesso
-- ---------------------------------------------------------------------

-- Acesso de uma pessoa (p_uid, com papel p_role na agenda) a uma tarefa.
create or replace function private.task_access_for(
  p_uid uuid, p_role text, p_calendar_id uuid, p_task_id uuid, p_created_by uuid,
  p_assignee uuid, p_privacy text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_uid is null then
    return false;
  end if;
  -- Tarefa pessoal: só quem criou. Dividir outra agenda não dá acesso.
  if p_calendar_id is null then
    return coalesce(p_created_by = p_uid, false);
  end if;
  if p_role is null then
    return false;
  end if;
  if p_created_by = p_uid or p_assignee = p_uid or p_privacy = 'members' then
    return true;
  end if;
  if p_privacy = 'participants' then
    return p_role in ('owner', 'admin') or exists (
      select 1 from public.task_participants p where p.task_id = p_task_id and p.user_id = p_uid);
  end if;
  return false;
end;
$$;

create or replace function private.task_access(
  p_calendar_id uuid, p_task_id uuid, p_created_by uuid, p_assignee uuid, p_privacy text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.task_access_for(auth.uid(),
    case when p_calendar_id is null then null else private.calendar_role(p_calendar_id) end,
    p_calendar_id, p_task_id, p_created_by, p_assignee, p_privacy);
$$;

-- Visível (inclusive na lixeira, para quem pode restaurar).
create or replace function private.task_visible(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.task_access(t.calendar_id, t.id, t.created_by, t.assignee_id, t.privacy)
       and (t.deleted_at is null or private.can_edit_item(t.calendar_id, t.created_by))
    from public.tasks t where t.id = p_task_id), false);
$$;

create or replace function private.list_visible(p_calendar_id uuid, p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_calendar_id is null then coalesce(p_created_by = auth.uid(), false)
    else private.calendar_role(p_calendar_id) is not null
  end;
$$;

create or replace function private.poll_visible(p_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.calendar_role(p.calendar_id) is not null
       and (p.created_by = auth.uid()
            or private.calendar_role(p.calendar_id) in ('owner', 'admin')
            or exists (select 1 from public.availability_poll_participants x
                       where x.poll_id = p.id and x.user_id = auth.uid()))
    from public.availability_polls p where p.id = p_poll_id), false);
$$;

alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_participants enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_completions enable row level security;
alter table public.task_alerts enable row level security;
alter table public.task_plans enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.task_comments enable row level security;
alter table public.notes enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.availability_polls enable row level security;
alter table public.availability_poll_participants enable row level security;
alter table public.availability_poll_options enable row level security;
alter table public.availability_poll_votes enable row level security;
alter table public.item_activity enable row level security;

create policy task_lists_select on public.task_lists for select to authenticated
  using (private.list_visible(calendar_id, created_by));
create policy tasks_select on public.tasks for select to authenticated
  using (private.task_access(calendar_id, id, created_by, assignee_id, privacy)
         and (deleted_at is null or private.can_edit_item(calendar_id, created_by)));
create policy task_participants_select on public.task_participants for select to authenticated
  using (private.task_visible(task_id));
create policy task_checklist_select on public.task_checklist_items for select to authenticated
  using (private.task_visible(task_id));
create policy task_completions_select on public.task_completions for select to authenticated
  using (private.task_visible(task_id));
create policy task_comments_select on public.task_comments for select to authenticated
  using (private.task_visible(task_id));
create policy task_alerts_select_own on public.task_alerts for select to authenticated
  using (user_id = (select auth.uid()));
create policy task_plans_select_own on public.task_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy daily_checkins_select_own on public.daily_checkins for select to authenticated
  using (user_id = (select auth.uid()));
create policy notes_select on public.notes for select to authenticated
  using (private.list_visible(calendar_id, created_by) and deleted_at is null);
create policy habits_select on public.habits for select to authenticated
  using (private.list_visible(calendar_id, created_by) and deleted_at is null);
create policy habit_logs_select on public.habit_logs for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id
                 and private.list_visible(h.calendar_id, h.created_by)));
create policy availability_polls_select on public.availability_polls for select to authenticated
  using (private.poll_visible(id));
create policy availability_poll_participants_select on public.availability_poll_participants for select to authenticated
  using (private.poll_visible(poll_id));
create policy availability_poll_options_select on public.availability_poll_options for select to authenticated
  using (private.poll_visible(poll_id));
create policy availability_poll_votes_select on public.availability_poll_votes for select to authenticated
  using (exists (select 1 from public.availability_poll_options o where o.id = option_id
                 and private.poll_visible(o.poll_id)));
create policy item_activity_select on public.item_activity for select to authenticated
  using (
    (calendar_id is null and owner_id = (select auth.uid()))
    or (calendar_id is not null and private.calendar_role(calendar_id) is not null
        and (entity <> 'task' or private.task_visible(entity_id)))
  );

-- Tudo fechado por padrão; leitura direta liberada, escrita só por funções.
revoke all on public.task_lists, public.tasks, public.task_participants, public.task_checklist_items,
  public.task_completions, public.task_alerts, public.task_plans, public.daily_checkins,
  public.task_comments, public.notes, public.habits, public.habit_logs, public.availability_polls,
  public.availability_poll_participants, public.availability_poll_options,
  public.availability_poll_votes, public.item_activity
  from anon, authenticated;
grant select on public.task_lists, public.tasks, public.task_participants, public.task_checklist_items,
  public.task_completions, public.task_alerts, public.task_plans, public.daily_checkins,
  public.task_comments, public.notes, public.habits, public.habit_logs, public.availability_polls,
  public.availability_poll_participants, public.availability_poll_options,
  public.availability_poll_votes, public.item_activity
  to authenticated;

-- ---------------------------------------------------------------------
-- 11. Validação (gatilhos)
-- ---------------------------------------------------------------------
create or replace function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_list public.task_lists;
  v_cal public.calendars;
  v_link text;
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.links := array(select btrim(x) from unnest(coalesce(new.links, '{}')) x where btrim(x) <> '');
  foreach v_link in array new.links loop
    if char_length(v_link) > 2048 or v_link !~* '^https?://[^\s]+$' then
      raise exception 'INVALID_LINK' using errcode = 'P0001';
    end if;
  end loop;
  -- Etiquetas: minúsculas, sem "#", sem repetição.
  new.tags := array(select distinct lower(btrim(ltrim(btrim(x), '#'))) from unnest(coalesce(new.tags, '{}')) x
                    where btrim(ltrim(btrim(x), '#')) <> '' order by 1);
  if exists (select 1 from unnest(new.tags) x where char_length(x) > 30) or cardinality(new.tags) > 10 then
    raise exception 'INVALID_TAG' using errcode = 'P0001';
  end if;
  if not private.is_valid_timezone(new.timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;
  if new.recurrence_rule is not null and new.recurrence_rule like '%UNTIL=%' and new.recurrence_rule like '%COUNT=%' then
    raise exception 'INVALID_RECURRENCE' using errcode = 'P0001';
  end if;
  if new.recurrence_mode = 'completion' and new.recurrence_rule is not null
     and (new.recurrence_rule like '%BYDAY=%' or new.recurrence_rule like '%BYMONTHDAY=%'
          or new.recurrence_rule like '%UNTIL=%' or new.recurrence_rule like '%COUNT=%') then
    raise exception 'INVALID_RECURRENCE' using errcode = 'P0001';
  end if;
  -- Início da série: a primeira data de prazo com a regra atual.
  if new.recurrence_rule is null then
    new.recurrence_start := null;
  elsif tg_op = 'INSERT' or old.recurrence_rule is distinct from new.recurrence_rule
        or old.recurrence_start is null or old.recurrence_mode is distinct from new.recurrence_mode then
    new.recurrence_start := new.due_date;
  end if;

  if new.list_id is not null and (tg_op = 'INSERT' or new.list_id is distinct from old.list_id
                                  or new.calendar_id is distinct from old.calendar_id) then
    select * into v_list from public.task_lists l where l.id = new.list_id;
    if v_list.id is null or v_list.deleted_at is not null
       or v_list.calendar_id is distinct from new.calendar_id then
      raise exception 'LIST_MISMATCH' using errcode = 'P0001';
    end if;
  end if;

  if new.calendar_id is null then
    -- Item pessoal: responsável só pode ser a própria dona; sem privacidade especial.
    if new.assignee_id is not null and new.assignee_id is distinct from new.created_by then
      raise exception 'INVALID_ASSIGNEE' using errcode = 'P0001';
    end if;
    new.privacy := 'members';
  else
    if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
       and not exists (select 1 from public.calendar_members m where m.calendar_id = new.calendar_id
                       and m.user_id = new.assignee_id and m.status = 'active') then
      raise exception 'INVALID_ASSIGNEE' using errcode = 'P0001';
    end if;
    select * into v_cal from public.calendars c where c.id = new.calendar_id;
    if new.privacy = 'private' and (tg_op = 'INSERT' or old.privacy is distinct from 'private')
       and not coalesce(v_cal.allow_private_events, false) then
      raise exception 'PRIVATE_EVENTS_DISABLED' using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;

  if tg_op = 'INSERT' then
    new.updated_by := new.created_by;
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
    new.deleted_at := null;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    if auth.uid() is not null and exists (select 1 from public.profiles p where p.id = auth.uid()) then
      new.updated_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Versão e autoria das listas, anotações e hábitos.
create or replace function private.items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.updated_by := new.created_by;
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
    new.deleted_at := null;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    if auth.uid() is not null and exists (select 1 from public.profiles p where p.id = auth.uid()) then
      new.updated_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger task_lists_before_write
  before insert or update on public.task_lists
  for each row execute function private.items_before_write();
create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function private.items_before_write();
create trigger habits_before_write
  before insert or update on public.habits
  for each row execute function private.items_before_write();

-- Evento ligado a uma tarefa: a pessoa precisa conseguir ver a tarefa.
create or replace function private.events_task_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_id is not null and auth.uid() is not null
     and (tg_op = 'INSERT' or new.task_id is distinct from old.task_id)
     and not private.task_visible(new.task_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger events_x_task_link
  before insert or update on public.events
  for each row execute function private.events_task_link();

-- ---------------------------------------------------------------------
-- 12. Histórico e avisos dos itens
-- ---------------------------------------------------------------------
create or replace function private.log_item(
  p_calendar_id uuid, p_owner_id uuid, p_entity text, p_entity_id uuid, p_action text,
  p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.item_activity (calendar_id, owner_id, entity, entity_id, actor_id, action, details)
  values (p_calendar_id, case when p_calendar_id is null then p_owner_id end, p_entity, p_entity_id,
          auth.uid(), p_action, coalesce(p_details, '{}'::jsonb));
$$;

-- Novos tipos de aviso.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invite_received', 'invite_accepted', 'invite_declined',
  'event_created', 'event_updated', 'event_cancelled', 'event_deleted',
  'member_added', 'member_removed', 'role_changed', 'ownership_received',
  'comment_added', 'task_assigned', 'task_completed', 'task_comment', 'poll_created', 'poll_closed'));

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
      when p_type in ('event_created', 'event_updated', 'event_cancelled', 'event_deleted',
                      'poll_created', 'poll_closed') then v_prefs.notify_event_changes
      when p_type in ('member_added', 'member_removed', 'role_changed', 'ownership_received') then v_prefs.notify_member_changes
      when p_type = 'comment_added' then v_prefs.notify_comments
      when p_type in ('task_assigned', 'task_completed', 'task_comment') then v_prefs.notify_tasks
      else true end;
    if not v_wants and p_type not in ('member_removed', 'role_changed', 'ownership_received') then
      return;
    end if;
  end if;
  insert into public.notifications (user_id, type, calendar_id, event_id, actor_id, title, body, data)
  values (p_user_id, p_type, p_calendar_id, p_event_id, p_actor_id, left(p_title, 200), left(p_body, 500),
          coalesce(p_data, '{}'::jsonb));
end;
$$;

-- Aviso sobre uma tarefa para uma pessoa, se ela ainda puder ver a tarefa
-- e não tiver desligado os avisos daquela agenda.
create or replace function private.notify_task(p_user_id uuid, p_task public.tasks, p_type text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.calendar_members;
begin
  if p_user_id is null or p_user_id = auth.uid() or p_task.calendar_id is null then
    return;
  end if;
  select * into v_member from public.calendar_members m
   where m.calendar_id = p_task.calendar_id and m.user_id = p_user_id and m.status = 'active';
  if v_member.id is null or not v_member.notifications_enabled then
    return;
  end if;
  if not private.task_access_for(p_user_id, v_member.role, p_task.calendar_id, p_task.id,
                                 p_task.created_by, p_task.assignee_id, p_task.privacy) then
    return;
  end if;
  perform private.notify(p_user_id, p_type, p_task.calendar_id, null, auth.uid(), p_title, p_body,
    jsonb_build_object('task_id', p_task.id));
end;
$$;

-- ---------------------------------------------------------------------
-- 13. Leitura em JSON
-- ---------------------------------------------------------------------
create or replace function private.task_json(p_task_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(t) || jsonb_build_object(
    'checklist', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'done', c.done, 'done_at', c.done_at,
                                          'done_by', c.done_by, 'position', c.position)
                       order by c.position, c.created_at)
      from public.task_checklist_items c where c.task_id = t.id), '[]'::jsonb),
    'participant_ids', coalesce((
      select jsonb_agg(p.user_id order by p.user_id) from public.task_participants p where p.task_id = t.id), '[]'::jsonb),
    'my_alerts', coalesce((
      select jsonb_agg(a.minutes_before order by a.minutes_before)
      from public.task_alerts a where a.task_id = t.id and a.user_id = auth.uid()), '[]'::jsonb),
    'plan_day', (select pl.day from public.task_plans pl where pl.task_id = t.id and pl.user_id = auth.uid()),
    'last_completed_at', (select max(x.completed_at) from public.task_completions x where x.task_id = t.id),
    'comment_count', (select count(*) from public.task_comments cm where cm.task_id = t.id and cm.deleted_at is null))
  from public.tasks t where t.id = p_task_id;
$$;

create or replace function private.habit_json(p_habit_id uuid, p_since date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(h) || jsonb_build_object('logs', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', l.user_id, 'day', l.day) order by l.day desc)
    from public.habit_logs l where l.habit_id = h.id and l.day >= p_since), '[]'::jsonb))
  from public.habits h where h.id = p_habit_id;
$$;

-- Tudo o que o app guarda no aparelho: listas, tarefas abertas (e as
-- concluídas desde p_done_since), anotações, hábitos e dias já planejados.
create or replace function public.list_my_items(p_done_since timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_since timestamptz := coalesce(p_done_since, now() - interval '30 days');
  v_log_since date := current_date - 70;
begin
  return jsonb_build_object(
    'lists', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.position, l.created_at)
      from public.task_lists l
      where l.deleted_at is null and private.list_visible(l.calendar_id, l.created_by)), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(private.task_json(t.id))
      from (
        select t.id from public.tasks t
        left join public.calendar_members m
          on m.calendar_id = t.calendar_id and m.user_id = v_uid and m.status = 'active'
        left join public.calendars c on c.id = t.calendar_id
        where t.deleted_at is null
          and (t.status not in ('done', 'cancelled') or t.updated_at >= v_since)
          and ((t.calendar_id is null and t.created_by = v_uid)
               or (m.id is not null and c.deleted_at is null
                   and private.task_access_for(v_uid, m.role, t.calendar_id, t.id, t.created_by, t.assignee_id, t.privacy)))
        order by t.position
        limit 3000) t), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.pinned desc, n.updated_at desc)
      from (select * from public.notes n
            where n.deleted_at is null and private.list_visible(n.calendar_id, n.created_by)
            order by n.updated_at desc limit 1000) n), '[]'::jsonb),
    'habits', coalesce((
      select jsonb_agg(private.habit_json(h.id, v_log_since))
      from public.habits h
      where h.deleted_at is null and private.list_visible(h.calendar_id, h.created_by)), '[]'::jsonb),
    'checkins', coalesce((
      select jsonb_agg(d.day order by d.day desc)
      from (select day from public.daily_checkins where user_id = v_uid order by day desc limit 14) d), '[]'::jsonb));
end;
$$;

-- Concluídas mais antigas (visão "Concluídas", página por página).
create or replace function public.list_done_tasks(p_before timestamptz default null, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.task_json(x.id) order by x.updated_at desc), '[]'::jsonb)
  from (
    select t.id, t.updated_at from public.tasks t
    where t.deleted_at is null and t.status in ('done', 'cancelled')
      and (p_before is null or t.updated_at < p_before)
      and private.task_access(t.calendar_id, t.id, t.created_by, t.assignee_id, t.privacy)
    order by t.updated_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)) x;
$$;

-- Histórico de uma tarefa: conclusões e alterações, com nomes.
create or replace function public.list_task_history(p_task_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.task_visible(p_task_id) then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x ->> 'at' desc) from (
      select jsonb_build_object('kind', 'activity', 'action', a.action, 'details', a.details,
               'at', a.created_at, 'actor_name', private.display_name(a.actor_id)) as x
      from public.item_activity a where a.entity_id = p_task_id
      union all
      select jsonb_build_object('kind', 'completion', 'occurrence_date', c.occurrence_date,
               'at', c.completed_at, 'actor_name', private.display_name(c.completed_by))
      from public.task_completions c where c.task_id = p_task_id
      order by 1
      limit 300) s), '[]'::jsonb) end;
$$;

-- ---------------------------------------------------------------------
-- 14. Escrita: uma função por tipo de item, chamadas por apply_item_op
-- ---------------------------------------------------------------------

create or replace function private.task_set_participants(p_task public.tasks, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_ids, '{}'::uuid[]);
begin
  if p_task.calendar_id is null and cardinality(v_ids) > 0 then
    raise exception 'INVALID_PARTICIPANT' using errcode = 'P0001';
  end if;
  if cardinality(v_ids) > 50 then
    raise exception 'TOO_MANY_PARTICIPANTS' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(v_ids) u(id) where not exists (
      select 1 from public.calendar_members m
      where m.calendar_id = p_task.calendar_id and m.user_id = u.id and m.status = 'active')) then
    raise exception 'INVALID_PARTICIPANT' using errcode = 'P0001';
  end if;
  delete from public.task_participants where task_id = p_task.id and user_id <> all (v_ids);
  insert into public.task_participants (task_id, user_id, added_by)
  select distinct p_task.id, u, auth.uid() from unnest(v_ids) u
  on conflict do nothing;
end;
$$;

create or replace function private.task_set_alerts(p_task_id uuid, p_minutes integer[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_minutes), 0) > 5 then
    raise exception 'TOO_MANY_REMINDERS' using errcode = 'P0001';
  end if;
  delete from public.task_alerts where task_id = p_task_id and user_id = auth.uid();
  insert into public.task_alerts (task_id, user_id, minutes_before)
  select distinct p_task_id, auth.uid(), m from unnest(coalesce(p_minutes, '{}'::integer[])) m;
end;
$$;

create or replace function private.task_set_plan(p_task_id uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_day is null then
    delete from public.task_plans where task_id = p_task_id and user_id = auth.uid();
  else
    insert into public.task_plans (user_id, task_id, day) values (auth.uid(), p_task_id, p_day)
    on conflict (user_id, task_id) do update set day = excluded.day, created_at = now();
  end if;
end;
$$;

create or replace function private.task_checklist_upsert(p_task public.tasks, p jsonb, p_can_edit boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_item public.task_checklist_items;
begin
  if v_id is null then
    raise exception 'INVALID_DATA' using errcode = 'P0001';
  end if;
  select * into v_item from public.task_checklist_items where id = v_id;
  if v_item.id is not null and v_item.task_id <> p_task.id then
    raise exception 'DUPLICATE_ID' using errcode = 'P0001';
  end if;
  if v_item.id is null or p ? 'title' or p ? 'position' then
    if not p_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;
  if v_item.id is null then
    if (select count(*) from public.task_checklist_items where task_id = p_task.id) >= 100 then
      raise exception 'TOO_MANY_ITEMS' using errcode = 'P0001';
    end if;
    insert into public.task_checklist_items (id, task_id, title, done, done_at, done_by, position)
    values (v_id, p_task.id, btrim(p ->> 'title'), coalesce((p ->> 'done')::boolean, false),
            case when coalesce((p ->> 'done')::boolean, false) then now() end,
            case when coalesce((p ->> 'done')::boolean, false) then auth.uid() end,
            coalesce((p ->> 'position')::double precision, extract(epoch from clock_timestamp())));
  else
    update public.task_checklist_items c set
      title = case when p ? 'title' then btrim(p ->> 'title') else c.title end,
      position = case when p ? 'position' then (p ->> 'position')::double precision else c.position end,
      done = case when p ? 'done' then (p ->> 'done')::boolean else c.done end,
      done_at = case when p ? 'done' and (p ->> 'done')::boolean and not c.done then now()
                     when p ? 'done' and not (p ->> 'done')::boolean then null else c.done_at end,
      done_by = case when p ? 'done' and (p ->> 'done')::boolean and not c.done then auth.uid()
                     when p ? 'done' and not (p ->> 'done')::boolean then null else c.done_by end,
      updated_at = now()
    where c.id = v_id;
  end if;
end;
$$;

create or replace function private.task_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer, p_origin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cur public.tasks;
  v_row public.tasks;
  v_cal uuid;
  v_can_edit boolean;
  v_can_complete boolean;
  v_date date;
  v_next date;
  v_cid uuid;
  v_key text;
  v_changed text[] := '{}';
  v_public boolean;
  v_details jsonb;
  v_item jsonb;
begin
  if p_kind = 'create' then
    v_cal := (p ->> 'calendar_id')::uuid;
    if not private.can_create_in(v_cal) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    insert into public.tasks (id, item_type, calendar_id, list_id, title, description, links, tags,
      start_date, due_date, due_time, timezone, estimated_minutes, priority, status, recurrence_rule,
      recurrence_mode, assignee_id, privacy, position, change_origin)
    values (p_id, coalesce(p ->> 'item_type', 'task'), v_cal, (p ->> 'list_id')::uuid, p ->> 'title',
      p ->> 'description', coalesce(private.jsonb_text_array(p -> 'links'), '{}'),
      coalesce(private.jsonb_text_array(p -> 'tags'), '{}'), (p ->> 'start_date')::date,
      (p ->> 'due_date')::date, (p ->> 'due_time')::time, coalesce(p ->> 'timezone', 'America/Sao_Paulo'),
      (p ->> 'estimated_minutes')::integer, coalesce((p ->> 'priority')::smallint, 0),
      coalesce(p ->> 'status', 'pending'), p ->> 'recurrence_rule', coalesce(p ->> 'recurrence_mode', 'calendar'),
      (p ->> 'assignee_id')::uuid, coalesce(p ->> 'privacy', 'members'),
      coalesce((p ->> 'position')::double precision, extract(epoch from now())), p_origin)
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.tasks where id = p_id;
      if v_cur.created_by = v_uid then
        return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
      end if;
      raise exception 'DUPLICATE_ID' using errcode = 'P0001';
    end if;
    if p ? 'participant_ids' then
      perform private.task_set_participants(v_row, array(select jsonb_array_elements_text(p -> 'participant_ids'))::uuid[]);
    end if;
    if p ? 'alerts' then
      perform private.task_set_alerts(p_id, array(select jsonb_array_elements_text(p -> 'alerts'))::integer[]);
    end if;
    if p ? 'plan_day' then
      perform private.task_set_plan(p_id, (p ->> 'plan_day')::date);
    end if;
    if jsonb_typeof(p -> 'checklist') = 'array' then
      for v_item in select * from jsonb_array_elements(p -> 'checklist') loop
        perform private.task_checklist_upsert(v_row, v_item, true);
      end loop;
    end if;
    if v_row.status = 'done' then
      insert into public.task_completions (task_id, occurrence_date, completed_by) values (p_id, null, v_uid);
    end if;
    v_public := v_row.calendar_id is null or v_row.privacy = 'members';
    perform private.log_item(v_row.calendar_id, v_uid, 'task', p_id, 'created',
      jsonb_build_object('title', case when v_public then v_row.title end, 'item_type', v_row.item_type));
    if v_row.assignee_id is not null then
      perform private.notify_task(v_row.assignee_id, v_row, 'task_assigned', 'Nova tarefa para você',
        private.display_name(v_uid) || ': ' || v_row.title);
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  select * into v_cur from public.tasks where id = p_id for update;
  if v_cur.id is null or not private.task_access(v_cur.calendar_id, v_cur.id, v_cur.created_by, v_cur.assignee_id, v_cur.privacy)
     or (v_cur.calendar_id is not null and exists (select 1 from public.calendars c where c.id = v_cur.calendar_id and c.deleted_at is not null)) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_can_edit := private.can_edit_item(v_cur.calendar_id, v_cur.created_by);
  v_can_complete := v_can_edit or (v_cur.assignee_id = v_uid
    and (v_cur.calendar_id is null or private.calendar_is_writable(v_cur.calendar_id)));
  v_public := v_cur.calendar_id is null or v_cur.privacy = 'members';

  if p_kind = 'restore' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if v_cur.deleted_at is not null then
      update public.tasks set deleted_at = null, change_origin = p_origin where id = p_id;
      perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'restored',
        jsonb_build_object('title', case when v_public then v_cur.title end));
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if v_cur.deleted_at is not null then
    if p_kind = 'delete' then
      return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
    end if;
    if p_kind in ('update', 'complete', 'reopen') then
      return jsonb_build_object('status', 'conflict', 'reason', 'deleted', 'task', private.task_json(p_id));
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_kind = 'update' then
    if p_base_version is not null and v_cur.version <> p_base_version then
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'task', private.task_json(p_id));
    end if;
    if not v_can_edit then
      -- Responsável sem permissão de edição: só muda o andamento.
      if not (v_can_complete and not exists (
                select 1 from jsonb_object_keys(p) k where k not in ('status', 'position'))) then
        raise exception 'FORBIDDEN' using errcode = 'P0001';
      end if;
    end if;
    v_cal := case when p ? 'calendar_id' then (p ->> 'calendar_id')::uuid else v_cur.calendar_id end;
    if v_cal is distinct from v_cur.calendar_id then
      if v_cal is null and v_cur.created_by is distinct from v_uid then
        raise exception 'FORBIDDEN' using errcode = 'P0001';
      end if;
      if not private.can_create_in(v_cal) then
        raise exception 'FORBIDDEN' using errcode = 'P0001';
      end if;
    end if;
    update public.tasks t set
      item_type = case when p ? 'item_type' then p ->> 'item_type' else t.item_type end,
      calendar_id = v_cal,
      list_id = case when p ? 'list_id' then (p ->> 'list_id')::uuid
                     when v_cal is distinct from v_cur.calendar_id then null else t.list_id end,
      title = case when p ? 'title' then p ->> 'title' else t.title end,
      description = case when p ? 'description' then p ->> 'description' else t.description end,
      links = case when p ? 'links' then coalesce(private.jsonb_text_array(p -> 'links'), '{}') else t.links end,
      tags = case when p ? 'tags' then coalesce(private.jsonb_text_array(p -> 'tags'), '{}') else t.tags end,
      start_date = case when p ? 'start_date' then (p ->> 'start_date')::date else t.start_date end,
      due_date = case when p ? 'due_date' then (p ->> 'due_date')::date else t.due_date end,
      due_time = case when p ? 'due_time' then (p ->> 'due_time')::time else t.due_time end,
      timezone = case when p ? 'timezone' then p ->> 'timezone' else t.timezone end,
      estimated_minutes = case when p ? 'estimated_minutes' then (p ->> 'estimated_minutes')::integer else t.estimated_minutes end,
      priority = case when p ? 'priority' then (p ->> 'priority')::smallint else t.priority end,
      status = case when p ? 'status' then p ->> 'status' else t.status end,
      recurrence_rule = case when p ? 'recurrence_rule' then p ->> 'recurrence_rule' else t.recurrence_rule end,
      recurrence_mode = case when p ? 'recurrence_mode' then p ->> 'recurrence_mode' else t.recurrence_mode end,
      assignee_id = case
        when p ? 'assignee_id' then (p ->> 'assignee_id')::uuid
        when v_cal is distinct from v_cur.calendar_id and (v_cal is null or not exists (
          select 1 from public.calendar_members m where m.calendar_id = v_cal
            and m.user_id = t.assignee_id and m.status = 'active')) then null
        else t.assignee_id end,
      privacy = case when p ? 'privacy' then p ->> 'privacy' else t.privacy end,
      position = case when p ? 'position' then (p ->> 'position')::double precision else t.position end,
      change_origin = p_origin
    where t.id = p_id
    returning * into v_row;

    if v_cal is distinct from v_cur.calendar_id then
      delete from public.task_participants x where x.task_id = p_id and (v_cal is null or not exists (
        select 1 from public.calendar_members m where m.calendar_id = v_cal and m.user_id = x.user_id and m.status = 'active'));
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'moved', '{}'::jsonb);
    end if;

    foreach v_key in array array['title', 'description', 'due_date', 'due_time', 'priority', 'status',
                                 'assignee_id', 'recurrence_rule', 'list_id', 'tags', 'privacy'] loop
      if (to_jsonb(v_row) -> v_key) is distinct from (to_jsonb(v_cur) -> v_key) then
        v_changed := array_append(v_changed, v_key);
      end if;
    end loop;
    v_public := v_row.calendar_id is null or v_row.privacy = 'members';
    v_details := jsonb_build_object('title', case when v_public then v_row.title end, 'changed', to_jsonb(v_changed));

    if v_row.status = 'done' and v_cur.status <> 'done' then
      insert into public.task_completions (task_id, occurrence_date, completed_by) values (p_id, null, v_uid)
      on conflict do nothing;
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'completed', v_details);
      if v_row.created_by is distinct from v_uid then
        perform private.notify_task(v_row.created_by, v_row, 'task_completed', 'Tarefa concluída',
          private.display_name(v_uid) || ' concluiu "' || v_row.title || '"');
      end if;
    elsif v_cur.status = 'done' and v_row.status <> 'done' then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'reopened', v_details);
    elsif 'assignee_id' = any (v_changed) then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'assigned', v_details);
    elsif 'due_date' = any (v_changed) or 'due_time' = any (v_changed) then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'rescheduled',
        v_details || jsonb_build_object('due_date', v_row.due_date));
    elsif cardinality(v_changed) > 0 then
      perform private.log_item(v_row.calendar_id, v_row.created_by, 'task', p_id, 'updated', v_details);
    end if;
    if v_row.assignee_id is not null and v_row.assignee_id is distinct from v_cur.assignee_id then
      perform private.notify_task(v_row.assignee_id, v_row, 'task_assigned', 'Nova tarefa para você',
        private.display_name(v_uid) || ': ' || v_row.title);
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'delete' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if p_base_version is not null and v_cur.version <> p_base_version then
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'task', private.task_json(p_id));
    end if;
    update public.tasks set deleted_at = now(), change_origin = p_origin where id = p_id;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'deleted',
      jsonb_build_object('title', case when v_public then v_cur.title end));
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'complete' then
    if not v_can_complete then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if v_cur.recurrence_rule is null or v_cur.status in ('done', 'cancelled') then
      if v_cur.status <> 'done' then
        update public.tasks set status = 'done', change_origin = p_origin where id = p_id returning * into v_row;
        insert into public.task_completions (task_id, occurrence_date, completed_by) values (p_id, null, v_uid);
        perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'completed',
          jsonb_build_object('title', case when v_public then v_cur.title end));
        if v_cur.created_by is distinct from v_uid then
          perform private.notify_task(v_cur.created_by, v_row, 'task_completed', 'Tarefa concluída',
            private.display_name(v_uid) || ' concluiu "' || v_cur.title || '"');
        end if;
      end if;
      return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
    end if;
    -- Recorrente: registra a ocorrência e avança o prazo uma única vez.
    v_date := coalesce((p ->> 'occurrence_date')::date, v_cur.due_date);
    insert into public.task_completions (task_id, occurrence_date, completed_by)
    values (p_id, v_date, v_uid)
    on conflict (task_id, occurrence_date) do nothing
    returning id into v_cid;
    if v_cid is not null and v_date >= v_cur.due_date then
      v_next := case when v_cur.recurrence_mode = 'completion'
                     then private.rrule_add(v_cur.recurrence_rule, (now() at time zone v_cur.timezone)::date)
                     else private.rrule_next(v_cur.recurrence_rule, coalesce(v_cur.recurrence_start, v_cur.due_date), v_date) end;
      update public.tasks set
        due_date = coalesce(v_next, due_date),
        start_date = case when v_next is not null and start_date is not null
                          then least(start_date + (v_next - v_cur.due_date), v_next) else start_date end,
        status = case when v_next is null then 'done' else 'pending' end,
        change_origin = p_origin
      where id = p_id;
      -- Nova ocorrência começa com as etapas desmarcadas.
      if v_next is not null then
        update public.task_checklist_items set done = false, done_at = null, done_by = null, updated_at = now()
        where task_id = p_id and done;
      end if;
    end if;
    if v_cid is not null then
      perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'completed',
        jsonb_build_object('title', case when v_public then v_cur.title end, 'occurrence_date', v_date));
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'reopen' then
    if not v_can_complete then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    v_date := (p ->> 'occurrence_date')::date;
    if v_cur.recurrence_rule is not null and v_date is not null then
      delete from public.task_completions where task_id = p_id and occurrence_date = v_date returning id into v_cid;
      if v_cid is not null then
        update public.tasks set
          due_date = case when v_cur.status = 'done' or v_date < due_date then v_date else due_date end,
          status = 'pending', change_origin = p_origin
        where id = p_id;
      end if;
    elsif v_cur.status in ('done', 'cancelled') then
      update public.tasks set status = 'pending', change_origin = p_origin where id = p_id;
      v_cid := p_id;
    end if;
    if v_cid is not null then
      perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'task', p_id, 'reopened',
        jsonb_build_object('title', case when v_public then v_cur.title end, 'occurrence_date', v_date));
    end if;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'checklist_upsert' then
    if not v_can_complete then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    perform private.task_checklist_upsert(v_cur, p, v_can_edit);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'checklist_delete' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    delete from public.task_checklist_items where id = (p ->> 'id')::uuid and task_id = p_id;
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'participants_set' then
    if not v_can_edit then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    perform private.task_set_participants(v_cur, array(select jsonb_array_elements_text(p -> 'user_ids'))::uuid[]);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'alerts_set' then
    perform private.task_set_alerts(p_id, array(select jsonb_array_elements_text(p -> 'minutes'))::integer[]);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  if p_kind = 'plan_set' then
    perform private.task_set_plan(p_id, (p ->> 'day')::date);
    return jsonb_build_object('status', 'ok', 'task', private.task_json(p_id));
  end if;

  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
$$;

create or replace function private.list_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur public.task_lists;
  v_row public.task_lists;
  v_role text;
begin
  if p_kind = 'create' then
    if not private.can_create_in((p ->> 'calendar_id')::uuid) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    insert into public.task_lists (id, calendar_id, name, color, icon, position)
    values (p_id, (p ->> 'calendar_id')::uuid, btrim(p ->> 'name'), p ->> 'color', p ->> 'icon',
            coalesce((p ->> 'position')::double precision, extract(epoch from now())))
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.task_lists where id = p_id;
      if v_cur.created_by is distinct from auth.uid() then
        raise exception 'DUPLICATE_ID' using errcode = 'P0001';
      end if;
      v_row := v_cur;
    else
      perform private.log_item(v_row.calendar_id, auth.uid(), 'list', p_id, 'created',
        jsonb_build_object('title', v_row.name));
    end if;
    return jsonb_build_object('status', 'ok', 'list', to_jsonb(v_row));
  end if;

  select * into v_cur from public.task_lists where id = p_id for update;
  if v_cur.id is null or not private.list_visible(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_role := case when v_cur.calendar_id is null then null else private.calendar_role(v_cur.calendar_id) end;
  -- Lista pessoal: só a dona. Compartilhada: quem criou ou proprietário,
  -- administrador e editor (agenda ativa).
  if not (private.can_edit_item(v_cur.calendar_id, v_cur.created_by)
          or (v_role in ('owner', 'admin', 'editor') and private.calendar_is_writable(v_cur.calendar_id))) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_cur.deleted_at is not null then
    return jsonb_build_object('status', 'ok', 'list', to_jsonb(v_cur));
  end if;
  if p_kind = 'update' then
    if p_base_version is not null and v_cur.version <> p_base_version and (p ? 'name') then
      -- Renomear com versão antiga: o servidor mantém a mais recente.
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'list', to_jsonb(v_cur));
    end if;
    update public.task_lists l set
      name = case when p ? 'name' then btrim(p ->> 'name') else l.name end,
      color = case when p ? 'color' then p ->> 'color' else l.color end,
      icon = case when p ? 'icon' then p ->> 'icon' else l.icon end,
      position = case when p ? 'position' then (p ->> 'position')::double precision else l.position end
    where l.id = p_id
    returning * into v_row;
    return jsonb_build_object('status', 'ok', 'list', to_jsonb(v_row));
  end if;
  if p_kind = 'delete' then
    -- As tarefas da lista continuam existindo (voltam para a caixa de entrada).
    update public.task_lists set deleted_at = now() where id = p_id returning * into v_row;
    update public.tasks set list_id = null where list_id = p_id;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'list', p_id, 'deleted',
      jsonb_build_object('title', v_cur.name));
    return jsonb_build_object('status', 'ok', 'list', to_jsonb(v_row));
  end if;
  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
$$;

create or replace function private.note_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur public.notes;
  v_row public.notes;
  v_cal uuid;
  v_event uuid;
  v_task uuid;
begin
  if p_kind = 'create' then
    v_cal := (p ->> 'calendar_id')::uuid;
    if not private.can_create_in(v_cal) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    v_event := (p ->> 'event_id')::uuid;
    v_task := (p ->> 'task_id')::uuid;
    if v_event is not null and not exists (select 1 from public.events e where e.id = v_event
         and e.calendar_id is not distinct from v_cal and private.event_access_by_id(v_event) = 'full') then
      raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
    end if;
    if v_task is not null and not private.task_visible(v_task) then
      raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
    end if;
    insert into public.notes (id, calendar_id, title, body, pinned, event_id, task_id)
    values (p_id, v_cal, nullif(btrim(p ->> 'title'), ''), coalesce(p ->> 'body', ''),
            coalesce((p ->> 'pinned')::boolean, false), v_event, v_task)
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.notes where id = p_id;
      if v_cur.created_by is distinct from auth.uid() then
        raise exception 'DUPLICATE_ID' using errcode = 'P0001';
      end if;
      v_row := v_cur;
    else
      perform private.log_item(v_row.calendar_id, auth.uid(), 'note', p_id, 'created',
        jsonb_build_object('title', v_row.title));
    end if;
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;

  select * into v_cur from public.notes where id = p_id for update;
  if v_cur.id is null or not private.list_visible(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.can_edit_item(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_kind = 'restore' then
    update public.notes set deleted_at = null where id = p_id returning * into v_row;
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;
  if v_cur.deleted_at is not null then
    if p_kind = 'delete' then
      return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_cur));
    end if;
    return jsonb_build_object('status', 'conflict', 'reason', 'deleted', 'note', to_jsonb(v_cur));
  end if;
  if p_kind = 'update' then
    if p_base_version is not null and v_cur.version <> p_base_version and (p ? 'title' or p ? 'body') then
      return jsonb_build_object('status', 'conflict', 'reason', 'version', 'note', to_jsonb(v_cur));
    end if;
    update public.notes n set
      title = case when p ? 'title' then nullif(btrim(p ->> 'title'), '') else n.title end,
      body = case when p ? 'body' then coalesce(p ->> 'body', '') else n.body end,
      pinned = case when p ? 'pinned' then (p ->> 'pinned')::boolean else n.pinned end
    where n.id = p_id
    returning * into v_row;
    perform private.log_item(v_row.calendar_id, v_row.created_by, 'note', p_id, 'updated',
      jsonb_build_object('title', v_row.title));
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;
  if p_kind = 'delete' then
    update public.notes set deleted_at = now() where id = p_id returning * into v_row;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'note', p_id, 'deleted',
      jsonb_build_object('title', v_cur.title));
    return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_row));
  end if;
  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
$$;

create or replace function private.habit_op(
  p_kind text, p_id uuid, p jsonb, p_base_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur public.habits;
  v_row public.habits;
  v_cal uuid;
  v_day date;
begin
  if p_kind = 'create' then
    v_cal := (p ->> 'calendar_id')::uuid;
    if not private.can_create_in(v_cal) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    insert into public.habits (id, calendar_id, title, description, color, recurrence_rule, start_date, show_streak)
    values (p_id, v_cal, btrim(p ->> 'title'), nullif(btrim(p ->> 'description'), ''), p ->> 'color',
            coalesce(p ->> 'recurrence_rule', 'FREQ=DAILY'), coalesce((p ->> 'start_date')::date, current_date),
            coalesce((p ->> 'show_streak')::boolean, false))
    on conflict (id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_cur from public.habits where id = p_id;
      if v_cur.created_by is distinct from auth.uid() then
        raise exception 'DUPLICATE_ID' using errcode = 'P0001';
      end if;
    else
      perform private.log_item(v_row.calendar_id, auth.uid(), 'habit', p_id, 'created',
        jsonb_build_object('title', v_row.title));
    end if;
    return jsonb_build_object('status', 'ok', 'habit', private.habit_json(p_id, current_date - 70));
  end if;

  select * into v_cur from public.habits where id = p_id for update;
  if v_cur.id is null or v_cur.deleted_at is not null or not private.list_visible(v_cur.calendar_id, v_cur.created_by) then
    if p_kind = 'delete' then
      return jsonb_build_object('status', 'ok', 'habit', to_jsonb(v_cur));
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_kind = 'log_set' then
    -- Cada pessoa registra só a própria participação.
    if v_cur.calendar_id is not null and not private.calendar_is_writable(v_cur.calendar_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    v_day := (p ->> 'day')::date;
    if v_day is null or v_day > current_date + 1 or v_day < current_date - 366 then
      raise exception 'INVALID_DATA' using errcode = 'P0001';
    end if;
    if coalesce((p ->> 'done')::boolean, true) then
      insert into public.habit_logs (habit_id, user_id, day) values (p_id, auth.uid(), v_day)
      on conflict do nothing;
    else
      delete from public.habit_logs where habit_id = p_id and user_id = auth.uid() and day = v_day;
    end if;
    return jsonb_build_object('status', 'ok', 'habit', private.habit_json(p_id, current_date - 70));
  end if;

  if not private.can_edit_item(v_cur.calendar_id, v_cur.created_by) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_kind = 'update' then
    update public.habits h set
      title = case when p ? 'title' then btrim(p ->> 'title') else h.title end,
      description = case when p ? 'description' then nullif(btrim(p ->> 'description'), '') else h.description end,
      color = case when p ? 'color' then p ->> 'color' else h.color end,
      recurrence_rule = case when p ? 'recurrence_rule' then p ->> 'recurrence_rule' else h.recurrence_rule end,
      status = case when p ? 'status' then p ->> 'status' else h.status end,
      show_streak = case when p ? 'show_streak' then (p ->> 'show_streak')::boolean else h.show_streak end
    where h.id = p_id
    returning * into v_row;
    return jsonb_build_object('status', 'ok', 'habit', private.habit_json(p_id, current_date - 70));
  end if;
  if p_kind = 'delete' then
    update public.habits set deleted_at = now() where id = p_id returning * into v_row;
    perform private.log_item(v_cur.calendar_id, v_cur.created_by, 'habit', p_id, 'deleted',
      jsonb_build_object('title', v_cur.title));
    return jsonb_build_object('status', 'ok', 'habit', to_jsonb(v_row));
  end if;
  raise exception 'INVALID_OPERATION' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- 15. Ponto único de escrita (com idempotência, como apply_event_op)
-- Resultado: {status:'ok', task|list|note|habit:{...}}
--            {status:'conflict', reason:'version'|'deleted', ...}
--            {status:'error', code:'FORBIDDEN'|...}
-- ---------------------------------------------------------------------
create or replace function public.apply_item_op(
  p_op_id uuid, p_entity text, p_kind text, p_id uuid, p_payload jsonb default '{}'::jsonb,
  p_base_version integer default null, p_origin text default 'app')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_prev jsonb;
  v_result jsonb;
  v_origin text := case when p_origin = 'offline_sync' then 'offline_sync' else 'app' end;
  v_p jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if p_op_id is null or p_id is null then
    raise exception 'INVALID_OPERATION' using errcode = 'P0001';
  end if;
  select s.result into v_prev from public.sync_operations s where s.id = p_op_id and s.user_id = v_uid;
  if v_prev is not null then
    -- Reenvio: devolve o estado atual do item (o resultado antigo não guarda dados).
    v_result := case p_entity
      when 'task' then case when private.task_visible(p_id) then jsonb_build_object('task', private.task_json(p_id)) else '{}'::jsonb end
      else '{}'::jsonb end;
    return v_prev || v_result || jsonb_build_object('replayed', true);
  end if;

  begin
    if p_entity = 'task' then
      v_result := private.task_op(p_kind, p_id, v_p, p_base_version, v_origin);
    elsif p_entity = 'list' then
      v_result := private.list_op(p_kind, p_id, v_p, p_base_version);
    elsif p_entity = 'note' then
      v_result := private.note_op(p_kind, p_id, v_p, p_base_version);
    elsif p_entity = 'habit' then
      v_result := private.habit_op(p_kind, p_id, v_p, p_base_version);
    elsif p_entity = 'checkin' and p_kind = 'mark' then
      insert into public.daily_checkins (user_id, day) values (v_uid, (v_p ->> 'day')::date)
      on conflict do nothing;
      v_result := jsonb_build_object('status', 'ok');
    else
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_OPERATION');
    end if;
  exception
    when insufficient_privilege then
      v_result := jsonb_build_object('status', 'error', 'code', 'FORBIDDEN');
    when check_violation or not_null_violation or invalid_text_representation
         or invalid_datetime_format or datetime_field_overflow or string_data_right_truncation
         or numeric_value_out_of_range or invalid_parameter_value then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_DATA');
    when foreign_key_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'INVALID_REFERENCE');
    when unique_violation then
      v_result := jsonb_build_object('status', 'error', 'code', 'DUPLICATE_ID');
    when raise_exception then
      v_result := jsonb_build_object('status', 'error', 'code', sqlerrm);
  end;

  if v_result ->> 'status' in ('ok', 'error') then
    insert into public.sync_operations (id, user_id, kind, entity_id, result)
    values (p_op_id, v_uid, p_entity || ':' || p_kind, p_id, jsonb_strip_nulls(jsonb_build_object(
      'status', v_result ->> 'status', 'code', v_result ->> 'code', 'entity_id', p_id)))
    on conflict (id) do nothing;
  end if;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 16. Comentários em tarefas (precisam de internet, como nos eventos)
-- ---------------------------------------------------------------------
create or replace function public.list_task_comments(p_task_id uuid)
returns table (
  id uuid, author_id uuid, author_name text, author_color text, body text,
  created_at timestamptz, edited_at timestamptz, deleted_at timestamptz, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.author_id, coalesce(p.display_name, 'Ex-membro'), coalesce(p.avatar_color, '#55707A'),
         case when c.deleted_at is null then c.body end, c.created_at, c.edited_at, c.deleted_at,
         c.author_id = auth.uid()
  from public.task_comments c
  left join public.profiles p on p.id = c.author_id
  where c.task_id = p_task_id and private.task_visible(p_task_id)
  order by c.created_at
  limit 500;
$$;

create or replace function public.add_task_comment(p_task_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_task public.tasks;
  v_id uuid;
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  r record;
begin
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null;
  if v_task.id is null or not private.task_visible(p_task_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_task.calendar_id is not null and not (
       (private.role_rank(private.calendar_role(v_task.calendar_id)) >= private.role_rank('collaborator')
        or v_task.assignee_id = v_uid)
       and private.calendar_is_writable(v_task.calendar_id)) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'INVALID_DATA' using errcode = 'P0001';
  end if;
  if private.rate_limited('task_comment', 60, interval '10 minutes') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  perform private.record_rate_hit('task_comment');
  insert into public.task_comments (task_id, author_id, body) values (p_task_id, v_uid, v_body) returning id into v_id;
  perform private.log_item(v_task.calendar_id, v_task.created_by, 'task', p_task_id, 'commented', '{}'::jsonb);
  for r in
    select distinct u.user_id from (
      select v_task.created_by as user_id
      union select v_task.assignee_id
      union select x.user_id from public.task_participants x where x.task_id = p_task_id) u
    where u.user_id is not null and u.user_id <> v_uid
  loop
    perform private.notify_task(r.user_id, v_task, 'task_comment', 'Novo comentário em tarefa',
      private.display_name(v_uid) || ' comentou em "' || v_task.title || '"');
  end loop;
  return v_id;
end;
$$;

create or replace function public.delete_task_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_c public.task_comments;
  v_task public.tasks;
begin
  select * into v_c from public.task_comments where id = p_comment_id and deleted_at is null;
  if v_c.id is null or not private.task_visible(v_c.task_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into v_task from public.tasks where id = v_c.task_id;
  if not (v_c.author_id = v_uid
          or (v_task.calendar_id is not null and private.calendar_role(v_task.calendar_id) in ('owner', 'admin'))) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.task_comments set deleted_at = now(), body = '' where id = p_comment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 17. Disponibilidade ("Encontrar horário")
-- Devolve só horários (nunca títulos ou detalhes). Conta:
--   * eventos da agenda escolhida que quem pergunta já pode ver, ocupando
--     os participantes do evento (ou quem criou, se não houver participantes);
--   * eventos das outras agendas da pessoa só se ela ativou
--     "Compartilhar disponibilidade" (ou se for a própria pessoa).
-- ---------------------------------------------------------------------
create or replace function public.list_busy_times(
  p_calendar_id uuid, p_user_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  user_id uuid, starts_at timestamptz, ends_at timestamptz, all_day boolean, start_date date,
  end_date date, timezone text, recurrence_rule text, exceptions jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_role text := private.calendar_role(p_calendar_id);
begin
  if v_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_to <= p_from or p_to - p_from > interval '62 days' then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
  return query
  with targets as (
    select m.user_id, coalesce(up.share_availability, false) as shares
    from public.calendar_members m
    left join public.user_preferences up on up.user_id = m.user_id
    where m.calendar_id = p_calendar_id and m.status = 'active'
      and m.user_id = any (coalesce(p_user_ids, '{}'::uuid[]))
  ),
  candidates as (
    select e.*, t.user_id as target
    from targets t
    join public.events e on e.deleted_at is null and e.status not in ('cancelled', 'completed', 'archived')
      and e.starts_at < p_to and (e.recurrence_rule is not null or e.ends_at > p_from)
    where (
        -- Evento da agenda escolhida, visível para quem pergunta.
        e.calendar_id = p_calendar_id
        and private.event_access_for(v_role, v_uid, e.id, e.created_by, e.privacy) is not null
        and (exists (select 1 from public.event_attendees a where a.event_id = e.id and a.user_id = t.user_id)
             or (e.created_by = t.user_id and not exists (select 1 from public.event_attendees a where a.event_id = e.id)))
      ) or (
        -- Outras agendas da pessoa, só com autorização dela.
        e.calendar_id <> p_calendar_id
        and (t.shares or t.user_id = v_uid)
        and exists (select 1 from public.calendar_members m2 join public.calendars c2 on c2.id = m2.calendar_id
                    where m2.calendar_id = e.calendar_id and m2.user_id = t.user_id
                      and m2.status = 'active' and c2.deleted_at is null)
        and (e.created_by = t.user_id
             or exists (select 1 from public.event_attendees a where a.event_id = e.id and a.user_id = t.user_id)
             or exists (select 1 from public.calendars c3 where c3.id = e.calendar_id and c3.kind = 'personal'))
      )
  )
  select c.target, c.starts_at, c.ends_at, c.all_day, c.start_date, c.end_date, c.timezone, c.recurrence_rule,
         coalesce((select jsonb_agg(jsonb_build_object('original_date', x.original_date, 'is_cancelled', x.is_cancelled,
                     'starts_at', x.starts_at, 'ends_at', x.ends_at))
                   from public.recurrence_exceptions x where x.event_id = c.id), '[]'::jsonb)
  from candidates c
  limit 5000;
end;
$$;

-- ---------------------------------------------------------------------
-- 18. Enquetes de horário
-- ---------------------------------------------------------------------
create or replace function public.create_poll(
  p_calendar_id uuid, p_title text, p_description text, p_duration_minutes integer, p_timezone text,
  p_closes_at timestamptz, p_participant_ids uuid[], p_options jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_id uuid;
  v_ids uuid[];
  v_opt jsonb;
  v_cal_name text;
  r record;
begin
  if not private.can_create_in(p_calendar_id) or p_calendar_id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 20 then
    raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
  end if;
  if not private.is_valid_timezone(p_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = 'P0001';
  end if;
  if private.rate_limited('create_poll', 20, interval '1 hour') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  v_ids := array(select distinct u from unnest(coalesce(p_participant_ids, '{}'::uuid[]) || v_uid) u);
  if exists (select 1 from unnest(v_ids) u(id) where not exists (
      select 1 from public.calendar_members m where m.calendar_id = p_calendar_id and m.user_id = u.id and m.status = 'active')) then
    raise exception 'INVALID_PARTICIPANT' using errcode = 'P0001';
  end if;
  insert into public.availability_polls (calendar_id, created_by, title, description, duration_minutes, timezone, closes_at)
  values (p_calendar_id, v_uid, btrim(p_title), nullif(btrim(p_description), ''), p_duration_minutes, p_timezone, p_closes_at)
  returning id into v_id;
  insert into public.availability_poll_participants (poll_id, user_id) select v_id, u from unnest(v_ids) u;
  for v_opt in select * from jsonb_array_elements(p_options) loop
    insert into public.availability_poll_options (poll_id, starts_at, ends_at)
    values (v_id, (v_opt ->> 'starts_at')::timestamptz, (v_opt ->> 'ends_at')::timestamptz);
  end loop;
  perform private.record_rate_hit('create_poll');
  perform private.log_item(p_calendar_id, v_uid, 'poll', v_id, 'created', jsonb_build_object('title', btrim(p_title)));
  select name into v_cal_name from public.calendars where id = p_calendar_id;
  for r in select u from unnest(v_ids) u where u <> v_uid loop
    perform private.notify(r.u, 'poll_created', p_calendar_id, null, v_uid, 'Escolha um horário em ' || v_cal_name,
      private.display_name(v_uid) || ' quer marcar "' || btrim(p_title) || '"', jsonb_build_object('poll_id', v_id));
  end loop;
  return v_id;
end;
$$;

create or replace function public.list_polls(p_calendar_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'calendar_id', p.calendar_id, 'title', p.title, 'description', p.description,
    'duration_minutes', p.duration_minutes, 'timezone', p.timezone,
    'status', case when p.status = 'open' and p.closes_at is not null and p.closes_at <= now() then 'closed' else p.status end,
    'closes_at', p.closes_at, 'chosen_option_id', p.chosen_option_id, 'event_id', p.event_id,
    'created_by', p.created_by, 'created_by_name', private.display_name(p.created_by), 'created_at', p.created_at,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id,
        'display_name', private.display_name(x.user_id)) order by x.user_id)
        from public.availability_poll_participants x where x.poll_id = p.id), '[]'::jsonb),
    'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'starts_at', o.starts_at, 'ends_at', o.ends_at,
        'votes', coalesce((select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'answer', v.answer))
                           from public.availability_poll_votes v where v.option_id = o.id), '[]'::jsonb))
        order by o.starts_at)
        from public.availability_poll_options o where o.poll_id = p.id), '[]'::jsonb))
    order by p.created_at desc), '[]'::jsonb)
  from public.availability_polls p
  where p.calendar_id = p_calendar_id and private.poll_visible(p.id);
$$;

create or replace function public.vote_poll(p_option_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_poll public.availability_polls;
begin
  select p.* into v_poll from public.availability_polls p
  join public.availability_poll_options o on o.poll_id = p.id where o.id = p_option_id;
  if v_poll.id is null or not exists (select 1 from public.availability_poll_participants x
                                      where x.poll_id = v_poll.id and x.user_id = v_uid)
     or private.calendar_role(v_poll.calendar_id) is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_poll.status <> 'open' or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'POLL_CLOSED' using errcode = 'P0001';
  end if;
  if p_answer not in ('yes', 'maybe', 'no') then
    raise exception 'INVALID_DATA' using errcode = 'P0001';
  end if;
  insert into public.availability_poll_votes (option_id, user_id, answer) values (p_option_id, v_uid, p_answer)
  on conflict (option_id, user_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

-- Encerra a enquete. Com uma opção escolhida e p_create_event, cria o
-- evento (participantes = quem estava na enquete). Nada é enviado antes
-- dessa confirmação.
create or replace function public.close_poll(p_poll_id uuid, p_option_id uuid, p_create_event boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_poll public.availability_polls;
  v_opt public.availability_poll_options;
  v_event uuid;
  r record;
begin
  select * into v_poll from public.availability_polls where id = p_poll_id for update;
  if v_poll.id is null or not private.poll_visible(p_poll_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not (v_poll.created_by = v_uid or private.calendar_role(v_poll.calendar_id) in ('owner', 'admin')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_poll.status = 'scheduled' then
    return jsonb_build_object('ok', true, 'event_id', v_poll.event_id);
  end if;
  if p_option_id is not null then
    select * into v_opt from public.availability_poll_options where id = p_option_id and poll_id = p_poll_id;
    if v_opt.id is null then
      raise exception 'INVALID_OPTION' using errcode = 'P0001';
    end if;
  end if;
  if v_opt.id is not null and p_create_event then
    if not private.can_create_in(v_poll.calendar_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    insert into public.events (calendar_id, title, description, starts_at, ends_at, timezone, event_type, status, privacy)
    values (v_poll.calendar_id, v_poll.title, v_poll.description, v_opt.starts_at, v_opt.ends_at, v_poll.timezone,
            'meeting', 'confirmed', 'members')
    returning id into v_event;
    insert into public.event_attendees (event_id, user_id, added_by, response)
    select v_event, x.user_id, v_uid,
           case when exists (select 1 from public.availability_poll_votes v where v.option_id = v_opt.id
                             and v.user_id = x.user_id and v.answer = 'yes') then 'accepted' else 'pending' end
    from public.availability_poll_participants x where x.poll_id = p_poll_id
      and exists (select 1 from public.calendar_members m where m.calendar_id = v_poll.calendar_id
                  and m.user_id = x.user_id and m.status = 'active');
  end if;
  update public.availability_polls
     set status = case when v_event is not null then 'scheduled' else 'closed' end,
         chosen_option_id = v_opt.id, event_id = v_event, updated_at = now()
   where id = p_poll_id;
  perform private.log_item(v_poll.calendar_id, v_uid, 'poll', p_poll_id, 'closed', jsonb_build_object('title', v_poll.title));
  for r in select x.user_id from public.availability_poll_participants x where x.poll_id = p_poll_id and x.user_id <> v_uid loop
    perform private.notify(r.user_id, 'poll_closed', v_poll.calendar_id, v_event, v_uid,
      case when v_event is not null then 'Horário marcado: ' || v_poll.title else 'Enquete encerrada: ' || v_poll.title end,
      private.display_name(v_uid) || ' encerrou a enquete.', jsonb_build_object('poll_id', p_poll_id));
  end loop;
  return jsonb_build_object('ok', true, 'event_id', v_event);
end;
$$;

-- ---------------------------------------------------------------------
-- 19. Eventos: leitura e escrita com task_id e external_uid
-- ---------------------------------------------------------------------
drop function if exists public.list_events(uuid[], timestamptz, timestamptz);
create function public.list_events(p_calendar_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, calendar_id uuid, title text, description text, location text, address text, url text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
  timezone text, recurrence_rule text, created_by uuid, assignee_id uuid, color text,
  event_type text, status text, privacy text, version integer, created_at timestamptz,
  updated_at timestamptz, updated_by uuid, completed_at timestamptz, is_masked boolean,
  exceptions jsonb, attendee_ids uuid[], my_reminders integer[], task_id uuid, external_uid text)
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
           from public.reminders r where r.event_id = v.id and r.user_id = auth.uid()), '{}'::integer[]),
         case when v.access = 'full' then v.task_id end,
         case when v.access = 'full' then v.external_uid end
  from visible v
  where v.access is not null
  order by v.starts_at
  limit 5000;
$$;

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

  select s.result into v_prev from public.sync_operations s where s.id = p_op_id and s.user_id = v_uid;
  if v_prev is not null then
    return v_prev || jsonb_build_object('replayed', true);
  end if;

  begin
    if p_kind = 'create' then
      insert into public.events (id, calendar_id, title, description, location, address, url, all_day,
        starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, assignee_id, color,
        event_type, status, privacy, change_origin, task_id, external_uid)
      values (p_event_id, (v_p ->> 'calendar_id')::uuid, v_p ->> 'title', v_p ->> 'description',
        v_p ->> 'location', v_p ->> 'address', v_p ->> 'url', coalesce((v_p ->> 'all_day')::boolean, false),
        (v_p ->> 'starts_at')::timestamptz, (v_p ->> 'ends_at')::timestamptz,
        (v_p ->> 'start_date')::date, (v_p ->> 'end_date')::date,
        coalesce(v_p ->> 'timezone', 'America/Sao_Paulo'), v_p ->> 'recurrence_rule',
        (v_p ->> 'assignee_id')::uuid, v_p ->> 'color',
        coalesce(v_p ->> 'event_type', 'appointment'), coalesce(v_p ->> 'status', 'planned'),
        coalesce(v_p ->> 'privacy', 'members'), v_origin, (v_p ->> 'task_id')::uuid, v_p ->> 'external_uid')
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
          task_id = case when v_p ? 'task_id' then (v_p ->> 'task_id')::uuid else e.task_id end,
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
        update public.events e set recurrence_rule = v_p ->> 'original_rule', change_origin = v_origin
        where e.id = p_event_id and e.version = p_base_version and e.deleted_at is null
          and e.recurrence_rule is not null
        returning * into v_row;
        if v_row.id is not null then
          v_n := v_p -> 'new_event';
          insert into public.events (id, calendar_id, title, description, location, address, url, all_day,
            starts_at, ends_at, start_date, end_date, timezone, recurrence_rule, assignee_id, color,
            event_type, status, privacy, change_origin, task_id)
          values ((v_n ->> 'id')::uuid, v_row.calendar_id, v_n ->> 'title', v_n ->> 'description',
            v_n ->> 'location', v_n ->> 'address', v_n ->> 'url', coalesce((v_n ->> 'all_day')::boolean, false),
            (v_n ->> 'starts_at')::timestamptz, (v_n ->> 'ends_at')::timestamptz,
            (v_n ->> 'start_date')::date, (v_n ->> 'end_date')::date,
            coalesce(v_n ->> 'timezone', v_row.timezone), v_n ->> 'recurrence_rule',
            (v_n ->> 'assignee_id')::uuid, v_n ->> 'color',
            coalesce(v_n ->> 'event_type', v_row.event_type), coalesce(v_n ->> 'status', v_row.status),
            coalesce(v_n ->> 'privacy', v_row.privacy), v_origin, v_row.task_id)
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

-- ---------------------------------------------------------------------
-- 20. Saída de membro: também perde atribuições, participações, alertas,
-- planos e votos naquela agenda.
-- ---------------------------------------------------------------------
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
  delete from public.task_alerts x using public.tasks t
   where x.task_id = t.id and t.calendar_id = p_calendar_id and x.user_id = p_user_id;
  delete from public.task_plans x using public.tasks t
   where x.task_id = t.id and t.calendar_id = p_calendar_id and x.user_id = p_user_id;
  delete from public.task_participants x using public.tasks t
   where x.task_id = t.id and t.calendar_id = p_calendar_id and x.user_id = p_user_id;
  update public.tasks set assignee_id = null, change_origin = 'system'
   where calendar_id = p_calendar_id and assignee_id = p_user_id;
  delete from public.availability_poll_participants x using public.availability_polls p
   where x.poll_id = p.id and p.calendar_id = p_calendar_id and x.user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------
-- 21. LGPD: exportação e exclusão incluem os itens novos
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
                     order by n.created_at desc limit 500) n), '[]'::jsonb),
    'task_lists', coalesce((select jsonb_agg(to_jsonb(l)) from public.task_lists l where l.created_by = v_uid), '[]'::jsonb),
    'tasks_created', coalesce((select jsonb_agg(private.task_json(t.id)) from public.tasks t where t.created_by = v_uid), '[]'::jsonb),
    'task_completions', coalesce((select jsonb_agg(to_jsonb(c)) from public.task_completions c where c.completed_by = v_uid), '[]'::jsonb),
    'task_comments', coalesce((select jsonb_agg(to_jsonb(c)) from public.task_comments c where c.author_id = v_uid), '[]'::jsonb),
    'task_plans', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.task_plans x where x.user_id = v_uid), '[]'::jsonb),
    'daily_checkins', coalesce((select jsonb_agg(x.day) from public.daily_checkins x where x.user_id = v_uid), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n)) from public.notes n where n.created_by = v_uid), '[]'::jsonb),
    'habits', coalesce((select jsonb_agg(to_jsonb(h)) from public.habits h where h.created_by = v_uid), '[]'::jsonb),
    'habit_logs', coalesce((select jsonb_agg(to_jsonb(l) - 'user_id') from public.habit_logs l where l.user_id = v_uid), '[]'::jsonb),
    'poll_votes', coalesce((select jsonb_agg(to_jsonb(v) - 'user_id') from public.availability_poll_votes v where v.user_id = v_uid), '[]'::jsonb)
  ) into v_data;
  return v_data;
end;
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
  delete from public.task_comments where author_id = v_uid;
  -- Itens pessoais saem junto; itens em agendas de outras pessoas ficam, sem autor.
  delete from public.tasks where calendar_id is null and created_by = v_uid;
  delete from public.task_lists where calendar_id is null and created_by = v_uid;
  delete from public.notes where calendar_id is null and created_by = v_uid;
  delete from public.habits where calendar_id is null and created_by = v_uid;
  delete from public.calendars where owner_id = v_uid;
  delete from auth.users where id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.purge_trash(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendars integer;
  v_events integer;
  v_items integer;
begin
  delete from public.calendars where deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_calendars = row_count;
  delete from public.events where deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_events = row_count;
  delete from public.tasks where deleted_at < now() - make_interval(days => p_days)
    or (calendar_id is null and created_by is null);
  get diagnostics v_items = row_count;
  delete from public.task_lists where deleted_at < now() - make_interval(days => p_days)
    or (calendar_id is null and created_by is null);
  delete from public.notes where deleted_at < now() - make_interval(days => p_days)
    or (calendar_id is null and created_by is null);
  delete from public.habits where deleted_at < now() - make_interval(days => p_days)
    or (calendar_id is null and created_by is null);
  delete from public.item_activity where created_at < now() - interval '365 days';
  delete from public.sync_operations where created_at < now() - interval '30 days';
  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  delete from private.rate_limit_hits where created_at < now() - interval '1 day';
  return jsonb_build_object('calendars', v_calendars, 'events', v_events, 'items', v_items);
end;
$$;

-- ---------------------------------------------------------------------
-- 22. Permissões de funções e tempo real
-- ---------------------------------------------------------------------
revoke execute on function
  public.list_my_items(timestamptz),
  public.list_done_tasks(timestamptz, integer),
  public.list_task_history(uuid),
  public.apply_item_op(uuid, text, text, uuid, jsonb, integer, text),
  public.list_task_comments(uuid),
  public.add_task_comment(uuid, text),
  public.delete_task_comment(uuid),
  public.list_busy_times(uuid, uuid[], timestamptz, timestamptz),
  public.create_poll(uuid, text, text, integer, text, timestamptz, uuid[], jsonb),
  public.list_polls(uuid),
  public.vote_poll(uuid, text),
  public.close_poll(uuid, uuid, boolean),
  public.list_events(uuid[], timestamptz, timestamptz)
from public, anon;

grant execute on function
  public.list_my_items(timestamptz),
  public.list_done_tasks(timestamptz, integer),
  public.list_task_history(uuid),
  public.apply_item_op(uuid, text, text, uuid, jsonb, integer, text),
  public.list_task_comments(uuid),
  public.add_task_comment(uuid, text),
  public.delete_task_comment(uuid),
  public.list_busy_times(uuid, uuid[], timestamptz, timestamptz),
  public.create_poll(uuid, text, text, integer, text, timestamptz, uuid[], jsonb),
  public.list_polls(uuid),
  public.vote_poll(uuid, text),
  public.close_poll(uuid, uuid, boolean),
  public.list_events(uuid[], timestamptz, timestamptz)
to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function public.purge_trash(integer) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_activity') then
    alter publication supabase_realtime add table public.item_activity;
  end if;
end;
$$;
