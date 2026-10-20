import { Stack } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useRemoteData } from '@/hooks/useRemoteData';
import { t } from '@/i18n';
import * as api from '@/services/api';
import { endSession } from '@/services/session';

/** Exclusão de conta com explicação do impacto e confirmação forte (regra 19). */
export default function DeleteAccountScreen() {
  const { toast } = useFeedback();
  const { run, busy } = useAction();
  const [word, setWord] = useState('');
  const impact = useRemoteData(() => api.accountDeletionImpact(), []);

  const remove = async () => {
    const result = await run(() => api.deleteMyAccount(word.trim()));
    if (result.ok) {
      toast(t('account.deleted'));
      await endSession();
    }
  };

  if (impact.loading) return <LoadingState />;
  if (impact.error || !impact.data)
    return <ErrorState message={impact.error?.message ?? t('errors.generic')} onRetry={impact.reload} />;
  const data = impact.data;
  const blocked = data.blocking_calendars.length > 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('account.deleteTitle') }} />
      <AppText>{t('account.deleteIntro')}</AppText>
      {blocked && (
        <Card>
          <AppText tone="danger">{t('account.deleteBlocking')}</AppText>
          {data.blocking_calendars.map((c) => (
            <AppText key={c.id}>
              • {c.name} ({t('calendars.members', { n: c.member_count })})
            </AppText>
          ))}
        </Card>
      )}
      <Card>
        <AppText>• {t('account.deleteCalendars', { n: data.calendars_to_delete })}</AppText>
        <AppText>• {t('account.deleteEventsKept', { n: data.events_kept_in_shared_calendars })}</AppText>
        <AppText>• {t('account.deleteComments', { n: data.comments_to_delete })}</AppText>
      </Card>
      <TextField
        label={t('account.deleteTypeToConfirm')}
        value={word}
        onChangeText={setWord}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!blocked}
      />
      <Button
        title={t('account.deleteAction')}
        icon="trash-outline"
        variant="danger"
        disabled={blocked || word.trim() !== 'EXCLUIR'}
        loading={busy}
        onPress={remove}
      />
    </Screen>
  );
}
