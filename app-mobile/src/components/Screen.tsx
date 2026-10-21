import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

import { OfflineBanner } from './OfflineBanner';

interface ScreenProps {
  children: ReactNode;
  /** Rolar o conteúdo (padrão). Use false para telas com listas próprias. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  showOfflineBanner?: boolean;
  /** Largura máxima do conteúdo em telas grandes (tablet, computador). */
  maxWidth?: number;
}

/** Estrutura padrão de tela: fundo, margens, rolagem e aviso de sem internet. */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  padded = true,
  footer,
  showOfflineBanner = true,
  maxWidth = CONTENT_MAX_WIDTH,
}: ScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Em telas largas o conteúdo fica numa coluna centralizada, em vez de esticar.
  const column = [styles.column, { maxWidth }];
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        column,
        padded && styles.padded,
        { paddingBottom: spacing.huge + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, column, padded && styles.padded]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showOfflineBanner && <OfflineBanner />}
      {content}
      {footer && (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: spacing.md + insets.bottom,
            },
          ]}
        >
          <View style={[column, styles.footerContent]}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', alignSelf: 'center' },
  padded: { padding: spacing.lg, gap: spacing.lg },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  footerContent: { gap: spacing.sm },
});
