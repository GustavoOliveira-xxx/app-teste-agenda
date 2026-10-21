import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { marca } from '@/theme/marca';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText
        variant="label"
        tone="muted"
        accessibilityRole="header"
        style={marca.titulosDeSecaoEmMaiusculas ? styles.upper : undefined}
      >
        {marca.titulosDeSecaoEmMaiusculas ? title.toUpperCase() : title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  upper: { letterSpacing: 0.6, fontSize: 13 },
});
