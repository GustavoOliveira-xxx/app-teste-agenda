import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AuthTopBar, InlineLink, OrDivider } from '@/components/brand/AuthParts';
import { GoogleButton } from '@/components/brand/GoogleButton';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/Button';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { resendSignupCode, signIn } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { spacing } from '@/theme/tokens';
import { errorCode, toFriendlyError } from '@/utils/errors';
import { hasErrors, validateLogin } from '@/validation/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // Aviso deixado pela volta do Google no navegador (se a entrada falhou).
  const [message, setMessage] = useState<string | null>(() => useAuthStore.getState().notice);
  const { width } = useWindowDimensions();
  useEffect(() => useAuthStore.getState().setNotice(null), []);
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
    <Screen showOfflineBanner={false} safeTop maxWidth={480}>
      <AuthTopBar />
      <EnterItem index={0} style={{ gap: spacing.md }}>
        <Logo kind="horizontal" width={Math.min(width * 0.6, 260) - (width < 360 ? 30 : 0)} />
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <AppText variant="display">{t('auth.loginTitle')}</AppText>
          <AppText tone="muted">{t('auth.loginSubtitle')}</AppText>
        </View>
      </EnterItem>
      <TextField
        label={t('auth.email')}
        icon="mail-outline"
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
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        testID="login-password"
      />
      <InlineLink label={t('auth.forgot')} align="right" onPress={() => router.push('/forgot-password')} />
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
      <OrDivider />
      <GoogleButton onError={setMessage} />
      <InlineLink
        lead={t('auth.newHere')}
        label={t('auth.createAccount')}
        onPress={() => router.replace('/signup')}
      />
    </Screen>
  );
}
