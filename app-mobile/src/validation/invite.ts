// Códigos de convite: 12 símbolos do alfabeto Crockford (sem I, L, O, U).
// A normalização é a mesma do servidor (private.invite_code_hash).
import { t } from '@/i18n';

export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function formatInviteCode(input: string): string {
  const n = normalizeInviteCode(input).slice(0, 12);
  return n.match(/.{1,4}/g)?.join('-') ?? '';
}

export function validateInviteCode(input: string): string | undefined {
  return /^[0-9A-HJKMNP-TV-Z]{12}$/.test(normalizeInviteCode(input))
    ? undefined
    : t('validation.invalidInviteCode');
}
