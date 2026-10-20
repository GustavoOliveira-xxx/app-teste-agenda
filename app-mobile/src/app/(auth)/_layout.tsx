import { Stack } from 'expo-router';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function AuthLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('auth.loginTitle') }} />
      <Stack.Screen name="signup" options={{ title: t('auth.signupTitle') }} />
      <Stack.Screen name="verify-email" options={{ title: t('auth.verifyTitle') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotTitle') }} />
      <Stack.Screen name="privacy" options={{ title: t('privacyPolicy.title') }} />
    </Stack>
  );
}
