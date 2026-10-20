import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/i18n';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const SLIDES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'people-outline', title: t('onboarding.slide1Title'), text: t('onboarding.slide1Text') },
  { icon: 'shield-checkmark-outline', title: t('onboarding.slide2Title'), text: t('onboarding.slide2Text') },
  { icon: 'cloud-offline-outline', title: t('onboarding.slide3Title'), text: t('onboarding.slide3Text') },
];

/** Apresentação em 3 passos, mostrada só na primeira vez. */
export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const [index, setIndex] = useState(0);
  const finish = () => {
    useUiStore.getState().setOnboardingDone();
    router.replace('/welcome');
  };
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.skip}>
        <Button title={t('onboarding.skip')} variant="ghost" onPress={finish} compact />
      </View>
      <View style={styles.body} accessibilityLiveRegion="polite">
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon name={slide.icon} size={64} color={colors.primary} />
        </View>
        <AppText variant="title" center>
          {slide.title}
        </AppText>
        <AppText tone="muted" center>
          {slide.text}
        </AppText>
        <View
          style={styles.dots}
          accessibilityLabel={t('onboarding.progress', { n: index + 1, total: SLIDES.length })}
        >
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }]}
            />
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Button
          title={last ? t('onboarding.start') : t('onboarding.next')}
          onPress={last ? finish : () => setIndex(index + 1)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: { alignItems: 'flex-end', padding: spacing.sm },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.lg },
  iconCircle: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  dot: { width: 10, height: 10, borderRadius: 5 },
  footer: { padding: spacing.xl },
});
