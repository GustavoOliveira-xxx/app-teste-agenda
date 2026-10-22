import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { elevation, radius, spacing } from '@/theme/tokens';

import { PressableScale } from './motion';

/** Cartão: raio 14, superfície e sombra curta. Tocável quando recebe `onPress`. */
export function Card({
  children,
  style,
  padded = true,
  onPress,
  accessibilityLabel,
  outlined,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Contorno 2dp em `primary` (ex.: evento acontecendo agora). */
  outlined?: boolean;
}) {
  const { colors, dark } = useAppTheme();
  const look = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: colors.surface },
    dark ? { borderColor: colors.border } : elevation(1, colors),
    outlined && { borderColor: colors.primary, borderWidth: 2 },
    style,
  ];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={look}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={look}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  padded: { padding: spacing.lg, gap: spacing.md },
});
