// Todas as chamadas ao backend ficam aqui. Se um dia o backend mudar
// (ex.: API própria), só este arquivo e services/auth.ts precisam mudar.
import type {
  Account,
  ActivityEntry,
  AppNotification,
  Calendar,
  CalendarEvent,
  CreatedInvitation,
  DeletionImpact,
  Device,
  EventComment,
  InvitationPreview,
  InvitationSummary,
  Member,
  NotificationPreferences,
  ReceivedInvitation,
  Role,
  UserPreferences,
} from '@/models/types';

import { supabase, unwrap } from './supabase';

// ------------------------------------------------------------------ conta

export async function getMyAccount(): Promise<Account> {
  return unwrap(await supabase.rpc('get_my_account')) as Account;
}

export async function updateProfile(
  userId: string,
  changes: { display_name?: string; avatar_color?: string },
) {
  unwrap(await supabase.from('profiles').update(changes).eq('id', userId));
}

export async function updatePreferences(userId: string, changes: Partial<UserPreferences>) {
  unwrap(await supabase.from('user_preferences').update(changes).eq('user_id', userId));
}

export async function updateNotificationPreferences(
  userId: string,
  changes: Partial<NotificationPreferences>,
) {
  unwrap(await supabase.from('notification_preferences').update(changes).eq('user_id', userId));
}

export async function registerDevice(args: {
  installationId: string;
  platform: string;
  deviceName: string | null;
  osVersion: string | null;
  appVersion: string;
}) {
  unwrap(
    await supabase.rpc('register_device', {
      p_installation_id: args.installationId,
      p_platform: args.platform,
      p_device_name: args.deviceName,
      p_os_version: args.osVersion,
      p_app_version: args.appVersion,
    }),
  );
}

export async function listDevices(): Promise<Device[]> {
  return unwrap(
    await supabase
      .from('devices')
      .select('id, installation_id, platform, device_name, os_version, app_version, last_seen_at, created_at')
      .order('last_seen_at', { ascending: false }),
  ) as Device[];
}

export async function removeDevice(id: string) {
  unwrap(await supabase.from('devices').delete().eq('id', id));
}

export async function exportMyData(): Promise<Record<string, unknown>> {
  return unwrap(await supabase.rpc('export_my_data')) as Record<string, unknown>;
}

export async function accountDeletionImpact(): Promise<DeletionImpact> {
  return unwrap(await supabase.rpc('account_deletion_impact')) as DeletionImpact;
}

export async function deleteMyAccount(confirmation: string) {
  unwrap(await supabase.rpc('delete_my_account', { p_confirmation: confirmation }));
}

// ---------------------------------------------------------------- agendas

export async function listMyCalendars(): Promise<Calendar[]> {
  return unwrap(await supabase.rpc('list_my_calendars')) as Calendar[];
}

export type CalendarInput = Pick<
  Calendar,
  | 'name'
  | 'description'
  | 'color'
  | 'kind'
  | 'default_timezone'
  | 'default_member_role'
  | 'admins_can_invite'
  | 'members_can_invite'
  | 'editors_can_edit_all'
  | 'allow_private_events'
  | 'conflict_policy'
  | 'notify_members_on_changes'
>;

export async function createCalendar(input: Partial<CalendarInput> & { name: string }): Promise<string> {
  const data = unwrap(await supabase.from('calendars').insert(input).select('id').single()) as { id: string };
  return data.id;
}

export async function updateCalendar(id: string, changes: Partial<CalendarInput>) {
  unwrap(await supabase.from('calendars').update(changes).eq('id', id));
}

export async function setCalendarState(
  id: string,
  action: 'archive' | 'unarchive' | 'trash' | 'restore' | 'purge',
) {
  unwrap(await supabase.rpc('set_calendar_state', { p_calendar_id: id, p_action: action }));
}

export async function duplicateCalendar(id: string, name: string, includeEvents: boolean): Promise<string> {
  return unwrap(
    await supabase.rpc('duplicate_calendar', {
      p_calendar_id: id,
      p_name: name,
      p_include_events: includeEvents,
    }),
  ) as string;
}

export async function setMyCalendarNotifications(calendarId: string, userId: string, enabled: boolean) {
  unwrap(
    await supabase
      .from('calendar_members')
      .update({ notifications_enabled: enabled })
      .eq('calendar_id', calendarId)
      .eq('user_id', userId),
  );
}

// ----------------------------------------------------------------- membros

export async function listMembers(calendarId: string): Promise<Member[]> {
  return unwrap(await supabase.rpc('list_calendar_members', { p_calendar_id: calendarId })) as Member[];
}

export async function changeMemberRole(memberId: string, role: Exclude<Role, 'owner'>) {
  unwrap(await supabase.rpc('change_member_role', { p_member_id: memberId, p_role: role }));
}

export async function removeMember(memberId: string) {
  unwrap(await supabase.rpc('remove_member', { p_member_id: memberId }));
}

export async function leaveCalendar(calendarId: string) {
  unwrap(await supabase.rpc('leave_calendar', { p_calendar_id: calendarId }));
}

export async function transferOwnership(calendarId: string, newOwnerId: string) {
  unwrap(await supabase.rpc('transfer_ownership', { p_calendar_id: calendarId, p_new_owner_id: newOwnerId }));
}

// ----------------------------------------------------------------- convites

export async function createInvitation(args: {
  calendarId: string;
  role: Exclude<Role, 'owner'>;
  email: string | null;
  expiresInHours: number | null;
  maxUses: number | null;
}): Promise<CreatedInvitation> {
  return unwrap(
    await supabase.rpc('create_invitation', {
      p_calendar_id: args.calendarId,
      p_role: args.role,
      p_email: args.email,
      p_expires_in_hours: args.expiresInHours,
      p_max_uses: args.maxUses,
    }),
  ) as CreatedInvitation;
}

export async function listInvitations(calendarId: string): Promise<InvitationSummary[]> {
  return unwrap(
    await supabase.rpc('list_calendar_invitations', { p_calendar_id: calendarId }),
  ) as InvitationSummary[];
}

export async function cancelInvitation(id: string) {
  unwrap(await supabase.rpc('cancel_invitation', { p_invitation_id: id }));
}

export async function previewInvitation(code: string): Promise<InvitationPreview> {
  return unwrap(await supabase.rpc('preview_invitation', { p_code: code })) as InvitationPreview;
}

export async function acceptInvitation(
  code: string,
): Promise<{ ok: boolean; error?: string; calendar_id?: string; already_member?: boolean }> {
  return unwrap(await supabase.rpc('accept_invitation', { p_code: code })) as {
    ok: boolean;
    error?: string;
    calendar_id?: string;
  };
}

export async function myInvitations(): Promise<ReceivedInvitation[]> {
  return unwrap(await supabase.rpc('my_invitations')) as ReceivedInvitation[];
}

export async function respondInvitation(
  id: string,
  accept: boolean,
): Promise<{ ok: boolean; error?: string; calendar_id?: string }> {
  return unwrap(await supabase.rpc('respond_invitation', { p_invitation_id: id, p_accept: accept })) as {
    ok: boolean;
    error?: string;
    calendar_id?: string;
  };
}

// ------------------------------------------------------------------ eventos

export async function listEvents(calendarIds: string[], from: Date, to: Date): Promise<CalendarEvent[]> {
  return unwrap(
    await supabase.rpc('list_events', {
      p_calendar_ids: calendarIds,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  ) as CalendarEvent[];
}

export async function searchEvents(query: string, limit = 50): Promise<CalendarEvent[]> {
  return unwrap(await supabase.rpc('search_events', { p_query: query, p_limit: limit })) as CalendarEvent[];
}

export interface EventOpResult {
  status: 'ok' | 'conflict' | 'error';
  code?: string;
  reason?: 'version' | 'deleted';
  event?: Partial<CalendarEvent>;
  new_event?: Partial<CalendarEvent>;
  replayed?: boolean;
}

export async function applyEventOp(args: {
  opId: string;
  kind: string;
  eventId: string;
  payload: Record<string, unknown>;
  baseVersion: number | null;
  origin: 'app' | 'offline_sync';
}): Promise<EventOpResult> {
  return unwrap(
    await supabase.rpc('apply_event_op', {
      p_op_id: args.opId,
      p_kind: args.kind,
      p_event_id: args.eventId,
      p_payload: args.payload,
      p_base_version: args.baseVersion,
      p_origin: args.origin,
    }),
  ) as EventOpResult;
}

export async function setEventReminders(eventId: string, minutes: number[]) {
  unwrap(await supabase.rpc('set_event_reminders', { p_event_id: eventId, p_minutes: minutes }));
}

export async function setEventAttendees(eventId: string, userIds: string[]) {
  unwrap(await supabase.rpc('set_event_attendees', { p_event_id: eventId, p_user_ids: userIds }));
}

// ------------------------------------------------- comentários e histórico

export type AttendeeResponse = 'pending' | 'accepted' | 'declined' | 'tentative';

/** Resposta de cada participante ("Você vai?"). */
export async function listAttendeeResponses(eventId: string): Promise<Record<string, AttendeeResponse>> {
  const rows = unwrap(
    await supabase.from('event_attendees').select('event_id,user_id,response').eq('event_id', eventId),
  ) as { event_id: string; user_id: string; response: AttendeeResponse }[];
  return Object.fromEntries(rows.filter((r) => r.event_id === eventId).map((r) => [r.user_id, r.response]));
}

export async function setMyResponse(eventId: string, userId: string, response: AttendeeResponse) {
  unwrap(
    await supabase.from('event_attendees').update({ response }).eq('event_id', eventId).eq('user_id', userId),
  );
}

export async function listComments(eventId: string): Promise<EventComment[]> {
  return unwrap(await supabase.rpc('list_event_comments', { p_event_id: eventId })) as EventComment[];
}

export async function addComment(eventId: string, body: string) {
  unwrap(await supabase.from('comments').insert({ event_id: eventId, body }));
}

export async function editComment(id: string, body: string) {
  unwrap(await supabase.from('comments').update({ body }).eq('id', id));
}

export async function deleteComment(id: string) {
  unwrap(await supabase.rpc('delete_comment', { p_comment_id: id }));
}

export async function listActivity(
  calendarId: string,
  options: { eventId?: string; beforeId?: number; limit?: number } = {},
): Promise<ActivityEntry[]> {
  return unwrap(
    await supabase.rpc('list_activity', {
      p_calendar_id: calendarId,
      p_event_id: options.eventId ?? null,
      p_limit: options.limit ?? 50,
      p_before_id: options.beforeId ?? null,
    }),
  ) as ActivityEntry[];
}

// ------------------------------------------------------------------- avisos

export async function listNotifications(limit = 100): Promise<AppNotification[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('id, type, calendar_id, event_id, actor_id, title, body, data, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as AppNotification[];
}

export async function markNotificationsRead(ids?: string[]) {
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (ids) query = query.in('id', ids);
  unwrap(await query);
}

export async function deleteReadNotifications() {
  unwrap(await supabase.from('notifications').delete().not('read_at', 'is', null));
}
