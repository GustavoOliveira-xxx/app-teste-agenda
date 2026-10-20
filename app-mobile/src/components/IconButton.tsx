import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

/** Botão só com ícone. O rótulo é obrigatório para leitores de tela. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [styles.base, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} color={color ?? colors.text} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
