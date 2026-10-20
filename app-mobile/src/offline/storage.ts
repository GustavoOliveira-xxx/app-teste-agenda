// Armazenamento local (cache) separado por usuário.
// Ao sair da conta, tudo do usuário é apagado deste aparelho.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PREFIX = 'agenda:v1';

export const storageKeys = {
  calendars: (uid: string) => `${PREFIX}:${uid}:calendars`,
  events: (uid: string) => `${PREFIX}:${uid}:events`,
  members: (uid: string) => `${PREFIX}:${uid}:members`,
  window: (uid: string) => `${PREFIX}:${uid}:window`,
  account: (uid: string) => `${PREFIX}:${uid}:account`,
  notifications: (uid: string) => `${PREFIX}:${uid}:notifications`,
  outbox: (uid: string) => `${PREFIX}:${uid}:outbox`,
  syncMeta: (uid: string) => `${PREFIX}:${uid}:sync-meta`,
  errorLog: `${PREFIX}:error-log`,
  installationId: `${PREFIX}:installation-id`,
};

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Falha ao gravar cache local', error);
  }
}

/** Apaga todos os dados locais de um usuário (logout, conta excluída). */
export async function clearUserData(uid: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(`${PREFIX}:${uid}:`)));
}

/** Identificador desta instalação do app (não identifica a pessoa). */
export async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(storageKeys.installationId);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(storageKeys.installationId, id);
  return id;
}

export function newId(): string {
  return Crypto.randomUUID();
}
