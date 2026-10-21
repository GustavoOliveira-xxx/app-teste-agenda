import { StyleSheet, View } from 'react-native';

import { fonte, readableTextOn } from '@/theme/tokens';
import { initials } from '@/utils/text';

import { AppText } from './AppText';

/** Avatar com iniciais (a V1 não pede acesso à galeria de fotos). */
export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
    >
      <AppText
        maxFontSizeMultiplier={1.2}
        style={{
          color: readableTextOn(color),
          fontSize: size * 0.4,
          ...fonte('semi'),
          lineHeight: size * 0.5,
        }}
      >
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ circle: { alignItems: 'center', justifyContent: 'center' } });
