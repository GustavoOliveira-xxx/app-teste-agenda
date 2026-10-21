// Campo de data/hora do próprio navegador (<input type="date|time">).
// No iPhone abre a roleta do iOS; no computador, o calendário do navegador.
// O valor trocado é sempre AAAA-MM-DD ou HH:mm, como no celular.
import { createElement } from 'react';

import { MIN_TOUCH, radius, typography } from '@/theme/tokens';

import type { WebDateTimeInputProps } from './WebDateTimeInput';

export type { WebDateTimeInputProps };

export function WebDateTimeInput({ mode, value, onChange, label, dark, colors }: WebDateTimeInputProps) {
  return createElement('input', {
    type: mode,
    value,
    'aria-label': label,
    required: true,
    onChange: (event: { target: { value: string } }) => {
      if (event.target.value) onChange(event.target.value);
    },
    style: {
      minHeight: MIN_TOUCH,
      boxSizing: 'border-box',
      width: '100%',
      padding: '0 12px',
      borderRadius: radius.md,
      border: `1px solid ${colors.border}`,
      background: colors.surface,
      color: colors.text,
      // 16px evita o zoom automático do iPhone ao tocar no campo.
      fontSize: typography.body.fontSize,
      fontFamily: 'inherit',
      colorScheme: dark ? 'dark' : 'light',
    },
  });
}
