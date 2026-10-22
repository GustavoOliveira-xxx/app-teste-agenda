// Fluxos de autenticação (Supabase Auth). Senhas nunca são guardadas pelo app.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';

import { supabase } from './supabase';

export type SignUpResult = 'signed_in' | 'needs_confirmation';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function check(result: { error: unknown }): void {
  if (result.error) throw result.error;
}

export async function signUp(name: string, email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { display_name: name.trim(), timezone: getDeviceTimezone() } },
  });
  if (error) throw error;
  return data.session ? 'signed_in' : 'needs_confirmation';
}

export async function verifySignupCode(email: string, code: string): Promise<void> {
  check(await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code.trim(), type: 'email' }));
}

export async function resendSignupCode(email: string): Promise<void> {
  check(await supabase.auth.resend({ type: 'signup', email: normalizeEmail(email) }));
}

export async function signIn(email: string, password: string): Promise<void> {
  check(await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password }));
}

/** Envia o código de recuperação. Por segurança, não revela se o e-mail existe. */
export async function requestPasswordReset(email: string): Promise<void> {
  check(await supabase.auth.resetPasswordForEmail(normalizeEmail(email)));
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  check(
    await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code.trim(), type: 'recovery' }),
  );
  check(await supabase.auth.updateUser({ password: newPassword }));
}

/** Confere a senha atual (entrando de novo) antes de trocar. */
export async function changePassword(email: string, current: string, next: string): Promise<void> {
  check(await supabase.auth.signInWithPassword({ email, password: current }));
  check(await supabase.auth.updateUser({ password: next }));
}

export async function signOutOtherDevices(): Promise<void> {
  check(await supabase.auth.signOut({ scope: 'others' }));
}

export async function signOutThisDevice(): Promise<void> {
  // "local": encerra só a sessão deste aparelho. Ignora erro de rede: os
  // tokens locais são apagados de qualquer forma.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Entrar com Google (OAuth com PKCE). Funciona para quem já tem conta e para
// quem está chegando: a conta é criada no primeiro acesso, com o nome do Google.
// ---------------------------------------------------------------------------

export type GoogleResult = 'signed_in' | 'cancelled' | 'redirecting';

/** O servidor tem o Google ativado? (Authentication > Providers > Google no Supabase.) */
export async function isGoogleEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return !!settings.external?.google;
  } catch {
    return false;
  }
}

/** Endereço para onde o Google devolve a pessoa depois de escolher a conta. */
export function googleRedirectUrl(): string {
  if (Platform.OS === 'web') {
    const { origin, pathname } = window.location;
    // Raiz do site (no GitHub Pages fica numa subpasta, ex.: /app-teste-agenda/).
    const script = document.querySelector('script[src*="/_expo/static/js/"]')?.getAttribute('src');
    const base = script ? script.split('_expo/static/js/')[0] : pathname.replace(/[^/]*$/, '');
    return `${origin}${base.startsWith('/') ? base : `/${base}`}`;
  }
  return Linking.createURL('auth/callback');
}

/** Lê o código devolvido pelo Google num endereço e troca pela sessão. */
export async function completeOAuthFromUrl(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  const error = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
  if (error) throw new Error(error);
  if (!code) return false;
  check(await supabase.auth.exchangeCodeForSession(code));
  return true;
}

export async function signInWithGoogle(): Promise<GoogleResult> {
  const redirectTo = googleRedirectUrl();
  if (Platform.OS === 'web') {
    // No navegador a página vai até o Google e volta para o app com ?code=...
    check(await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }));
    return 'redirecting';
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';
  return (await completeOAuthFromUrl(result.url)) ? 'signed_in' : 'cancelled';
}
