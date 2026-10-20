// Validações de cadastro e login. O servidor valida de novo (regra: nunca
// confiar só no app), mas validar aqui dá retorno imediato à pessoa.
import { t } from '@/i18n';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return t('validation.required');
  if (value.length > 254 || !EMAIL_RE.test(value)) return t('validation.invalidEmail');
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return t('validation.required');
  if (password.length < 8) return t('validation.passwordShort');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return t('validation.passwordWeak');
  if (password.length > 72) return t('validation.tooLong', { max: 72 });
  return undefined;
}

export function validateDisplayName(name: string): string | undefined {
  const value = name.trim();
  if (!value) return t('validation.required');
  if (value.length > 80) return t('validation.tooLong', { max: 80 });
  return undefined;
}

export function validateOtp(code: string): string | undefined {
  return /^\d{6}$/.test(code.trim()) ? undefined : t('validation.invalidCode');
}

export function validateSignup(form: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): FieldErrors<'name' | 'email' | 'password' | 'confirm'> {
  const errors: FieldErrors<'name' | 'email' | 'password' | 'confirm'> = {
    name: validateDisplayName(form.name),
    email: validateEmail(form.email),
    password: validatePassword(form.password),
    confirm: form.confirm !== form.password ? t('validation.passwordMismatch') : undefined,
  };
  return clean(errors);
}

export function validateLogin(form: { email: string; password: string }): FieldErrors<'email' | 'password'> {
  return clean({
    email: validateEmail(form.email),
    password: form.password ? undefined : t('validation.required'),
  });
}

export function clean<T extends Record<string, string | undefined>>(errors: T): T {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as T;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
