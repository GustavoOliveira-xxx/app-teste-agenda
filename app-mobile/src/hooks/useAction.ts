// Executa uma ação que precisa do servidor: avisa se estiver sem internet
// (regra 23), mostra "carregando" e traduz erros para mensagens amigáveis.
import { useCallback, useState } from 'react';

import { useFeedback } from '@/components/Feedback';
import { t } from '@/i18n';
import { logError } from '@/services/errorLog';
import { useSyncStore } from '@/stores/syncStore';
import { toFriendlyError } from '@/utils/errors';

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error?: string };

export function useAction() {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T>(
      fn: () => Promise<T>,
      options: { success?: string; requiresOnline?: boolean } = {},
    ): Promise<ActionResult<T>> => {
      if (options.requiresOnline !== false && !useSyncStore.getState().online) {
        toast(t('common.requiresInternet'), 'error');
        return { ok: false };
      }
      setBusy(true);
      try {
        const value = await fn();
        if (options.success) toast(options.success);
        return { ok: true, value };
      } catch (error) {
        const friendly = toFriendlyError(error);
        if (friendly.code === 'UNKNOWN') void logError('acao', error);
        toast(friendly.message, 'error');
        return { ok: false, error: friendly.code };
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return { run, busy };
}
