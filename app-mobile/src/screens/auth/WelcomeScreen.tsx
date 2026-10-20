import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <Image source={require('../../../assets/splash-icon.png')} style={styles.logo} accessible={false} />
        <AppText variant="display" center>
          {t('auth.welcomeTitle')}
        </AppText>
        <AppText tone="muted" center>
          {t('auth.welcomeSubtitle')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          title={t('auth.createAccount')}
          onPress={() => router.push('/signup')}
          testID="welcome-signup"
        />
        <Button
          title={t('auth.haveAccount')}
          variant="secondary"
          onPress={() => router.push('/login')}
          testID="welcome-login"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  logo: { width: 120, height: 120 },
  actions: { gap: spacing.md },
});
