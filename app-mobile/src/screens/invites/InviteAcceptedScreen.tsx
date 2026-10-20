import { router, Stack, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { strings, t } from '@/i18n';
import type { Role } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function InviteAcceptedScreen() {
  const { calendarId, name, role } = useLocalSearchParams<{
    calendarId: string;
    name?: string;
    role?: Role;
  }>();
  const { colors } = useAppTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('invites.acceptedTitle'), headerBackVisible: false }} />
      <Icon name="checkmark-circle" size={72} color={colors.success} />
      <AppText variant="title">{t('invites.acceptedTitle')}</AppText>
      <AppText>
        {t('invites.acceptedMessage', { calendar: name ?? '', role: role ? strings.roles[role] : '' })}
      </AppText>
      <Button
        title={t('invites.openCalendar')}
        onPress={() => router.replace({ pathname: '/calendar/[id]', params: { id: calendarId } })}
      />
      <Button title={t('tabs.calendar')} variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
