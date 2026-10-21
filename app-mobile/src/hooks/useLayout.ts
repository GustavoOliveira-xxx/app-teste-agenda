import { useWindowDimensions } from 'react-native';

import { layoutFor, type Layout } from '@/utils/layout';

/** Tamanho de tela atual; muda sozinho ao girar o aparelho ou redimensionar a janela. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return layoutFor(width);
}
