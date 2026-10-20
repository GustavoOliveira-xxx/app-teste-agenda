// Texto legível para cada entrada do histórico.
import { strings, tDynamic, t } from '@/i18n';
import type { ActivityEntry, Role } from '@/models/types';

export function describeActivity(entry: ActivityEntry, myUserId: string | null): string {
  const actor = entry.actor_id && entry.actor_id === myUserId ? t('common.you') : entry.actor_name;
  const member =
    entry.details.member_id && entry.details.member_id === myUserId
      ? t('common.you')
      : (entry.member_name ?? t('common.someone'));
  const title = typeof entry.details.title === 'string' ? `"${entry.details.title}"` : t('activity.anEvent');
  const role = typeof entry.details.to === 'string' ? strings.roles[entry.details.to as Role] : '';
  const base = tDynamic(`activity.actions.${entry.action}`, { actor, member, title, role });
  const changed = Array.isArray(entry.details.changed) ? (entry.details.changed as string[]) : [];
  if (entry.action === 'event_updated' && changed.length) {
    const fields = changed.map((c) => tDynamic(`activity.changed.${c}`)).join(', ');
    return `${base}. ${t('activity.changedPrefix', { fields })}`;
  }
  return base;
}
