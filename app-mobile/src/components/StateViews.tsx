import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function LoadingState({ message }: { message?: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={styles.center}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? t('common.loading')}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText tone="muted">{message ?? t('common.loading')}</AppText>
    </View>
  );
}

export function EmptyState({
  icon = 'calendar-clear-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <Icon name={icon} size={48} color={colors.textMuted} />
      <AppText variant="heading" center>
        {title}
      </AppText>
      {message ? (
        <AppText tone="muted" center>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} compact /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Icon name="alert-circle-outline" size={48} color={colors.danger} />
      <AppText variant="heading" center>
        {t('errors.genericTitle')}
      </AppText>
      <AppText tone="muted" center>
        {message}
      </AppText>
      {onRetry ? <Button title={t('common.retry')} onPress={onRetry} icon="refresh" compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
    minHeight: 240,
  },
});
