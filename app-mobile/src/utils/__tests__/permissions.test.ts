import type { Calendar } from '@/models/types';

import {
  assignableRolesFor,
  canComment,
  canCreateEvents,
  canEditEvent,
  canInvite,
  canManageMember,
  grantableRoles,
} from '../permissions';

const cal = (overrides: Partial<Calendar> = {}) =>
  ({
    my_role: 'editor',
    status: 'active',
    deleted_at: null,
    editors_can_edit_all: true,
    admins_can_invite: true,
    members_can_invite: false,
    ...overrides,
  }) as Calendar;

describe('permissões na interface (espelham o servidor)', () => {
  it('visualizador não cria nem comenta; colaborador sim', () => {
    expect(canCreateEvents(cal({ my_role: 'viewer' }))).toBe(false);
    expect(canComment(cal({ my_role: 'viewer' }))).toBe(false);
    expect(canCreateEvents(cal({ my_role: 'collaborator' }))).toBe(true);
  });

  it('agenda arquivada é somente leitura até para o proprietário', () => {
    expect(canCreateEvents(cal({ my_role: 'owner', status: 'archived' }))).toBe(false);
    expect(
      canEditEvent(
        cal({ my_role: 'owner', status: 'archived' }),
        { created_by: 'me', is_masked: false },
        'me',
      ),
    ).toBe(false);
  });

  it('colaborador edita só os próprios; editor depende da política da agenda', () => {
    const mine = { created_by: 'me', is_masked: false };
    const theirs = { created_by: 'other', is_masked: false };
    expect(canEditEvent(cal({ my_role: 'collaborator' }), mine, 'me')).toBe(true);
    expect(canEditEvent(cal({ my_role: 'collaborator' }), theirs, 'me')).toBe(false);
    expect(canEditEvent(cal({ my_role: 'editor' }), theirs, 'me')).toBe(true);
    expect(canEditEvent(cal({ my_role: 'editor', editors_can_edit_all: false }), theirs, 'me')).toBe(false);
    expect(canEditEvent(cal({ my_role: 'admin' }), { created_by: 'other', is_masked: true }, 'me')).toBe(
      false,
    );
  });

  it('quem pode convidar e quais papéis pode conceder', () => {
    expect(canInvite(cal({ my_role: 'owner' }))).toBe(true);
    expect(canInvite(cal({ my_role: 'admin', admins_can_invite: false }))).toBe(false);
    expect(canInvite(cal({ my_role: 'editor' }))).toBe(false);
    expect(canInvite(cal({ my_role: 'editor', members_can_invite: true }))).toBe(true);
    expect(canInvite(cal({ my_role: 'viewer', members_can_invite: true }))).toBe(false);
    expect(grantableRoles('owner')).toEqual(['admin', 'editor', 'collaborator', 'viewer']);
    expect(grantableRoles('admin')).toEqual(['editor', 'collaborator', 'viewer']);
    expect(grantableRoles('collaborator')).toEqual(['viewer']);
  });

  it('gerenciar membros: ninguém mexe em si mesmo nem no proprietário', () => {
    expect(canManageMember('owner', 'admin', false)).toBe(true);
    expect(canManageMember('owner', 'owner', false)).toBe(false);
    expect(canManageMember('admin', 'admin', false)).toBe(false);
    expect(canManageMember('admin', 'viewer', false)).toBe(true);
    expect(canManageMember('admin', 'viewer', true)).toBe(false);
    expect(canManageMember('editor', 'viewer', false)).toBe(false);
    expect(assignableRolesFor('admin')).toEqual(['editor', 'collaborator', 'viewer']);
    expect(assignableRolesFor('editor')).toEqual([]);
  });
});
