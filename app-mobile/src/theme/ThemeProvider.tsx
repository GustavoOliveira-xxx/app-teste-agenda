// Fornece o tema (claro ou escuro, sempre o do aparelho) para todo o app e
// informa se o aparelho pede menos animações.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { darkPalette, lightPalette, type Palette } from './tokens';

export interface AppTheme {
  colors: Palette;
  dark: boolean;
  reduceMotion: boolean;
}

const ThemeContext = createContext<AppTheme>({ colors: lightPalette, dark: false, reduceMotion: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const dark = system === 'dark';
  const value = useMemo(
    () => ({ colors: dark ? darkPalette : lightPalette, dark, reduceMotion }),
    [dark, reduceMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
