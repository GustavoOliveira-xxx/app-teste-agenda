// Guarda a sessão de login no armazenamento seguro do celular (Android
// Keystore). Como a sessão pode passar de 2 KB, ela é dividida em partes.
// No navegador (usado só em testes) cai para o localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK = 1800;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const countKey = (key: string) => `${key}.parts`;
const partKey = (key: string, i: number) => `${key}.${i}`;

async function removeChunks(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(countKey(key), options)) ?? 0);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(partKey(key, i), options);
  await SecureStore.deleteItemAsync(countKey(key), options);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const count = Number((await SecureStore.getItemAsync(countKey(key), options)) ?? 0);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(partKey(key, i), options);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(partKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK), options);
    }
    await SecureStore.setItemAsync(countKey(key), String(count), options);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await removeChunks(key);
  },
};
