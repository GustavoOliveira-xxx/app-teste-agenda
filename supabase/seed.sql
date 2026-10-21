-- =====================================================================
-- Dados de demonstração
--
-- ATENÇÃO
--   * Use apenas em ambiente de desenvolvimento ou demonstração.
--   * Por segurança, este script SÓ RODA EM BANCO SEM USUÁRIOS. Se já
--     existir qualquer conta, nada é criado (proteção contra rodar em
--     produção por engano).
--   * Pessoas, e-mails e eventos são fictícios. Domínio ".test" é
--     reservado e nunca recebe e-mails de verdade.
--   * Senha de todas as contas de demonstração: Demo@2026!
-- =====================================================================

do $$
declare
  v_ana uuid := 'a0000000-0000-4000-8000-000000000001';
  v_bruno uuid := 'a0000000-0000-4000-8000-000000000002';
  v_carla uuid := 'a0000000-0000-4000-8000-000000000003';
  v_davi uuid := 'a0000000-0000-4000-8000-000000000004';
  v_cal uuid := 'c0000000-0000-4000-8000-000000000001';
  v_gym uuid := 'e0000000-0000-4000-8000-000000000001';
  v_dinner uuid := 'e0000000-0000-4000-8000-000000000002';
  v_tz constant text := 'America/Sao_Paulo';
  v_user record;
begin
  if exists (select 1 from auth.users) then
    raise notice 'Seed ignorado: o banco já tem usuários.';
    return;
  end if;

  -- Contas fictícias (como o Supabase Auth criaria)
  for v_user in
    select * from (values
      (v_ana, 'ana.demo@exemplo.test', 'Ana Demo'),
      (v_bruno, 'bruno.demo@exemplo.test', 'Bruno Demo'),
      (v_carla, 'carla.demo@exemplo.test', 'Carla Demo'),
      (v_davi, 'davi.demo@exemplo.test', 'Davi Demo')
    ) as t(id, email, name)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change)
    values (v_user.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_user.email, extensions.crypt('Demo@2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_user.name, 'timezone', v_tz),
      now() - interval '30 days', now(), '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user.id, v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email', now(), now(), now());
  end loop;

  -- Agenda compartilhada com papéis diferentes
  perform set_config('request.jwt.claim.sub', v_ana::text, true);
  insert into public.calendars (id, owner_id, name, description, kind, color, default_timezone)
  values (v_cal, v_ana, 'Casa (demonstração)', 'Compromissos da casa e da família.', 'family', '#30A46C', v_tz);

  insert into public.calendar_members (calendar_id, user_id, role, granted_by)
  values (v_cal, v_bruno, 'editor', v_ana),
         (v_cal, v_carla, 'collaborator', v_ana),
         (v_cal, v_davi, 'viewer', v_ana);

  -- Eventos: passado, futuro, recorrente, privado, ocupado, cancelado e dia inteiro.
  -- O "autor" de cada evento é quem está "logado" (request.jwt.claim.sub).
  insert into public.events (id, calendar_id, title, description, location, starts_at, ends_at, timezone,
    event_type, status, privacy)
  values
    (gen_random_uuid(), v_cal, 'Consulta no dentista', 'Levar a carteirinha do plano.', 'Clínica Sorriso',
      ((current_date - 10) + time '09:00') at time zone v_tz, ((current_date - 10) + time '10:00') at time zone v_tz,
      v_tz, 'appointment', 'completed', 'members'),
    (v_dinner, v_cal, 'Jantar de aniversário', 'Reserva para 4 pessoas.', 'Restaurante Central',
      ((current_date + 3) + time '20:00') at time zone v_tz, ((current_date + 3) + time '22:30') at time zone v_tz,
      v_tz, 'social', 'confirmed', 'members'),
    (gen_random_uuid(), v_cal, 'Cinema', null, 'Shopping',
      ((current_date + 1) + time '19:30') at time zone v_tz, ((current_date + 1) + time '22:00') at time zone v_tz,
      v_tz, 'social', 'cancelled', 'members');

  insert into public.events (calendar_id, title, all_day, start_date, end_date, starts_at, ends_at, timezone,
    event_type, status)
  values (v_cal, 'Viagem para a praia', true, current_date + 14, current_date + 16,
    now(), now() + interval '1 day', v_tz, 'travel', 'planned');

  perform set_config('request.jwt.claim.sub', v_bruno::text, true);
  insert into public.events (id, calendar_id, title, description, location, starts_at, ends_at, timezone,
    event_type, status, privacy, recurrence_rule)
  values
    (v_gym, v_cal, 'Academia', null, 'Academia do bairro',
      ((current_date - 14) + time '07:00') at time zone v_tz, ((current_date - 14) + time '08:00') at time zone v_tz,
      v_tz, 'appointment', 'confirmed', 'members', 'FREQ=WEEKLY;BYDAY=MO,WE,FR'),
    (gen_random_uuid(), v_cal, 'Comprar presente', 'Surpresa: não contar para ninguém!', null,
      ((current_date + 2) + time '18:00') at time zone v_tz, ((current_date + 2) + time '19:00') at time zone v_tz,
      v_tz, 'task', 'planned', 'private', null);

  perform set_config('request.jwt.claim.sub', v_carla::text, true);
  insert into public.events (calendar_id, title, description, location, starts_at, ends_at, timezone,
    event_type, status, privacy)
  values (v_cal, 'Consulta médica', 'Retorno.', 'Hospital',
    ((current_date + 5) + time '14:00') at time zone v_tz, ((current_date + 5) + time '15:00') at time zone v_tz,
    v_tz, 'appointment', 'confirmed', 'busy');

  -- Ocorrência cancelada da série da academia
  perform set_config('request.jwt.claim.sub', v_bruno::text, true);
  insert into public.recurrence_exceptions (event_id, original_date, is_cancelled, created_by)
  select v_gym, d::date, true, v_bruno
  from generate_series(current_date, current_date + 7, interval '1 day') as d
  where extract(isodow from d) = 3
  limit 1;

  -- Lembretes e comentários
  insert into public.reminders (event_id, user_id, minutes_before)
  values (v_dinner, v_ana, 60), (v_dinner, v_bruno, 1440), (v_gym, v_bruno, 30);

  perform set_config('request.jwt.claim.sub', v_carla::text, true);
  insert into public.comments (event_id, author_id, body) values (v_dinner, v_carla, 'Posso levar a sobremesa!');
  perform set_config('request.jwt.claim.sub', v_bruno::text, true);
  insert into public.comments (event_id, author_id, body) values (v_dinner, v_bruno, 'Ótimo, eu levo as bebidas.');

  -- Uma alteração para aparecer no histórico
  update public.events set location = 'Restaurante Central (mesa no terraço)' where id = v_dinner;

  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'Seed aplicado: 4 contas de demonstração (senha Demo@2026!).';
end;
$$;
