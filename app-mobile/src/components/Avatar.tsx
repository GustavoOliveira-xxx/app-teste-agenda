import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, pastel } from '@/theme/tokens';
import { initials } from '@/utils/text';

import { AppText } from './AppText';

/** Avatar com iniciais em `ink` sobre um tom pastel da cor da pessoa. */
export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const { colors } = useAppTheme();
  const base = agendaColor(color, false) ?? colors.primary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pastel(base) },
      ]}
    >
      <AppText
        maxFontSizeMultiplier={1.2}
        style={{ color: colors.onCoral, fontSize: size * 0.36, lineHeight: size * 0.46, ...fonte('negrito') }}
      >
        {initials(name)}
      </AppText>
    </View>
  );
}

/** Pilha de avatares sobrepostos com "+N" no fim. */
export function AvatarStack({
  people,
  max = 2,
  size = 28,
}: {
  people: { name: string; color: string }[];
  max?: number;
  size?: number;
}) {
  const { colors } = useAppTheme();
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const ring = { borderWidth: 2, borderColor: colors.surface, borderRadius: size / 2 + 2 };
  return (
    <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map((p, i) => (
        <View key={`${p.name}-${i}`} style={[ring, i > 0 && { marginLeft: -size * 0.32 }]}>
          <Avatar name={p.name} color={p.color} size={size} />
        </View>
      ))}
      {rest > 0 && (
        <View
          style={[
            ring,
            styles.more,
            {
              marginLeft: -size * 0.32,
              width: size + 4,
              height: size + 4,
              backgroundColor: colors.surfaceAlt,
            },
          ]}
        >
          <AppText style={{ fontSize: size * 0.38, color: colors.text, ...fonte('negrito') }}>
            +{rest}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
  more: { alignItems: 'center', justifyContent: 'center' },
});
