import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { elevation, motion } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { PressableScale, tapFeedback } from './motion';

/** Botão flutuante 58 dp, raio 20. O "+" gira 45° ao tocar e a tela nova sobe. */
export function FAB({
  icon = 'add',
  label,
  onPress,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const turn = useSharedValue(0);
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    enter.value = withSpring(1, motion.mola);
  }, [enter]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 45}deg` }] }));
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + 0.4 * enter.value }],
    opacity: enter.value,
  }));
  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <PressableScale
        onPress={() => {
          tapFeedback();
          if (!reduceMotion) {
            turn.value = withSpring(1, motion.mola);
            setTimeout(() => (turn.value = withTiming(0, { duration: 240 })), 420);
          }
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.fab, elevation(3, colors), { backgroundColor: colors.primary }]}
      >
        <Animated.View style={iconStyle}>
          <Icon name={icon} size={28} color={colors.primaryText} strokeWidth={2.2} />
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, bottom: 20 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
