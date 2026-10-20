// Atualizações da conta (perfil e preferências) com recarga dos dados.
import type { NotificationPreferences, UserPreferences } from '@/models/types';
import * as api from './api';
import { refreshReminders } from './session';
import { useAuthStore } from '@/stores/authStore';
import { storageKeys, writeJSON } from '@/offline/storage';

export async function reloadAccount(): Promise<void> {
  const account = await api.getMyAccount();
  useAuthStore.getState().setAccount(account);
  await writeJSON(storageKeys.account(account.id), account);
}

export async function savePreferences(changes: Partial<UserPreferences>): Promise<void> {
  const account = useAuthStore.getState().account;
  if (!account) return;
  await api.updatePreferences(account.id, changes);
  await reloadAccount();
  await refreshReminders();
}

export async function saveNotificationPreferences(changes: Partial<NotificationPreferences>): Promise<void> {
  const account = useAuthStore.getState().account;
  if (!account) return;
  await api.updateNotificationPreferences(account.id, changes);
  await reloadAccount();
  await refreshReminders();
}

export async function saveProfile(changes: { display_name?: string; avatar_color?: string }): Promise<void> {
  const account = useAuthStore.getState().account;
  if (!account) return;
  await api.updateProfile(account.id, changes);
  await reloadAccount();
}
