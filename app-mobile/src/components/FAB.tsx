import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { shadow } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

/** Botão flutuante (ex.: "+" para novo evento), ao alcance do polegar. */
export function FAB({
  icon = 'add',
  label,
  onPress,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        shadow,
        { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Icon name={icon} size={30} color={colors.primaryText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
