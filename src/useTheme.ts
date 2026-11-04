import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  getSavedTheme,
  prefersDarkScheme,
  resolveTheme,
  saveTheme,
  type ThemeChoice,
} from './theme';

/** Theme state: OS preference wins initially, persisted override thereafter. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(() =>
    resolveTheme(getSavedTheme(), prefersDarkScheme()),
  );

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
