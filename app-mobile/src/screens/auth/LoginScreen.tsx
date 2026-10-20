import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { resendSignupCode, signIn } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { errorCode, toFriendlyError } from '@/utils/errors';
import { hasErrors, validateLogin } from '@/validation/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const failures = useRef(0);
  const [lockedFor, setLockedFor] = useState(0);

  // Após várias tentativas erradas, espera crescente (o servidor também limita).
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockedFor]);

  const submit = async () => {
    const v = validateLogin({ email, password });
    setErrors(v);
    setMessage(null);
    if (hasErrors(v) || lockedFor > 0) return;
    setLoading(true);
    try {
      await signIn(email, password);
      failures.current = 0;
    } catch (error) {
      const code = errorCode(error);
      if (code === 'email_not_confirmed') {
        useAuthStore.getState().setPendingEmail(email.trim().toLowerCase());
        await resendSignupCode(email).catch(() => undefined);
        router.push('/verify-email');
        return;
      }
      if (code === 'invalid_credentials') {
        failures.current += 1;
        if (failures.current >= 5) setLockedFor(Math.min(60, 5 * 2 ** (failures.current - 5)));
      }
      setMessage(toFriendlyError(error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen showOfflineBanner={false}>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        testID="login-email"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        testID="login-password"
      />
      {message ? (
        <AppText tone="danger" accessibilityLiveRegion="assertive">
          {message}
        </AppText>
      ) : null}
      {lockedFor > 0 ? <AppText tone="warning">{t('auth.tooManyAttempts', { s: lockedFor })}</AppText> : null}
      <Button
        title={t('auth.login')}
        onPress={submit}
        loading={loading}
        disabled={lockedFor > 0}
        testID="login-submit"
      />
      <Button title={t('auth.forgot')} variant="ghost" onPress={() => router.push('/forgot-password')} />
      <Button title={t('auth.noAccount')} variant="ghost" onPress={() => router.replace('/signup')} />
    </Screen>
  );
}
