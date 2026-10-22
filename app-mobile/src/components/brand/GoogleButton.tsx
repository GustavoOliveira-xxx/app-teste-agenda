// Botão "Entrar com Google". A marca do Google segue as cores oficiais dele
// (é a única exceção às cores SynCK, exigida pelas regras de uso do Google).
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/i18n';
import { isGoogleEnabled, signInWithGoogle } from '@/services/auth';
import { toFriendlyError } from '@/utils/errors';

import { Button } from '../Button';

const GOOGLE = { azul: '#4285F4', verde: '#34A853', amarelo: '#FBBC05', vermelho: '#EA4335' };

export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path
        fill={GOOGLE.vermelho}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill={GOOGLE.azul}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill={GOOGLE.amarelo}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill={GOOGLE.verde}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** Entra (ou cria a conta) com o Google; erros voltam em `onError`. */
export function GoogleButton({
  title = t('auth.google'),
  onError,
}: {
  title?: string;
  onError: (message: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const press = async () => {
    onError(null);
    setLoading(true);
    try {
      if (!(await isGoogleEnabled())) {
        onError(t('auth.googleUnavailable'));
        return;
      }
      const result = await signInWithGoogle();
      if (result === 'cancelled') onError(t('auth.googleCancelled'));
    } catch (error) {
      onError(toFriendlyError(error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      title={title}
      variant="secondary"
      leading={<GoogleMark />}
      loading={loading}
      onPress={() => void press()}
      testID="google-signin"
    />
  );
}
