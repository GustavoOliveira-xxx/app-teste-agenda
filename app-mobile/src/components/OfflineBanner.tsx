import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

/** Faixa no topo avisando que o app está sem internet (estado offline). */
export function OfflineBanner() {
  const { colors } = useAppTheme();
  const online = useSyncStore((s) => s.online);
  const pending = useSyncStore((s) => s.outbox.length);
  if (online) return null;
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warningSoft }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name="cloud-offline-outline" size={18} color={colors.warning} />
      <AppText variant="small" style={{ color: colors.warning, flex: 1 }}>
        {t('sync.offlineBanner')}
        {pending > 0 ? ` ${t('sync.pending', { n: pending })}.` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
