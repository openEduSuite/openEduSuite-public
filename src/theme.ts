export type ThemeChoice = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'portal-theme';

const CHOICES: readonly ThemeChoice[] = ['dark', 'light'];

/**
 * Pick the theme to show. A persisted override (header toggle) wins;
 * otherwise the OS color-scheme preference; else 'light'.
 * Pure + synchronous so it is unit-testable (mirrors resolveLanguage).
 */
export function resolveTheme(
  saved: string | null | undefined,
  prefersDark: boolean,
): ThemeChoice {
  if (saved) {
    const base = saved.toLowerCase().split('-')[0];
    if ((CHOICES as readonly string[]).includes(base)) return base as ThemeChoice;
  }
  return prefersDark ? 'dark' : 'light';
}

export function getSavedTheme(): string | null {
  try {
    return globalThis.localStorage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    // localStorage unavailable (e.g. privacy mode) — fall back to the OS preference
    return null;
  }
}

export function saveTheme(theme: ThemeChoice): void {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable — the toggle still works for this session
  }
}

/** Reflect the theme on <html> (class for Tailwind's class-based dark variant). */
export function applyTheme(theme: ThemeChoice): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
