import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { ListItem } from '@/components/ListItem';
import { Screen } from '@/components/Screen';
import { env } from '@/config/env';
import { t } from '@/i18n';
import { endSession } from '@/services/session';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const account = useAuthStore((s) => s.account);
  const email = useAuthStore((s) => s.session?.user.email ?? '');
  const pending = useSyncStore((s) => s.outbox.length);
  const { confirm } = useFeedback();

  const logout = async () => {
    const ok = await confirm({
      title: t('auth.logoutConfirmTitle'),
      message: pending ? t('auth.logoutPendingMessage', { n: pending }) : t('auth.logoutConfirmMessage'),
      confirmLabel: pending ? t('auth.logoutAnyway') : t('auth.logout'),
      destructive: true,
    });
    if (ok) await endSession();
  };

  const name = account?.display_name ?? email;
  return (
    <Screen>
      <Card>
        <View style={styles.row}>
          <Avatar name={name} color={account?.avatar_color ?? '#4F7DF3'} size={64} />
          <View style={styles.flex}>
            <AppText variant="title">{name}</AppText>
            <AppText tone="muted">{email}</AppText>
            {account && (
              <Badge
                label={account.email_confirmed ? t('profile.emailConfirmed') : t('profile.emailNotConfirmed')}
                tone={account.email_confirmed ? 'success' : 'warning'}
                icon={account.email_confirmed ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              />
            )}
          </View>
        </View>
      </Card>
      <Card padded={false}>
        <ListItem
          icon="person-outline"
          title={t('profile.edit')}
          onPress={() => router.push('/settings/edit-profile')}
        />
        <ListItem
          icon="options-outline"
          title={t('profile.preferences')}
          onPress={() => router.push('/settings/preferences')}
        />
        <ListItem
          icon="notifications-outline"
          title={t('profile.notifications')}
          onPress={() => router.push('/settings/notifications')}
        />
        <ListItem
          icon="phone-portrait-outline"
          title={t('profile.devices')}
          onPress={() => router.push('/settings/devices')}
        />
        <ListItem
          icon="lock-closed-outline"
          title={t('profile.password')}
          onPress={() => router.push('/settings/password')}
        />
        <ListItem
          icon="shield-checkmark-outline"
          title={t('profile.privacy')}
          onPress={() => router.push('/settings/privacy-data')}
        />
      </Card>
      <Card padded={false}>
        <ListItem
          icon="sync-outline"
          title={t('profile.sync')}
          subtitle={pending ? t('sync.pending', { n: pending }) : undefined}
          onPress={() => router.push('/sync')}
        />
        <ListItem icon="help-circle-outline" title={t('profile.help')} onPress={() => router.push('/help')} />
        <ListItem
          icon="document-text-outline"
          title={t('profile.privacyPolicy')}
          onPress={() => router.push('/privacy')}
        />
        <ListItem
          icon="bug-outline"
          title={t('profile.diagnostics')}
          onPress={() => router.push('/diagnostics')}
        />
      </Card>
      <Card padded={false}>
        <ListItem icon="log-out-outline" title={t('auth.logout')} danger onPress={logout} chevron={false} />
      </Card>
      <AppText variant="small" tone="muted" center>
        {t('common.appName')} · {t('profile.about', { version: env.appVersion })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: spacing.xs },
});
