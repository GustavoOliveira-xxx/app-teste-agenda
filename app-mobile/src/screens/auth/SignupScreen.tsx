import { router } from 'expo-router';
import { useState } from 'react';

import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AuthTopBar, InlineLink, OrDivider } from '@/components/brand/AuthParts';
import { GoogleButton } from '@/components/brand/GoogleButton';
import { Button } from '@/components/Button';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { signUp } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { spacing } from '@/theme/tokens';
import { toFriendlyError } from '@/utils/errors';
import { hasErrors, validateSignup } from '@/validation/auth';

export default function SignupScreen() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const v = validateSignup(form);
    setErrors(v);
    setMessage(null);
    if (hasErrors(v)) return;
    setLoading(true);
    try {
      const result = await signUp(form.name, form.email, form.password);
      if (result === 'needs_confirmation') {
        useAuthStore.getState().setPendingEmail(form.email.trim().toLowerCase());
        router.push('/verify-email');
      }
      // Se entrou direto, a navegação muda sozinha para a área logada.
    } catch (error) {
      setMessage(toFriendlyError(error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen showOfflineBanner={false} safeTop maxWidth={480}>
      <AuthTopBar />
      <EnterItem index={0} style={{ gap: spacing.xs }}>
        <AppText variant="display">{t('auth.signupTitle')}</AppText>
        <AppText tone="muted">{t('auth.signupSubtitle')}</AppText>
      </EnterItem>
      <GoogleButton title={t('auth.googleSignup')} onError={setMessage} />
      <OrDivider />
      <TextField
        label={t('auth.name')}
        icon="person-outline"
        placeholder={t('auth.namePlaceholder')}
        value={form.name}
        onChangeText={set('name')}
        error={errors.name}
        autoComplete="name"
        maxLength={80}
        testID="signup-name"
      />
      <TextField
        label={t('auth.email')}
        icon="mail-outline"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        testID="signup-email"
      />
      <TextField
        label={t('auth.password')}
        icon="lock-closed-outline"
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        hint={t('auth.passwordHint')}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        testID="signup-password"
      />
      <TextField
        label={t('auth.passwordConfirm')}
        icon="lock-closed-outline"
        value={form.confirm}
        onChangeText={set('confirm')}
        error={errors.confirm}
        secure
        autoComplete="new-password"
        testID="signup-confirm"
      />
      {message ? (
        <AppText tone="danger" accessibilityLiveRegion="assertive">
          {message}
        </AppText>
      ) : null}
      <View>
        <AppText variant="small" tone="muted">
          {t('auth.termsNotice')}
        </AppText>
        <InlineLink label={t('auth.readPrivacy')} align="right" onPress={() => router.push('/privacy')} />
      </View>
      <Button title={t('auth.signup')} onPress={submit} loading={loading} testID="signup-submit" />
      <InlineLink
        lead={t('auth.alreadyHave')}
        label={t('auth.login')}
        onPress={() => router.replace('/login')}
      />
    </Screen>
  );
}
