import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

/** Linha de lista tocável (menus, configurações, membros...). */
export function ListItem({
  title,
  subtitle,
  icon,
  iconColor,
  left,
  right,
  onPress,
  danger,
  chevron = !!onPress,
  disabled,
  accessibilityHint,
  testID,
}: ListItemProps) {
  const { colors } = useAppTheme();
  const textColor = danger ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceAlt : 'transparent', opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {left}
      {icon && <Icon name={icon} color={iconColor ?? (danger ? colors.danger : colors.textMuted)} />}
      <View style={styles.texts}>
        <AppText style={{ color: textColor }}>{title}</AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron && <Icon name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  texts: { flex: 1, gap: 2 },
});
