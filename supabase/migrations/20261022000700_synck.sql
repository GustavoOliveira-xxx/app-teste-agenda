-- =====================================================================
-- Versão 2.0 (SynCK)
-- 1. Cores padrão da paleta SynCK (agendas e avatares novos).
-- 2. Cadastro com Google: usa o nome que vem do Google.
-- 3. Notificações pelo navegador (iPhone e computador): inscrições de cada
--    navegador, configuração do envio e o agendamento que roda a cada minuto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cores SynCK
-- ---------------------------------------------------------------------
create or replace function private.avatar_color_for(p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['#017A68', '#D9472A', '#A86F00', '#2B6CB0', '#7E46BF', '#B83A66', '#5E7A16', '#55707A'])
         [1 + (get_byte(uuid_send(p_id), 15) % 8)];
$$;

alter table public.calendars alter column color set default '#017A68';
alter table public.profiles alter column avatar_color set default '#017A68';

-- ---------------------------------------------------------------------
-- 2. Nova conta (e-mail e senha ou Google)
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
  -- Cadastro pelo app manda "display_name"; o Google manda "full_name" ou "name".
  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    '')), '');
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
  values (new.id, 'Minha agenda', 'personal', '#017A68', v_tz, 'viewer');

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Notificações pelo navegador (Web Push)
-- ---------------------------------------------------------------------

-- Cada navegador em que a pessoa ativou as notificações.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
grant select, delete on public.push_subscriptions to authenticated;

-- Configuração do envio (uma linha só). As chaves VAPID são criadas pela
-- própria função de envio na primeira vez; a chave privada nunca sai do banco.
create table if not exists private.web_push_config (
  id boolean primary key default true check (id),
  public_key text,
  private_key text,
  subject text not null default 'mailto:contato@synck.app',
  -- Segredo que o agendamento envia para a função provar que é ele.
  cron_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  -- Endereço da função (ex.: https://<projeto>.supabase.co/functions/v1/enviar-push).
  function_url text,
  last_run_at timestamptz
);
insert into private.web_push_config (id) values (true) on conflict (id) do nothing;

-- Chave pública VAPID, usada pelo navegador para se inscrever (não é segredo).
create or replace function public.web_push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public_key from private.web_push_config where id;
$$;
revoke all on function public.web_push_public_key() from public;
grant execute on function public.web_push_public_key() to anon, authenticated;

-- Ativa as notificações neste navegador (ou passa o navegador para a conta atual).
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke all on function public.register_push_subscription(text, text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Desativa neste navegador (só a própria inscrição).
create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.unregister_push_subscription(text) from public;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- Agendamento: a cada minuto chama a função de envio (lembretes e avisos).
-- Só no Supabase de verdade (pg_cron e pg_net); nos testes locais é pulado.
do $setup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.unschedule(jobid) from cron.job where jobname = 'synck-enviar-push';
    perform cron.schedule('synck-enviar-push', '* * * * *', $job$
      select net.http_post(
        url := c.function_url,
        headers := jsonb_build_object('content-type', 'application/json', 'x-synck-cron', c.cron_secret),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000)
      from private.web_push_config c
      where c.id and c.function_url is not null
        and exists (select 1 from public.push_subscriptions);
    $job$);
  end if;
end;
$setup$;
