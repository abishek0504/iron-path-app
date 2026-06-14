import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkColors,
  lightColors,
  pinkColors,
  type ThemeColors,
  type ThemeOptionId,
} from './theme';

export type ThemeMode = ThemeOptionId;

const STORAGE_KEY = '@iron_path_theme_mode';

interface ThemeContextValue {
  colors: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  themeMode: 'dark',
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (
        stored === 'light' ||
        stored === 'dark' ||
        stored === 'system' ||
        stored === 'pink'
      ) {
        setThemeModeState(stored);
      }
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const colors = useMemo(() => {
    if (themeMode === 'light') return lightColors;
    if (themeMode === 'dark') return darkColors;
    if (themeMode === 'pink') return pinkColors;
    return scheme === 'light' ? lightColors : darkColors;
  }, [themeMode, scheme]);

  const value = useMemo(
    () => ({ colors, themeMode, setThemeMode }),
    [colors, themeMode, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns the active theme colors — re-renders when theme changes. */
export function useTheme(): ThemeColors {
  return useContext(ThemeContext).colors;
}

/** Returns the current theme mode and a setter to change it. */
export function useThemeMode(): Pick<ThemeContextValue, 'themeMode' | 'setThemeMode'> {
  const { themeMode, setThemeMode } = useContext(ThemeContext);
  return { themeMode, setThemeMode };
}
