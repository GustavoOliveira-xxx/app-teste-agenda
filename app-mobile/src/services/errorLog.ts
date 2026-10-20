// Registro local de erros (observabilidade). Guarda as últimas falhas,
// sem dados sensíveis, para a tela de Diagnóstico.
import { readJSON, storageKeys, writeJSON } from '@/offline/storage';
import { redact } from '@/utils/errors';

export interface ErrorEntry {
  at: string;
  where: string;
  message: string;
}

const MAX = 50;
let entries: ErrorEntry[] = [];
let loaded = false;

async function load() {
  if (loaded) return;
  entries = await readJSON<ErrorEntry[]>(storageKeys.errorLog, []);
  loaded = true;
}

export async function logError(where: string, error: unknown): Promise<void> {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
  const message = redact(raw ?? 'erro desconhecido').slice(0, 300);
  console.warn(`[${where}]`, message);
  await load();
  entries = [{ at: new Date().toISOString(), where, message }, ...entries].slice(0, MAX);
  await writeJSON(storageKeys.errorLog, entries);
}

export async function getErrorLog(): Promise<ErrorEntry[]> {
  await load();
  return entries;
}

export async function clearErrorLog(): Promise<void> {
  entries = [];
  await writeJSON(storageKeys.errorLog, []);
}
