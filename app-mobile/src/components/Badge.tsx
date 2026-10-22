import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Tone = 'neutral' | 'primary' | 'strong' | 'danger' | 'success' | 'warning';

/** Etiqueta com texto (e ícone opcional): a informação nunca depende só da cor. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors } = useAppTheme();
  const map = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    primary: [colors.primarySoft, colors.primaryInk],
    strong: [colors.primary, colors.primaryText],
    danger: [colors.dangerSoft, colors.danger],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={13} color={fg} />}
      <AppText variant="caption" style={{ color: fg, ...fonte('negrito') }}>
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
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
