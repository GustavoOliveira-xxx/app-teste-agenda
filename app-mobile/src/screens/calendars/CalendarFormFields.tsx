import { ColorPicker } from '@/components/ColorPicker';
import { SelectField } from '@/components/SelectField';
import { TextField } from '@/components/TextField';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { strings, t } from '@/i18n';
import type { CalendarKind } from '@/models/types';
import { timezoneOptions } from '@/utils/timezones';

export interface CalendarFormValues {
  name: string;
  description: string;
  color: string;
  kind: CalendarKind;
  default_timezone: string;
}

const KINDS = Object.keys(strings.calendarKinds) as CalendarKind[];

/** Campos básicos de uma agenda (usados em "Nova agenda" e "Configurações"). */
export function CalendarFormFields({
  values,
  onChange,
  errors,
  disabled,
}: {
  values: CalendarFormValues;
  onChange: (values: CalendarFormValues) => void;
  errors: Partial<Record<'name' | 'description' | 'color', string>>;
  disabled?: boolean;
}) {
  const set = <K extends keyof CalendarFormValues>(key: K, value: CalendarFormValues[K]) =>
    onChange({ ...values, [key]: value });
  return (
    <>
      <TextField
        label={t('calendars.name')}
        placeholder={t('calendars.namePlaceholder')}
        value={values.name}
        onChangeText={(v) => set('name', v)}
        error={errors.name}
        maxLength={80}
        editable={!disabled}
      />
      <TextField
        label={`${t('calendars.description')} (${t('common.optional')})`}
        value={values.description}
        onChangeText={(v) => set('description', v)}
        error={errors.description}
        multiline
        maxLength={500}
        editable={!disabled}
      />
      <ColorPicker label={t('calendars.color')} value={values.color} onChange={(v) => v && set('color', v)} />
      <SelectField<CalendarKind>
        label={t('calendars.kind')}
        value={values.kind}
        onChange={(v) => set('kind', v)}
        hint={t('calendars.kindHint')}
        options={KINDS.map((k) => ({ value: k, label: strings.calendarKinds[k] }))}
        disabled={disabled}
      />
      <SelectField<string>
        label={t('calendars.timezone')}
        value={values.default_timezone}
        onChange={(v) => set('default_timezone', v)}
        options={timezoneOptions(getDeviceTimezone())}
        searchable
        searchPlaceholder={t('preferences.searchTimezone')}
        disabled={disabled}
      />
    </>
  );
}
