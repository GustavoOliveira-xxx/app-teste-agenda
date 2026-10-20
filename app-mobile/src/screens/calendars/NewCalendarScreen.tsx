import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { getDeviceTimezone } from '@/hooks/useDeviceTimezone';
import { t } from '@/i18n';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { hasErrors } from '@/validation/auth';
import { validateCalendar } from '@/validation/calendar';

import { CalendarFormFields, type CalendarFormValues } from './CalendarFormFields';

export default function NewCalendarScreen() {
  const { run, busy } = useAction();
  const [values, setValues] = useState<CalendarFormValues>({
    name: '',
    description: '',
    color: '#30A46C',
    kind: 'shared',
    default_timezone: getDeviceTimezone(),
  });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'description' | 'color', string>>>({});

  const submit = async () => {
    const v = validateCalendar(values);
    setErrors(v);
    if (hasErrors(v)) return;
    const result = await run(
      () =>
        api.createCalendar({
          ...values,
          name: values.name.trim(),
          description: values.description.trim() || null,
        }),
      { success: t('calendars.created') },
    );
    if (result.ok) {
      await syncNow();
      router.replace({ pathname: '/calendar/[id]', params: { id: result.value } });
    }
  };

  return (
    <Screen footer={<Button title={t('calendars.create')} onPress={submit} loading={busy} />}>
      <Stack.Screen options={{ title: t('calendars.new') }} />
      <CalendarFormFields values={values} onChange={setValues} errors={errors} />
    </Screen>
  );
}
