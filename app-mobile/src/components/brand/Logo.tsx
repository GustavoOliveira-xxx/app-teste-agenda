// Logo oficial SynCK. Só aparece sobre fundo claro: no tema escuro vai dentro
// de uma placa clara com raio de 22 (regra do guia de marca).
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { CORES_DO_LOGO } from '@/theme/marca';
import { radius, spacing } from '@/theme/tokens';

const SOURCES = {
  vertical: { src: require('../../../assets/brand/logo-vertical.png'), ratio: 200 / 179 },
  horizontal: { src: require('../../../assets/brand/logo-horizontal.png'), ratio: 240 / 56 },
  personagem: { src: require('../../../assets/brand/personagem.png'), ratio: 160 / 112 },
} as const;

export function Logo({
  kind,
  width,
  style,
}: {
  kind: keyof typeof SOURCES;
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { dark } = useAppTheme();
  const { src, ratio } = SOURCES[kind];
  const image = (
    <Image
      source={src}
      style={{ width, height: width / ratio }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="SynCK"
    />
  );
  if (!dark || kind === 'personagem') return <View style={style}>{image}</View>;
  return <View style={[styles.plate, style]}>{image}</View>;
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: CORES_DO_LOGO.splash,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
