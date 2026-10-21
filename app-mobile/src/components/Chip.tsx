import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

/** Opção selecionável (filtros, dias da semana...). Mostra um ✓ quando marcada. */
export function Chip({
  label,
  selected,
  onPress,
  color,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      hitSlop={4}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      {selected && <Icon name="checkmark" size={16} color={colors.primary} />}
      <AppText variant="small" style={{ color: selected ? colors.primary : colors.text, ...fonte('medio') }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
