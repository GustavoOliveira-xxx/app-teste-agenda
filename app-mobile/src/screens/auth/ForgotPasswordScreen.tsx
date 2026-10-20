import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { requestPasswordReset, resetPasswordWithCode } from '@/services/auth';
import { toFriendlyError } from '@/utils/errors';
import { validateEmail, validateOtp, validatePassword } from '@/validation/auth';

/** Recuperação de senha em 2 passos: e-mail -> código + nova senha. */
export default function ForgotPasswordScreen() {
  const { toast } = useFeedback();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const e = validateEmail(email);
    setErrors({ email: e });
    if (e) return;
    setLoading(true);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setStep('code');
    } catch (err) {
      setMessage(toFriendlyError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const v = { code: validateOtp(code), password: validatePassword(password) };
    setErrors(v);
    if (v.code || v.password) return;
    setLoading(true);
    setMessage(null);
    try {
      await resetPasswordWithCode(email, code, password);
      toast(t('auth.resetDone'));
    } catch (err) {
      setMessage(toFriendlyError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen showOfflineBanner={false}>
      {step === 'email' ? (
        <>
          <AppText>{t('auth.forgotMessage')}</AppText>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {message ? <AppText tone="danger">{message}</AppText> : null}
          <Button title={t('auth.sendCode')} onPress={send} loading={loading} />
        </>
      ) : (
        <>
          <AppText variant="heading">{t('auth.resetTitle')}</AppText>
          <AppText>{t('auth.resetMessage', { email })}</AppText>
          <TextField
            label={t('auth.code')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            error={errors.code}
          />
          <TextField
            label={t('auth.newPassword')}
            value={password}
            onChangeText={setPassword}
            secure
            hint={t('auth.passwordHint')}
            error={errors.password}
            autoComplete="new-password"
          />
          {message ? <AppText tone="danger">{message}</AppText> : null}
          <Button title={t('common.save')} onPress={reset} loading={loading} />
          <Button title={t('auth.resend')} variant="ghost" onPress={send} />
        </>
      )}
    </Screen>
  );
}
