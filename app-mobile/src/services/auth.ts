// Fluxos de autenticação (Supabase Auth). Senhas nunca são guardadas pelo app.
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
