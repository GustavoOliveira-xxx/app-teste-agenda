// Sistema de design: cores, espaçamentos, bordas, tipografia e sombras.
// As escolhas de identidade visual (cores, fonte, cantos) ficam em marca.ts.
// Contraste dos textos principais acima de 4,5:1 nos dois temas (WCAG AA).
import { Platform } from 'react-native';

import { marca, type CoresDoTema, type PesoDaFonte } from './marca';

export type Palette = CoresDoTema;

export const lightPalette: Palette = marca.cores.claro;

export const darkPalette: Palette = marca.cores.escuro;

/** Cores para agendas e eventos, com nome (para não depender só da cor). */
export const CALENDAR_COLORS: { value: string; name: string }[] = [
  { value: '#3358D4', name: 'Azul' },
  { value: '#E5484D', name: 'Vermelho' },
  { value: '#30A46C', name: 'Verde' },
  { value: '#F76B15', name: 'Laranja' },
  { value: '#8E4EC6', name: 'Roxo' },
  { value: '#0090FF', name: 'Azul-claro' },
  { value: '#D6409F', name: 'Rosa' },
  { value: '#12A594', name: 'Turquesa' },
  { value: '#AD7F58', name: 'Marrom' },
  { value: '#5B5BD6', name: 'Índigo' },
];

export function colorName(value: string | null | undefined): string {
  return (
    CALENDAR_COLORS.find((c) => c.value.toLowerCase() === (value ?? '').toLowerCase())?.name ??
    'Personalizada'
  );
}

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;

export const radius = {
  sm: marca.cantos.pequeno,
  md: marca.cantos.medio,
  lg: marca.cantos.grande,
  pill: 999,
} as const;

/** Área mínima de toque recomendada (48 dp no Android). */
export const MIN_TOUCH = 48;

const PESOS: Record<PesoDaFonte, '400' | '500' | '600' | '700'> = {
  regular: '400',
  medio: '500',
  semi: '600',
  negrito: '700',
};

/**
 * Estilo de fonte para um peso. Com fonte própria (marca.fonte.familias), usa
 * o arquivo daquele peso; sem ela, a fonte do sistema com o peso numérico.
 */
export function fonte(peso: PesoDaFonte): {
  fontFamily?: string;
  fontWeight?: '400' | '500' | '600' | '700';
} {
  const familia = marca.fonte.familias[peso] ?? marca.fonte.familias.regular;
  return familia ? { fontFamily: familia } : { fontWeight: PESOS[peso] };
}

export const typography = {
  caption: { fontSize: 12, lineHeight: 16, ...fonte('regular') },
  small: { fontSize: 14, lineHeight: 20, ...fonte('regular') },
  body: { fontSize: 16, lineHeight: 24, ...fonte('regular') },
  label: { fontSize: 14, lineHeight: 20, ...fonte('semi') },
  heading: { fontSize: 18, lineHeight: 26, ...fonte('semi') },
  title: { fontSize: 22, lineHeight: 30, ...fonte('semi') },
  display: { fontSize: 28, lineHeight: 36, ...fonte('negrito') },
};

export const shadow = !marca.sombra
  ? {}
  : Platform.select({
      android: { elevation: 2 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
    });

/** Cor de texto legível sobre um fundo colorido (preto ou branco). */
/** Luminância relativa de #111318. */
const DARK_TEXT_LUMINANCE = 0.0065;

export function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Escolhe o texto (branco ou quase preto) com maior contraste (WCAG).
  const withWhite = 1.05 / (luminance + 0.05);
  const withDark = (luminance + 0.05) / (DARK_TEXT_LUMINANCE + 0.05);
  return withDark > withWhite ? '#111318' : '#FFFFFF';
}
