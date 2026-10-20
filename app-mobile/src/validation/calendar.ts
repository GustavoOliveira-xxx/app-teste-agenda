import { t } from '@/i18n';

import { clean, type FieldErrors } from './auth';

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function validateCalendar(form: {
  name: string;
  description: string;
  color: string;
}): FieldErrors<'name' | 'description' | 'color'> {
  const name = form.name.trim();
  return clean({
    name: !name
      ? t('validation.required')
      : name.length > 80
        ? t('validation.tooLong', { max: 80 })
        : undefined,
    description: form.description.length > 500 ? t('validation.tooLong', { max: 500 }) : undefined,
    color: HEX_COLOR.test(form.color) ? undefined : t('validation.invalidColor'),
  });
}
