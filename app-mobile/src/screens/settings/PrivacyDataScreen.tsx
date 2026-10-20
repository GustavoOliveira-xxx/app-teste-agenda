import { router, Stack } from 'expo-router';
import { Share } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import * as api from '@/services/api';

/** LGPD: exportar os próprios dados e excluir a conta. */
export default function PrivacyDataScreen() {
  const { run, busy } = useAction();

  const exportData = async () => {
    const result = await run(() => api.exportMyData(), { success: t('account.exportDone') });
    if (result.ok) {
      await Share.share({ title: 'meus-dados-agenda.json', message: JSON.stringify(result.value, null, 2) });
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('account.privacyTitle') }} />
      <Card>
        <AppText variant="heading">{t('account.exportTitle')}</AppText>
        <AppText tone="muted">{t('account.exportMessage')}</AppText>
        <Button
          title={t('account.exportAction')}
          icon="download-outline"
          variant="secondary"
          onPress={exportData}
          loading={busy}
        />
      </Card>
      <Card>
        <AppText variant="heading">{t('account.deleteTitle')}</AppText>
        <Button
          title={t('account.deleteTitle')}
          icon="trash-outline"
          variant="danger"
          onPress={() => router.push('/settings/delete-account')}
        />
      </Card>
      <Button title={t('profile.privacyPolicy')} variant="ghost" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}
