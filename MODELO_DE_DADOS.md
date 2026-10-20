# Modelo de dados

Banco: **PostgreSQL 17** (Supabase). Scripts em [`supabase/migrations/`](supabase/migrations), aplicados em ordem pelo nome:

| Arquivo | Conteúdo |
|---|---|
| `20261020000100_base.sql` | Esquema `private`, funções auxiliares, limite de requisições, perfis, preferências, dispositivos |
| `20261020000200_calendars.sql` | Agendas, membros, convites, gatilhos de cadastro e proteção |
| `20261020000300_events.sql` | Eventos, participantes, exceções, lembretes, comentários, operações de sincronização |
| `20261020000400_activity_notifications.sql` | Histórico, avisos, auditoria e gatilhos que os alimentam |
| `20261020000500_rpc.sql` | Funções chamadas pelo app |
| `20261020000600_security.sql` | Regras RLS, permissões de tabela e coluna, tempo real |

## Diagrama ER

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1 para 1"
  PROFILES ||--|| USER_PREFERENCES : "1 para 1"
  PROFILES ||--|| NOTIFICATION_PREFERENCES : "1 para 1"
  PROFILES ||--o{ DEVICES : "possui"
  PROFILES ||--o{ CALENDARS : "é dono"
  PROFILES ||--o{ CALENDAR_MEMBERS : "participa"
  CALENDARS ||--o{ CALENDAR_MEMBERS : "tem"
  CALENDARS ||--o{ INVITATIONS : "gera"
  INVITATIONS |o--o{ CALENDAR_MEMBERS : "originou"
  CALENDARS ||--o{ EVENTS : "contém"
  EVENTS ||--o{ RECURRENCE_EXCEPTIONS : "exceções"
  EVENTS ||--o{ EVENT_ATTENDEES : "participantes"
  PROFILES ||--o{ EVENT_ATTENDEES : "é participante"
  EVENTS ||--o{ REMINDERS : "lembretes"
  PROFILES ||--o{ REMINDERS : "define"
  EVENTS ||--o{ COMMENTS : "comentários"
  CALENDARS ||--o{ ACTIVITY_LOGS : "histórico"
  PROFILES ||--o{ NOTIFICATIONS : "recebe"
  PROFILES ||--o{ SYNC_OPERATIONS : "envia"

  CALENDARS {
    uuid id PK
    uuid owner_id FK
    text name
    text color
    text kind
    text status
    text default_timezone
    timestamptz deleted_at
  }
  EVENTS {
    uuid id PK
    uuid calendar_id FK
    text title
    timestamptz starts_at
    timestamptz ends_at
    date start_date
    date end_date
    text timezone
    text recurrence_rule
    text privacy
    int version
    timestamptz deleted_at
  }
  CALENDAR_MEMBERS {
    uuid id PK
    uuid calendar_id FK
    uuid user_id FK
    text role
    text status
  }
  INVITATIONS {
    uuid id PK
    uuid calendar_id FK
    bytea code_hash
    text role
    text status
    timestamptz expires_at
  }
```

## Convenções

- Chaves primárias `uuid` (geradas pelo banco ou pelo app, no caso de eventos, para evitar duplicatas offline).
- Enumerações são `text` com `CHECK` (mais fáceis de evoluir).
- `created_at`/`updated_at` em todas as tabelas de conteúdo; `updated_at` mantido por gatilho.
- Exclusão lógica (`deleted_at`) em agendas, eventos e comentários.
- Todas as tabelas têm **RLS ligado**. O que cada pessoa vê está descrito em "Acesso".

## Tabelas

### `auth.users` (Supabase Auth)
**Finalidade:** contas de login. Gerenciada pelo Supabase: e-mail, hash bcrypt da senha, confirmação (`email_confirmed_at`), metadados. Substitui a tabela `users` sugerida (D16).

### `profiles`
**Finalidade:** dados mínimos visíveis a quem divide agenda com a pessoa.

| Campo | Tipo | Obrig. | Observação |
|---|---|:-:|---|
| `id` | uuid | ✓ | PK e FK para `auth.users` (exclusão em cascata) |
| `display_name` | text | ✓ | 1 a 80 caracteres |
| `avatar_color` | text | ✓ | `#RRGGBB` |
| `avatar_url` | text | | Reservado para foto (futuro) |
| `account_status` | text | ✓ | `active`, `suspended`, `pending_deletion` |
| `last_seen_at` | timestamptz | | Último acesso |
| `deletion_scheduled_at` | timestamptz | | Reservado para exclusão com carência (futuro) |
| `created_at`, `updated_at` | timestamptz | ✓ | |

**Acesso:** a pessoa lê o próprio perfil e o de quem divide agenda ativa; só as colunas `id, display_name, avatar_color, avatar_url, created_at` são legíveis pela API (o e-mail nunca aparece aqui). Atualiza só nome e cor do próprio perfil.

### `user_preferences`
**Finalidade:** preferências privadas (1 para 1 com perfil). Campos: `locale` (pt-BR), `timezone` (IANA, validado por gatilho), `use_device_timezone`, `date_format`, `time_format` (24h/12h), `theme` (system/light/dark), `week_starts_on` (0 domingo, 1 segunda). **Acesso:** só a própria pessoa.

### `notification_preferences`
**Finalidade:** preferências de aviso. Campos: `enabled`, `quiet_hours_start/end` (ambos ou nenhum), `show_details_on_lock_screen` (padrão falso), `default_reminder_minutes`, `notify_invites`, `notify_event_changes`, `notify_member_changes`, `notify_comments`, `notify_reminders`, `sound`, `vibration`. **Acesso:** só a própria pessoa.

### `devices`
**Finalidade:** aparelhos conectados (e, no futuro, token de push). Campos: `installation_id` (único por pessoa), `platform`, `device_name`, `os_version`, `app_version`, `push_token`, `last_seen_at`. Máximo de 20 por pessoa (os mais antigos saem). **Acesso:** ler e apagar os próprios; gravação via `register_device`.

### `calendars`
**Finalidade:** agendas.

| Campo | Tipo | Obrig. | Observação |
|---|---|:-:|---|
| `id` | uuid | ✓ | PK |
| `owner_id` | uuid | ✓ | FK `profiles` (restrict: a conta não é apagada com agenda compartilhada) |
| `name` | text | ✓ | 1 a 80 |
| `description` | text | | até 500 |
| `color` | text | ✓ | `#RRGGBB` |
| `icon` | text | | opcional |
| `kind` | text | ✓ | personal, shared, family, work, project, travel, custom |
| `status` | text | ✓ | active, archived |
| `visibility` | text | ✓ | private (único valor na V1) |
| `default_timezone` | text | ✓ | IANA |
| `default_member_role` | text | ✓ | papel sugerido em convites |
| `admins_can_invite`, `members_can_invite` | boolean | ✓ | configurações de convite |
| `editors_can_edit_all`, `allow_private_events` | boolean | ✓ | política de eventos |
| `conflict_policy` | text | ✓ | warn, block, ignore |
| `notify_members_on_changes` | boolean | ✓ | configuração de notificação |
| `archived_at`, `deleted_at` | timestamptz | | arquivamento e lixeira |

**Acesso:** membros ativos leem (o dono também vê na lixeira). Dono e administrador alteram configurações comuns; só o dono altera as exclusivas (gatilho). Arquivar/lixeira/excluir só pelo dono via `set_calendar_state`.

### `calendar_members`
**Finalidade:** relação pessoa x agenda (N para N).

| Campo | Tipo | Obrig. | Observação |
|---|---|:-:|---|
| `id` | uuid | ✓ | PK |
| `calendar_id`, `user_id` | uuid | ✓ | FKs; par único |
| `role` | text | ✓ | owner, admin, editor, collaborator, viewer |
| `status` | text | ✓ | active, removed, left |
| `joined_at`, `last_activity_at` | timestamptz | | |
| `granted_by`, `removed_by` | uuid | | quem concedeu / removeu |
| `invitation_id` | uuid | | convite de origem |
| `notifications_enabled` | boolean | ✓ | aviso individual por agenda |
| `removed_at` | timestamptz | | |

**Integridade:** índice único parcial garante **um proprietário ativo** por agenda. **Acesso:** membros da agenda leem; a pessoa só altera `notifications_enabled` da própria linha; papéis e status só por funções.

### `invitations`
**Finalidade:** convites. Campos: `calendar_id`, `created_by`, `invited_email` (minúsculo, opcional), `role`, `code_hash` (SHA-256, único), `code_hint` (4 últimos caracteres), `expires_at`, `max_uses`, `use_count`, `status`, `accepted_at`, `accepted_by`, `cancelled_at`, `cancelled_by`. Índice único parcial: um convite pendente por e-mail por agenda. **Acesso:** nenhum direto; tudo por funções.

### `events`
**Finalidade:** eventos (e séries recorrentes).

| Campo | Tipo | Obrig. | Observação |
|---|---|:-:|---|
| `id` | uuid | ✓ | PK (pode ser gerado no aparelho) |
| `calendar_id` | uuid | ✓ | FK (cascata); não pode mudar |
| `title` | text | ✓ | 1 a 150 |
| `description`, `location`, `address`, `url` | text | | limites 5000/200/300/2048; URL http(s) |
| `all_day` | boolean | ✓ | |
| `starts_at`, `ends_at` | timestamptz | ✓ | instantes UTC; fim > início; até 366 dias |
| `start_date`, `end_date` | date | dia inteiro | datas locais |
| `timezone` | text | ✓ | IANA |
| `recurrence_rule` | text | | RRULE (subconjunto validado por regex) |
| `created_by`, `updated_by`, `assignee_id` | uuid | | FK `profiles` (set null) |
| `color` | text | | cor própria (senão, a da agenda) |
| `event_type` | text | ✓ | appointment, meeting, task, reminder, birthday, travel, holiday, social, work, custom |
| `status` | text | ✓ | planned, confirmed, completed, cancelled, postponed, archived |
| `privacy` | text | ✓ | members, participants, private, busy |
| `version` | integer | ✓ | controle de concorrência (gatilho incrementa) |
| `change_origin` | text | ✓ | app, offline_sync, system |
| `completed_at`, `deleted_at` | timestamptz | | |

**Índices:** (`calendar_id`, `starts_at`, `ends_at`) sem excluídos; séries recorrentes por agenda; `created_by`. **Acesso:** ver seção "Privacidade" em [DECISOES.md](DECISOES.md#d11-privacidade-de-eventos).

### `recurrence_exceptions`
**Finalidade:** alterações ou cancelamentos de uma ocorrência. Chave única (`event_id`, `original_date`). Campos de substituição opcionais: `title`, `description`, `location`, `starts_at`/`ends_at` (ambos ou nenhum). Substitui `event_recurrences` + `recurrence_exceptions` do prompt (D16).

### `event_attendees`
**Finalidade:** participantes escolhidos. PK (`event_id`, `user_id`); `response` (pending, accepted, declined, tentative). Participante precisa ser membro ativo.

### `reminders`
**Finalidade:** lembretes pessoais. Único (`event_id`, `user_id`, `minutes_before`); 0 a 40.320 minutos; até 5 por evento por pessoa. **Acesso:** só os próprios.

### `comments`
**Finalidade:** comentários em eventos. `body` até 2.000 caracteres (caracteres de controle removidos), `edited_at`, `deleted_at`. **Acesso:** quem vê o evento por completo lê; colaborador ou acima comenta; autor edita; autor ou administração apaga.

### `sync_operations`
**Finalidade:** idempotência da sincronização. PK = id da operação; guarda só `{status, código, event_id, versão}`. Retenção: 30 dias.

### `activity_logs`
**Finalidade:** histórico visível. `action` (lista fechada), `details` (jsonb sem dados privados), `visibility` (members/admins). Retenção: enquanto a agenda existir.

### `notifications`
**Finalidade:** central de avisos dentro do app. `type`, `title`, `body`, `data`, `read_at`. Retenção: lidos são apagados após 90 dias pela manutenção.

### `audit_logs`
**Finalidade:** auditoria interna (ações administrativas). Sem acesso pela API; leitura só no painel do Supabase.

### `private.rate_limit_hits`
**Finalidade:** contador de tentativas para limite de requisições. Esquema não exposto. Retenção: 1 dia.

## Cardinalidades

- Pessoa 1:1 perfil, preferências, preferências de aviso.
- Pessoa N:N agenda (via `calendar_members`).
- Agenda 1:N eventos, convites, histórico.
- Evento 1:N exceções, participantes, lembretes, comentários.

## Políticas de exclusão

| Ação | Efeito |
|---|---|
| Excluir evento | `deleted_at` (some das telas); pode ser restaurado; apagado de vez após 30 dias pela manutenção |
| Agenda para a lixeira | `deleted_at`; membros perdem acesso; dono restaura em até 30 dias |
| Excluir agenda definitivamente | Cascata: membros, convites, eventos, exceções, lembretes, comentários, histórico |
| Remover membro | `status = removed`; lembretes e participações dele naquela agenda são apagados |
| Excluir conta | Agendas próprias apagadas; comentários apagados; eventos criados em agendas de outras pessoas ficam sem autor; perfil, preferências, aparelhos, lembretes, avisos apagados em cascata |

## Consultas importantes

| Necessidade | Função |
|---|---|
| Minhas agendas com meu papel | `list_my_calendars()` |
| Eventos visíveis num período (com mascaramento) | `list_events(agendas, de, até)` |
| Busca respeitando permissões | `search_events(texto)` |
| Gravar evento com versão e idempotência | `apply_event_op(...)` |
| Membros | `list_calendar_members(agenda)` |
| Histórico | `list_activity(agenda, evento?)` |
| Exportar meus dados | `export_my_data()` |

## Seeds e dados de demonstração

[`supabase/seed.sql`](supabase/seed.sql): 4 pessoas fictícias (`*.demo@exemplo.test`, senha `Demo@2026!`), agenda pessoal de cada uma, agenda compartilhada com papéis diferentes, eventos passados, futuros, recorrente (com uma ocorrência cancelada), privado, ocupado, cancelado, de dia inteiro, lembretes, comentários e histórico. **Só roda em banco sem usuários.**

## Backup e restauração

**Plano gratuito do Supabase:** não inclui backups diários com restauração pelo painel. Recomendações:

1. **Backup manual semanal** (computador com Supabase CLI instalado):
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db dump --data-only -f backup-dados-AAAA-MM-DD.sql
   npx supabase db dump -f backup-estrutura-AAAA-MM-DD.sql
   ```
   Guarde os arquivos fora do repositório (contêm dados pessoais). Nunca faça commit deles.
2. **Planos pagos:** backups diários automáticos e restauração para um ponto no tempo (PITR).

**Restauração** (em projeto novo ou vazio):
1. Aplique as migrations (`supabase db push` ou cole cada arquivo no SQL Editor, em ordem).
2. Rode o backup de dados no SQL Editor ou com `psql`.
3. Teste entrando com uma conta e conferindo agendas e eventos.

## Estratégia de migrações

- Cada mudança no banco é um **novo arquivo** em `supabase/migrations/` com data no nome. Nunca edite migration já aplicada em produção.
- Mudanças compatíveis primeiro (adicionar coluna opcional), remoções depois, em outra versão do app.
- Toda migration nova precisa passar nos testes (`cd supabase && npm test`).
- Aplicação em produção: `npx supabase db push` (CLI) ou SQL Editor do painel.

## Tabelas futuras

`attachments` (anexos): `id`, `event_id`, `uploaded_by`, `storage_path`, `mime_type`, `size_bytes`, `created_at`, com bucket privado no Supabase Storage e políticas iguais às de comentários, validação de tipo (imagens e PDF) e tamanho (até 10 MB). Ver [ROADMAP.md](ROADMAP.md).
