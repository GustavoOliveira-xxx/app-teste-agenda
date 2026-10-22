import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { MistRibbons } from '@/components/brand/Decor';
import { GoogleButton } from '@/components/brand/GoogleButton';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/Button';
import { EnterItem } from '@/components/motion';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { marca } from '@/theme/marca';
import { SCREEN_MARGIN, spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [message, setMessage] = useState<string | null>(null);
  const logo = Math.min(width * 0.6, 340) * (width < 360 ? 0.85 : 1);
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <MistRibbons width={width} height={height * 0.42} style={styles.mist} />
      <View style={styles.hero}>
        <EnterItem index={0}>
          <Logo kind="vertical" width={logo} />
        </EnterItem>
        <EnterItem index={1}>
          <AppText variant="title" center style={styles.tagline}>
            {t('auth.welcomeSubtitle')}
          </AppText>
        </EnterItem>
      </View>
      <EnterItem index={2} style={styles.actions}>
        <Button
          title={t('auth.createAccount')}
          onPress={() => router.push('/signup')}
          testID="welcome-signup"
        />
        <GoogleButton onError={setMessage} />
        {message ? (
          <AppText tone="danger" center accessibilityLiveRegion="assertive">
            {message}
          </AppText>
        ) : null}
        <Button
          title={t('auth.haveAccount')}
          variant="ghost"
          onPress={() => router.push('/login')}
          testID="welcome-login"
        />
        <View style={styles.footer}>
          <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
          <AppText variant="caption" tone="bronze">
            {marca.assinatura}
          </AppText>
        </View>
      </EnterItem>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.lg },
  mist: { position: 'absolute', bottom: 0, left: 0 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xxl },
  tagline: { maxWidth: 320 },
  actions: { gap: spacing.md, width: '100%', maxWidth: 440, alignSelf: 'center' },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  rule: { width: 40, height: 1 },
});
