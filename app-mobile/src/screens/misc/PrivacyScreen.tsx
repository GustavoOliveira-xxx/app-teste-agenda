import { Stack } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { PRIVACY_POLICY, PRIVACY_POLICY_VERSION } from '@/content/privacyPolicy';
import { t } from '@/i18n';

export default function PrivacyScreen() {
  return (
    <Screen showOfflineBanner={false}>
      <Stack.Screen options={{ title: t('privacyPolicy.title') }} />
      <AppText variant="small" tone="muted">
        Versão {PRIVACY_POLICY_VERSION}
      </AppText>
      {PRIVACY_POLICY.map((section) => (
        <AppText key={section.title}>
          <AppText variant="label">{section.title}. </AppText>
          {section.body}
        </AppText>
      ))}
    </Screen>
  );
}
