// Cópia gerada de app-mobile/src/models/types.ts por scripts/copiar-logica-push.mjs. Não edite aqui.
// Tipos de dados do app. Eles espelham as tabelas e funções do banco
// (veja MODELO_DE_DADOS.md). Datas vêm do servidor como texto ISO 8601.

export type Role = 'owner' | 'admin' | 'editor' | 'collaborator' | 'viewer';

export type CalendarKind = 'personal' | 'shared' | 'family' | 'work' | 'project' | 'travel' | 'custom';

export type ConflictPolicy = 'warn' | 'block' | 'ignore';

export type EventType =
  | 'appointment'
  | 'meeting'
  | 'task'
  | 'reminder'
  | 'birthday'
  | 'travel'
  | 'holiday'
  | 'social'
  | 'work'
  | 'custom';

export type EventStatus = 'planned' | 'confirmed' | 'completed' | 'cancelled' | 'postponed' | 'archived';

export type EventPrivacy = 'members' | 'participants' | 'private' | 'busy';

/** Data local sem horário, no formato AAAA-MM-DD (ex.: 2026-12-25). */
export type DateKey = string;

export interface Calendar {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  kind: CalendarKind;
  status: 'active' | 'archived';
  default_timezone: string;
  default_member_role: Exclude<Role, 'owner'>;
  admins_can_invite: boolean;
  members_can_invite: boolean;
  editors_can_edit_all: boolean;
  allow_private_events: boolean;
  conflict_policy: ConflictPolicy;
  notify_members_on_changes: boolean;
  owner_id: string;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  my_role: Role;
  my_notifications_enabled: boolean;
  member_count: number;
}

export interface RecurrenceException {
  original_date: DateKey;
  is_cancelled: boolean;
  title: string | null;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

/** Campos de um evento que o app pode enviar ao servidor. */
export interface EventFields {
  title: string;
  description: string | null;
  location: string | null;
  address: string | null;
  url: string | null;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  start_date: DateKey | null;
  end_date: DateKey | null;
  timezone: string;
  recurrence_rule: string | null;
  assignee_id: string | null;
  color: string | null;
  event_type: EventType;
  status: EventStatus;
  privacy: EventPrivacy;
}

export interface CalendarEvent extends Omit<EventFields, 'title'> {
  id: string;
  calendar_id: string;
  /** null quando o evento está mascarado ("Ocupado"). */
  title: string | null;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  completed_at: string | null;
  is_masked: boolean;
  exceptions: RecurrenceException[];
  attendee_ids: string[];
  my_reminders: number[];
  /** Preenchido apenas em respostas de escrita (evento na lixeira). */
  deleted_at?: string | null;
  /** Somente no app: o evento tem alterações ainda não enviadas. */
  pending?: boolean;
}

/** Uma ocorrência concreta de um evento (eventos recorrentes geram várias). */
export interface Occurrence {
  key: string;
  event: CalendarEvent;
  /** Data local (no fuso do evento) da ocorrência original na série. */
  originalDate: DateKey;
  start: Date;
  end: Date;
  allDay: boolean;
  /** Para eventos de dia inteiro: datas locais (inclusivas). */
  startDate: DateKey | null;
  endDate: DateKey | null;
  title: string | null;
  description: string | null;
  location: string | null;
  isRecurring: boolean;
  isException: boolean;
}

export interface Member {
  member_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  last_activity_at: string | null;
  display_name: string;
  avatar_color: string;
  notifications_enabled: boolean | null;
  is_me: boolean;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'exhausted';

export interface InvitationSummary {
  id: string;
  invited_email: string | null;
  role: Exclude<Role, 'owner'>;
  code_hint: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  status: InvitationStatus;
  created_by_name: string;
  accepted_by_name: string | null;
}

export interface CreatedInvitation {
  id: string;
  code: string;
  role: Exclude<Role, 'owner'>;
  expires_at: string | null;
  max_uses: number | null;
  invited_email: string | null;
}

export interface InvitationPreview {
  ok: boolean;
  error?: string;
  invitation_id?: string;
  status?: InvitationStatus;
  calendar_id?: string;
  calendar_name?: string;
  calendar_color?: string;
  calendar_kind?: CalendarKind;
  role?: Exclude<Role, 'owner'>;
  inviter_name?: string;
  expires_at?: string | null;
  already_member?: boolean;
}

export interface ReceivedInvitation {
  id: string;
  calendar_id: string;
  calendar_name: string;
  calendar_color: string;
  role: Exclude<Role, 'owner'>;
  inviter_name: string;
  created_at: string;
  expires_at: string | null;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type DateFormat = 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';
export type TimeFormat = '24h' | '12h';

export interface UserPreferences {
  locale: 'pt-BR';
  timezone: string;
  use_device_timezone: boolean;
  date_format: DateFormat;
  time_format: TimeFormat;
  theme: ThemePreference;
  week_starts_on: 0 | 1;
}

export interface NotificationPreferences {
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  show_details_on_lock_screen: boolean;
  default_reminder_minutes: number | null;
  notify_invites: boolean;
  notify_event_changes: boolean;
  notify_member_changes: boolean;
  notify_comments: boolean;
  notify_reminders: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface Account {
  id: string;
  email: string;
  email_confirmed: boolean;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  account_status: 'active' | 'suspended' | 'pending_deletion';
  created_at: string;
  last_seen_at: string | null;
  preferences: UserPreferences;
  notification_preferences: NotificationPreferences;
}

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'event_created'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_deleted'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'ownership_received'
  | 'comment_added';

export interface AppNotification {
  id: string;
  type: NotificationType;
  calendar_id: string | null;
  event_id: string | null;
  actor_id: string | null;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  calendar_id: string;
  event_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  member_name: string | null;
}

export interface EventComment {
  id: string;
  author_id: string | null;
  author_name: string;
  author_color: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  is_mine: boolean;
}

export interface Device {
  id: string;
  installation_id: string;
  platform: 'android' | 'ios' | 'web';
  device_name: string | null;
  os_version: string | null;
  app_version: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface DeletionImpact {
  blocking_calendars: { id: string; name: string; member_count: number }[];
  calendars_to_delete: number;
  events_kept_in_shared_calendars: number;
  comments_to_delete: number;
}
