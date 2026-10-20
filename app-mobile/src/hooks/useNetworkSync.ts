// Observa a conexão e o app voltando para a tela, disparando sincronizações.
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { requestSync } from '@/offline/syncEngine';
import { onAppForeground } from '@/services/session';
import { useSyncStore } from '@/stores/syncStore';

const PERIODIC_MS = 5 * 60_000;

export function useNetworkSync(enabled: boolean): void {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      const wasOnline = useSyncStore.getState().online;
      useSyncStore.getState().setOnline(online);
      // A conexão voltou: envia o que ficou pendente e busca novidades.
      if (enabled && online && !wasOnline) requestSync({ pull: true });
    });
    return unsubscribe;
  }, [enabled]);

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
