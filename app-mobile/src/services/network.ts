// Como o app decide se está "com internet".
//
// No Android e no iPhone, o próprio sistema informa. No navegador, a biblioteca
// testa a conexão pedindo um endereço; por padrão ela pede a raiz do domínio,
// que no GitHub Pages (site numa subpasta) responde 404 e fazia o app achar que
// estava sem internet. Aqui o teste pede o manifesto do próprio site, que
// sempre existe. O pedido é do tipo HEAD, que o service worker não responde
// com a cópia guardada: sem internet ele falha de verdade.
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

let configured = false;

export function configureNetworkCheck(): void {
  if (configured || Platform.OS !== 'web' || typeof window === 'undefined') return;
  configured = true;
  const base = String(Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/+$/, '');
  NetInfo.configure({
    reachabilityUrl: `${window.location.origin}${base}/manifest.webmanifest`,
    reachabilityMethod: 'HEAD',
    reachabilityTest: (response) => Promise.resolve(response.status > 0 && response.status < 500),
  });
}

export function isOnlineState(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

/** Pergunta de novo se há conexão (usado depois de uma falha de rede). */
export async function recheckOnline(): Promise<boolean> {
  return isOnlineState(await NetInfo.refresh());
}
