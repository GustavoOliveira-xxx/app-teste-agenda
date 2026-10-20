import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';

/** Mostrada quando o APK foi gerado sem o endereço do servidor (Supabase). */
export default function NotConfiguredScreen() {
  const { colors } = useAppTheme();
  return (
    <Screen showOfflineBanner={false}>
      <Icon name="construct-outline" size={56} color={colors.warning} />
      <AppText variant="title">{t('notConfigured.title')}</AppText>
      <AppText>{t('notConfigured.message')}</AppText>
      <AppText tone="muted">{t('notConfigured.docs')}</AppText>
    </Screen>
  );
}
