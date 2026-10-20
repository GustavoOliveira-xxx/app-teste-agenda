// Regras de permissão usadas pela INTERFACE (mostrar ou esconder botões).
// A verdadeira proteção está no banco (RLS e funções do servidor): estas
// funções só evitam que a pessoa veja opções que o servidor vai recusar.
import type { Calendar, CalendarEvent, Role } from '@/models/types';

export const ROLE_RANK: Record<Role, number> = {
  owner: 50,
  admin: 40,
  editor: 30,
  collaborator: 20,
  viewer: 10,
};

export const ASSIGNABLE_ROLES: Exclude<Role, 'owner'>[] = ['admin', 'editor', 'collaborator', 'viewer'];

type CalendarLike = Pick<
  Calendar,
  'my_role' | 'status' | 'deleted_at' | 'editors_can_edit_all' | 'admins_can_invite' | 'members_can_invite'
>;

export function isWritable(calendar: Pick<Calendar, 'status' | 'deleted_at'>): boolean {
  return calendar.status === 'active' && !calendar.deleted_at;
}

export function canCreateEvents(calendar: CalendarLike): boolean {
  return isWritable(calendar) && ROLE_RANK[calendar.my_role] >= ROLE_RANK.collaborator;
}

export function canEditEvent(
  calendar: CalendarLike,
  event: Pick<CalendarEvent, 'created_by' | 'is_masked'>,
  userId: string | null,
): boolean {
  if (!isWritable(calendar) || event.is_masked) return false;
  const role = calendar.my_role;
  if (role === 'owner' || role === 'admin') return true;
  const own = !!userId && event.created_by === userId;
  if (role === 'editor') return calendar.editors_can_edit_all || own;
  if (role === 'collaborator') return own;
  return false;
}

export function canComment(calendar: CalendarLike): boolean {
  return isWritable(calendar) && ROLE_RANK[calendar.my_role] >= ROLE_RANK.collaborator;
}

export function canInvite(calendar: CalendarLike): boolean {
  if (!isWritable(calendar)) return false;
  const role = calendar.my_role;
  return (
    role === 'owner' ||
    (role === 'admin' && calendar.admins_can_invite) ||
    ((role === 'editor' || role === 'collaborator') && calendar.members_can_invite)
  );
}

/** Papéis que alguém pode conceder num convite (ninguém concede papel igual ou maior que o seu). */
export function grantableRoles(myRole: Role): Exclude<Role, 'owner'>[] {
  if (myRole === 'owner') return ASSIGNABLE_ROLES;
  return ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < ROLE_RANK[myRole]);
}

/** Pode alterar o papel / remover outra pessoa? */
export function canManageMember(myRole: Role, targetRole: Role, isSelf: boolean): boolean {
  if (isSelf || targetRole === 'owner') return false;
  if (myRole === 'owner') return true;
  return myRole === 'admin' && ROLE_RANK[targetRole] < ROLE_RANK.admin;
}

/** Papéis que podem ser atribuídos a outra pessoa por quem gerencia. */
export function assignableRolesFor(myRole: Role): Exclude<Role, 'owner'>[] {
  if (myRole === 'owner') return ASSIGNABLE_ROLES;
  if (myRole === 'admin') return ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < ROLE_RANK.admin);
  return [];
}

export function canEditCalendarSettings(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

export function isOwner(role: Role): boolean {
  return role === 'owner';
}
