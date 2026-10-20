import { errorCode, isNetworkError, redact, toFriendlyError } from '../errors';

describe('mensagens de erro amigáveis', () => {
  it('traduz códigos do servidor sem revelar detalhes internos', () => {
    expect(toFriendlyError({ message: 'INVITE_EXPIRED', code: 'P0001' }).message).toBe(
      'Este convite expirou. Peça um novo para quem convidou.',
    );
    const rls = toFriendlyError({
      message: 'new row violates row-level security policy for table "events"',
      code: '42501',
    });
    expect(rls.code).toBe('FORBIDDEN');
    expect(rls.message).not.toMatch(/events|policy/);
  });

  it('reconhece falta de internet como erro temporário', () => {
    const e = new TypeError('Network request failed');
    expect(isNetworkError(e)).toBe(true);
    expect(toFriendlyError(e).retryable).toBe(true);
  });

  it('erros de login do Supabase', () => {
    expect(errorCode({ message: 'Invalid login credentials', status: 400 })).toBe('invalid_credentials');
    expect(errorCode({ code: 'email_not_confirmed', message: 'Email not confirmed' })).toBe(
      'email_not_confirmed',
    );
    expect(errorCode({ code: 'weak_password', message: 'x' })).toBe('weak_password');
    expect(errorCode({ message: 'Token has expired or is invalid' })).toBe('otp_expired');
  });

  it('erro desconhecido vira mensagem genérica', () => {
    expect(toFriendlyError(new Error('SELECT * FROM segredos falhou')).message).toBe(
      'Não foi possível concluir. Tente de novo em instantes.',
    );
  });

  it('remove e-mails, tokens e senhas antes de registrar em log', () => {
    expect(redact('login de ana@exemplo.test com password=123abc')).toBe(
      'login de [email] com password=[oculto]',
    );
    expect(redact('Bearer eyJhbGciOi.eyJzdWIiOi.abc-def')).toBe('Bearer [token]');
  });
});
