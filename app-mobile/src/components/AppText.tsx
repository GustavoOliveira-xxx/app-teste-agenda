import { Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';

type Variant = keyof typeof typography;
type Tone =
  'default' | 'muted' | 'primary' | 'brand' | 'bronze' | 'danger' | 'success' | 'warning' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
}

/** Texto padrão do app: respeita o tamanho de fonte escolhido no aparelho. */
export function AppText({ variant = 'body', tone = 'default', center, style, ...rest }: AppTextProps) {
  const { colors } = useAppTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    primary: colors.primary,
    brand: colors.primaryInk,
    bronze: colors.bronzeInk,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    inverse: colors.primaryText,
  }[tone];
  const isHeading = variant === 'title' || variant === 'heading' || variant === 'display';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : undefined}
      style={[typography[variant], { color }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
