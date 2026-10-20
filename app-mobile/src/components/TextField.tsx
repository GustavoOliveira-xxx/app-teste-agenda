import { forwardRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, hint, secure, style, multiline, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.inputBorder;

  return (
    <View style={styles.wrapper}>
      <AppText variant="label" nativeID={`${label}-label`}>
        {label}
      </AppText>
      <View
        style={[
          styles.inputRow,
          { borderColor, backgroundColor: colors.surface, borderWidth: focused || error ? 2 : 1 },
          multiline && { alignItems: 'flex-start' },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            typography.body,
            { color: colors.text },
            multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
            style,
          ]}
          {...rest}
        />
        {secure && (
          <IconButton
            icon={hidden ? 'eye-outline' : 'eye-off-outline'}
            label={hidden ? t('auth.showPassword') : t('auth.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            color={colors.textMuted}
          />
        )}
      </View>
      {error ? (
        <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
  },
  input: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
