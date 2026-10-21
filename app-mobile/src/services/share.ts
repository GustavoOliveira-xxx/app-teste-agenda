// Compartilhar texto e salvar arquivos, no celular e no navegador.
//
// Celular: folha de compartilhamento do sistema (WhatsApp, e-mail...).
// Navegador: usa o compartilhamento do sistema quando existe (iPhone, Android);
// senão (computador sem esse recurso), copia o texto. Arquivos são baixados.
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled';

export async function shareMessage(message: string, title?: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    const result = await Share.share({ message, title });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  }
  const nav = globalThis.navigator;
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ text: message, title });
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled';
      // Outros erros (recurso bloqueado pelo navegador): cai para copiar.
    }
  }
  await Clipboard.setStringAsync(message);
  return 'copied';
}

/** Salva dados em um arquivo .json (no navegador, baixa; no celular, compartilha). */
export async function saveJsonFile(filename: string, data: unknown): Promise<ShareResult> {
  const text = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'shared';
  }
  return shareMessage(text, filename);
}
