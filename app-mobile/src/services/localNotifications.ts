// Lembretes como notificações LOCAIS: agendadas no próprio celular, funcionam
// sem internet e com o app fechado. A cada sincronização, todos os lembretes
// são recriados do zero (evita duplicidade e cobre evento alterado, cancelado,
// série recorrente, troca de fuso e troca de aparelho).
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import type { NotificationPreferences, Occurrence, TimeFormat } from '@/models/types';
import { formatOccurrenceTime, isWithinQuietHours } from '@/utils/dates';

import { logError } from './errorLog';

const CHANNEL_PRIVATE = 'lembretes';
const CHANNEL_PUBLIC = 'lembretes-detalhes';
const CHANNEL_QUIET = 'lembretes-silencio';
const HORIZON_DAYS = 30;
const MAX_SCHEDULED = 60;

export const notificationsSupported = Platform.OS !== 'web';

export function configureNotifications(): void {
  if (!notificationsSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const base = { vibrationPattern: [0, 250, 150, 250], lightColor: '#3358D4' };
  // Canal com conteúdo oculto na tela bloqueada (padrão, mais privado).
  await Notifications.setNotificationChannelAsync(CHANNEL_PRIVATE, {
    ...base,
    name: t('reminders.channelName'),
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_PUBLIC, {
    ...base,
    name: `${t('reminders.channelName')} (detalhes visíveis)`,
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
    name: `${t('reminders.channelName')} (silencioso)`,
    importance: AndroidImportance.LOW,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    enableVibrate: false,
    sound: null,
  });
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!notificationsSupported) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  await ensureChannels();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

interface ReminderCandidate {
  at: Date;
  occ: Occurrence;
  minutes: number;
}

/** Calcula quais lembretes agendar (função pura, testável). */
export function planReminders(occurrences: Occurrence[], now: Date = new Date()): ReminderCandidate[] {
  const horizon = now.getTime() + HORIZON_DAYS * 86_400_000;
  const list: ReminderCandidate[] = [];
  for (const occ of occurrences) {
    if (occ.event.status === 'cancelled' || occ.event.status === 'completed') continue;
    for (const minutes of occ.event.my_reminders ?? []) {
      const at = new Date(occ.start.getTime() - minutes * 60_000);
      if (at.getTime() > now.getTime() && at.getTime() <= horizon) list.push({ at, occ, minutes });
    }
  }
  return list.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

export async function rescheduleReminders(
  occurrences: Occurrence[],
  prefs: NotificationPreferences | null,
  timezone: string,
  timeFormat: TimeFormat,
): Promise<number> {
  if (!notificationsSupported) return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (prefs && (!prefs.enabled || !prefs.notify_reminders)) return 0;
    if ((await getPermissionStatus()) !== 'granted') return 0;
    await ensureChannels();

    const plan = planReminders(occurrences);
    for (const { at, occ, minutes } of plan) {
      const quiet = isWithinQuietHours(
        at,
        timezone,
        prefs?.quiet_hours_start ?? null,
        prefs?.quiet_hours_end ?? null,
      );
      const channelId = quiet
        ? CHANNEL_QUIET
        : prefs?.show_details_on_lock_screen
          ? CHANNEL_PUBLIC
          : CHANNEL_PRIVATE;
      const title = occ.event.is_masked
        ? t('reminders.lockedContent')
        : (occ.title ?? t('reminders.lockedContent'));
      const when = formatOccurrenceTime(occ, timezone, timeFormat);
      await Notifications.scheduleNotificationAsync({
        identifier: `rem:${occ.key}:${minutes}`,
        content: {
          title,
          body: [when, occ.location].filter(Boolean).join(' · '),
          data: { eventId: occ.event.id, originalDate: occ.originalDate },
          sound: !quiet && prefs?.sound !== false ? 'default' : false,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
      });
    }
    return plan.length;
  } catch (error) {
    await logError('lembretes', error);
    return 0;
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
}
