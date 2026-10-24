// Tradução de erros técnicos para mensagens amigáveis (regras 21 e 23).
// Nunca mostramos ao usuário detalhes internos (nomes de tabela, SQL, stack).
import { t, type TranslationKey } from '@/i18n';

export interface FriendlyError {
  code: string;
  message: string;
  /** Vale a pena tentar de novo automaticamente (ex.: falta de internet)? */
  retryable: boolean;
}

const CODE_MESSAGES: Record<string, TranslationKey> = {
  // Banco / funções do servidor
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  INVALID_DATA: 'errors.invalidData',
  INVALID_REFERENCE: 'errors.invalidData',
  DUPLICATE_ID: 'errors.duplicate',
  EVENT_TIME_CONFLICT: 'errors.eventTimeConflict',
  PRIVATE_EVENTS_DISABLED: 'errors.privateDisabled',
  CALENDAR_NOT_WRITABLE: 'errors.calendarNotWritable',
  OWNER_CANNOT_LEAVE: 'errors.ownerCannotLeave',
  CANNOT_CHANGE_OWN_ROLE: 'errors.cannotChangeOwnRole',
  INVALID_ROLE: 'errors.invalidRole',
  ALREADY_MEMBER: 'errors.alreadyMember',
  INVITE_NOT_FOUND: 'errors.inviteNotFound',
  INVITE_EXPIRED: 'errors.inviteExpired',
  INVITE_CANCELLED: 'errors.inviteCancelled',
  INVITE_ALREADY_USED: 'errors.inviteUsed',
  INVITE_EXHAUSTED: 'errors.inviteExhausted',
  INVITE_DECLINED: 'errors.inviteDeclined',
  INVITE_FOR_OTHER_EMAIL: 'errors.inviteOtherEmail',
  INVITE_CALENDAR_UNAVAILABLE: 'errors.inviteCalendarUnavailable',
  EMAIL_NOT_CONFIRMED: 'errors.emailNotConfirmedInvite',
  OWNS_SHARED_CALENDARS: 'errors.ownsShared',
  CONFIRMATION_REQUIRED: 'errors.confirmationRequired',
  TOO_MANY_REMINDERS: 'errors.tooManyReminders',
  INVALID_TIMEZONE: 'errors.invalidTimezone',
  END_BEFORE_START: 'errors.endBeforeStart',
  INVALID_RECURRENCE: 'errors.invalidRecurrence',
  RATE_LIMITED: 'errors.rateLimited',
  CONFLICT: 'errors.conflict',
  NOT_AUTHENTICATED: 'errors.sessionExpired',
  // Supabase Auth
  invalid_credentials: 'errors.invalidCredentials',
  email_not_confirmed: 'errors.emailNotConfirmed',
  user_already_exists: 'errors.userExists',
  email_exists: 'errors.userExists',
  weak_password: 'errors.weakPassword',
  over_request_rate_limit: 'errors.rateLimited',
  over_email_send_rate_limit: 'errors.emailRateLimited',
  otp_expired: 'errors.invalidCode',
  otp_disabled: 'errors.invalidCode',
  session_not_found: 'errors.sessionExpired',
  refresh_token_not_found: 'errors.sessionExpired',
  signup_disabled: 'errors.signupDisabled',
  LIST_MISMATCH: 'errors.listMismatch',
  INVALID_ASSIGNEE: 'errors.invalidAssignee',
  INVALID_PARTICIPANT: 'errors.invalidParticipant',
  TOO_MANY_PARTICIPANTS: 'errors.invalidParticipant',
  INVALID_LINK: 'errors.invalidLink',
  INVALID_TAG: 'errors.invalidTag',
  TASK_NOT_FOUND: 'errors.taskNotFound',
  POLL_CLOSED: 'errors.pollClosed',
  INVALID_OPTIONS: 'errors.invalidOptions',
  INVALID_OPTION: 'errors.invalidOptions',
  INVALID_RANGE: 'errors.invalidRange',
  TOO_MANY_ITEMS: 'errors.tooManyItems',
  NETWORK: 'errors.network',
  TIMEOUT: 'errors.timeout',
};

const RETRYABLE = new Set(['NETWORK', 'TIMEOUT', 'UNKNOWN']);

/** Descobre o código de um erro vindo do Supabase, da rede ou do próprio app. */
export function errorCode(error: unknown): string {
  if (!error) return 'UNKNOWN';
  if (typeof error === 'string') return CODE_MESSAGES[error] ? error : 'UNKNOWN';
  const e = error as { code?: unknown; message?: unknown; name?: unknown; status?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';

  if (/network request failed|failed to fetch|network error|fetch failed|load failed/i.test(message))
    return 'NETWORK';
  if (/timeout|timed out|aborted/i.test(message) || e.name === 'AbortError') return 'TIMEOUT';
  if (code && CODE_MESSAGES[code]) return code;
  // As funções do banco lançam o código na mensagem (ex.: "INVITE_EXPIRED").
  const fromMessage = /^[A-Z][A-Z_]+$/.test(message.trim()) ? message.trim() : '';
  if (fromMessage && CODE_MESSAGES[fromMessage]) return fromMessage;
  if (/invalid login credentials/i.test(message)) return 'invalid_credentials';
  if (/email not confirmed/i.test(message)) return 'email_not_confirmed';
  if (/already registered/i.test(message)) return 'user_already_exists';
  if (/token has expired|otp.*(expired|invalid)|invalid.*otp/i.test(message)) return 'otp_expired';
  if (/rate limit/i.test(message)) return 'over_request_rate_limit';
  if (code === '42501' || /row-level security|permission denied/i.test(message)) return 'FORBIDDEN';
  if (code === '23514' || code === '22P02' || code === '22007' || code === '22008') return 'INVALID_DATA';
  if (code === 'PGRST301' || e.status === 401) return 'NOT_AUTHENTICATED';
  return 'UNKNOWN';
}

export function toFriendlyError(error: unknown): FriendlyError {
  const code = errorCode(error);
  const key = CODE_MESSAGES[code];
  return {
    code,
    message: key ? t(key) : t('errors.generic'),
    retryable: RETRYABLE.has(code),
  };
}

export function isNetworkError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'NETWORK' || code === 'TIMEOUT';
}

/** Remove dados sensíveis antes de registrar em log (e-mails, tokens, senhas). */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/(password|senha|token|apikey|authorization)("?\s*[:=]\s*"?)[^\s",}]+/gi, '$1$2[oculto]');
}
