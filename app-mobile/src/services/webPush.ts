// Notificações no navegador (iPhone com o SynCK na Tela de Início, e
// computador). O navegador gera uma inscrição; o servidor guarda e, a cada
// minuto, envia os lembretes e avisos (função enviar-push do Supabase).
import { Platform } from 'react-native';

import { supabase, unwrap } from './supabase';

export type WebPushState = 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on';

const supported = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  // O service worker é registrado pelo index.html; espera ficar pronto.
  const timeout = new Promise<null>((ok) => setTimeout(() => ok(null), 4000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Converte a chave pública (base64 de URL) no formato que o navegador pede. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enableWebPush(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  const publicKey = unwrap(await supabase.rpc('web_push_public_key')) as string | null;
  if (!publicKey) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await registration();
  if (!reg) return 'unsupported';
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    });
  }
  const json = sub.toJSON();
  unwrap(
    await supabase.rpc('register_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
      p_user_agent: navigator.userAgent.slice(0, 300),
    }),
  );
  return 'on';
}

export async function disableWebPush(): Promise<WebPushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc('unregister_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => false);
  }
  return 'off';
}

/** Ao sair da conta neste navegador, para de receber as notificações dela. */
export async function forgetWebPush(): Promise<void> {
  if (!supported()) return;
  await disableWebPush().catch(() => undefined);
}
