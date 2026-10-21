import { useEffect, useState } from 'react';

import { checkForUpdate, type AvailableUpdate } from '@/services/updates';

/** Versão nova do app Android publicada no GitHub (ou null). */
export function useAvailableUpdate(): AvailableUpdate | null {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  useEffect(() => {
    let active = true;
    void checkForUpdate().then((u) => {
      if (active) setUpdate(u);
    });
    return () => {
      active = false;
    };
  }, []);
  return update;
}
