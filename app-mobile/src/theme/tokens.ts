// Sistema de design: cores, espaçamentos, bordas, tipografia e sombras.
// Contraste dos textos principais acima de 4,5:1 nos dois temas (WCAG AA).
import { Platform } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  /** Borda de campos de formulário (contraste mínimo de 3:1 com o fundo). */
  inputBorder: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  danger: string;
  /** Texto sobre fundo `danger` (botões destrutivos). */
  dangerText: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  focus: string;
  overlay: string;
  today: string;
}

export const lightPalette: Palette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  border: '#D5DAE1',
  inputBorder: '#858D9B',
  text: '#1A1D23',
  textMuted: '#555B68',
  primary: '#3358D4',
  primaryText: '#FFFFFF',
  primarySoft: '#E6ECFC',
  danger: '#C2261F',
  dangerText: '#FFFFFF',
  dangerSoft: '#FDECEB',
  success: '#1F7A45',
  successSoft: '#E5F4EA',
  warning: '#8A5300',
  warningSoft: '#FFF3DC',
  focus: '#1F3FA8',
  overlay: 'rgba(0,0,0,0.45)',
  today: '#3358D4',
};

export const darkPalette: Palette = {
  background: '#111318',
  surface: '#1A1D24',
  surfaceAlt: '#242833',
  border: '#363C4A',
  inputBorder: '#646C7E',
  text: '#ECEEF2',
  textMuted: '#AAB1BE',
  primary: '#8EA6F0',
  primaryText: '#0E1426',
  primarySoft: '#26304D',
  danger: '#FF8A80',
  dangerText: '#2A0B09',
  dangerSoft: '#3D1F1E',
  success: '#7CD49B',
  successSoft: '#1C3326',
  warning: '#FFC266',
  warningSoft: '#3A2C14',
  focus: '#C3D0FA',
  overlay: 'rgba(0,0,0,0.6)',
  today: '#8EA6F0',
};

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

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Área mínima de toque recomendada (48 dp no Android). */
export const MIN_TOUCH = 48;

export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  display: { fontSize: 28, lineHeight: 36, fontWeight: '800' as const },
};

export const shadow = Platform.select({
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
