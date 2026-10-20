import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.text}>
        {title.toUpperCase()}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  text: { letterSpacing: 0.6, fontSize: 13 },
});
