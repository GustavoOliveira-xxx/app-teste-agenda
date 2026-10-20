import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { logError } from '@/services/errorLog';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

/** Tela de erro inesperado: nunca mostra detalhes técnicos (stack trace) à pessoa. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useAppTheme();
  useEffect(() => {
    void logError('tela', error);
  }, [error]);
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Icon name="sad-outline" size={56} color={colors.textMuted} />
      <AppText variant="title" center>
        {t('errors.genericTitle')}
      </AppText>
      <AppText tone="muted" center>
        {t('errors.unexpectedScreen')}
      </AppText>
      <Button title={t('common.retry')} icon="refresh" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
});
