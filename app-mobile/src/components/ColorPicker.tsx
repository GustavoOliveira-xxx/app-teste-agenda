import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, CALENDAR_COLORS, readableTextOn } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale, tapFeedback } from './motion';

/** Escolha de cor. Cada cor tem nome (leitor de tela) e a escolhida ganha um ✓. */
export function ColorPicker({
  label,
  value,
  onChange,
  allowNone,
  noneLabel,
}: {
  label: string;
  value: string | null;
  onChange: (color: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { colors, dark } = useAppTheme();
  // Cores antigas (versões 1.x) aparecem marcadas na cor nova equivalente.
  const current = agendaColor(value, false)?.toLowerCase() ?? null;
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {allowNone && (
          <PressableScale
            onPress={() => onChange(null)}
            accessibilityRole="radio"
            accessibilityLabel={noneLabel}
            accessibilityState={{ checked: value === null }}
            style={[
              styles.swatch,
              styles.none,
              { borderColor: value === null ? colors.focus : colors.border },
            ]}
          >
            <Icon name="ban-outline" size={20} color={colors.textMuted} />
          </PressableScale>
        )}
        {CALENDAR_COLORS.map((c) => {
          const selected = current === c.value.toLowerCase();
          const shown = agendaColor(c.value, dark) ?? c.value;
          return (
            <PressableScale
              key={c.value}
              onPress={() => {
                tapFeedback('select');
                onChange(c.value);
              }}
              accessibilityRole="radio"
              accessibilityLabel={c.name}
              accessibilityState={{ checked: selected }}
              style={[
                styles.swatch,
                { backgroundColor: shown, borderColor: selected ? colors.focus : 'transparent' },
              ]}
            >
              {selected && <Icon name="checkmark" size={22} color={readableTextOn(shown)} />}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  none: { borderWidth: 2 },
});
