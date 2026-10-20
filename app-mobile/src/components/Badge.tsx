import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Tone = 'neutral' | 'primary' | 'danger' | 'success' | 'warning';

/** Etiqueta com texto (e ícone opcional): a informação nunca depende só da cor. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors } = useAppTheme();
  const map = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    primary: [colors.primarySoft, colors.primary],
    danger: [colors.dangerSoft, colors.danger],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <AppText variant="caption" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
