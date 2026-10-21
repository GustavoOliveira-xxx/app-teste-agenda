// Observa a conexão e o app voltando para a tela, disparando sincronizações.
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { requestSync } from '@/offline/syncEngine';
import { configureNetworkCheck, isOnlineState, recheckOnline } from '@/services/network';
import { onAppForeground } from '@/services/session';
import { useSyncStore } from '@/stores/syncStore';

const PERIODIC_MS = 5 * 60_000;
/** Sem internet, confere de novo a cada 15 s (uma falha de rede pode ter sido passageira). */
const RECHECK_MS = 15_000;

export function useNetworkSync(enabled: boolean): void {
  const online = useSyncStore((s) => s.online);

  useEffect(() => {
    configureNetworkCheck();
    const apply = (isOnline: boolean) => {
      const wasOnline = useSyncStore.getState().online;
      useSyncStore.getState().setOnline(isOnline);
      // A conexão voltou: envia o que ficou pendente e busca novidades.
      if (enabled && isOnline && !wasOnline) requestSync({ pull: true });
    };
    const unsubscribe = NetInfo.addEventListener((state) => apply(isOnlineState(state)));
    return unsubscribe;
  }, [enabled]);

  useEffect(() => {
    if (online) return;
    const timer = setInterval(() => {
      recheckOnline()
        .then((isOnline) => {
          if (!isOnline) return;
          useSyncStore.getState().setOnline(true);
          if (enabled) requestSync({ pull: true });
        })
        .catch(() => undefined);
    }, RECHECK_MS);
    return () => clearInterval(timer);
  }, [online, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onAppForeground();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') requestSync({ pull: true });
    }, PERIODIC_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [enabled]);
}
