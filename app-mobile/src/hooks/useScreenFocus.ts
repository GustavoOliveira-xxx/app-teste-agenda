import { useIsFocused } from 'expo-router';

/**
 * A tela está em foco? Usado para pausar as animações decorativas de telas que
 * ficaram por baixo de outra. Fora de um navegador (ex.: testes), conta como
 * em foco.
 */
export function useScreenFocus(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}
