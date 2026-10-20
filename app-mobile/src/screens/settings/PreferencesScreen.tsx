import { Stack } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { SwitchRow } from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { savePreferences } from '@/services/account';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { t } from '@/i18n';
import type { DateFormat, ThemePreference, TimeFormat, UserPreferences } from '@/models/types';
import { useAuthStore } from '@/stores/authStore';
import { formatDateKey } from '@/utils/dates';
import { timezoneOptions } from '@/utils/timezones';

export default function PreferencesScreen() {
  const prefs = useAuthStore((s) => s.account?.preferences);
  const { run } = useAction();
  const deviceTz = getDeviceTimezone();
  if (!prefs) return null;

  const save = (changes: Partial<UserPreferences>) =>
    run(() => savePreferences(changes), { success: t('common.saved') });

  return (
    <Screen>
      <Stack.Screen options={{ title: t('preferences.title') }} />
      <Card>
        <SelectField<ThemePreference>
          label={t('preferences.theme')}
          value={prefs.theme}
          onChange={(theme) => save({ theme })}
          options={[
            { value: 'system', label: t('preferences.themeSystem') },
            { value: 'light', label: t('preferences.themeLight') },
            { value: 'dark', label: t('preferences.themeDark') },
          ]}
        />
        <SelectField<'pt-BR'>
          label={t('preferences.language')}
          value="pt-BR"
          onChange={() => undefined}
          options={[{ value: 'pt-BR', label: t('preferences.languageValue') }]}
        />
      </Card>
      <Card>
        <SwitchRow
          label={t('preferences.useDeviceTimezone')}
          hint={t('preferences.deviceTimezone', { tz: deviceTz })}
          value={prefs.use_device_timezone}
          onChange={(use_device_timezone) =>
            save({ use_device_timezone, timezone: use_device_timezone ? deviceTz : prefs.timezone })
          }
        />
        {!prefs.use_device_timezone && (
          <SelectField<string>
            label={t('preferences.timezone')}
            value={prefs.timezone}
            onChange={(timezone) => save({ timezone })}
            options={timezoneOptions(deviceTz)}
            searchable
            searchPlaceholder={t('preferences.searchTimezone')}
          />
        )}
      </Card>
      <Card>
        <SelectField<DateFormat>
          label={t('preferences.dateFormat')}
          value={prefs.date_format}
          onChange={(date_format) => save({ date_format })}
          options={(['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'] as const).map((f) => ({
            value: f,
            label: formatDateKey('2026-12-25', f),
          }))}
        />
        <SelectField<TimeFormat>
          label={t('preferences.timeFormat')}
          value={prefs.time_format}
          onChange={(time_format) => save({ time_format })}
          options={[
            { value: '24h', label: t('preferences.time24') },
            { value: '12h', label: t('preferences.time12') },
          ]}
        />
        <SelectField<0 | 1>
          label={t('preferences.weekStart')}
          value={prefs.week_starts_on}
          onChange={(week_starts_on) => save({ week_starts_on })}
          options={[
            { value: 0, label: t('preferences.weekStartSunday') },
            { value: 1, label: t('preferences.weekStartMonday') },
          ]}
        />
      </Card>
      <AppText variant="small" tone="muted">
        {t('common.requiresInternet')}
      </AppText>
    </Screen>
  );
}
