import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyTheme,
  getSavedTheme,
  resolveTheme,
  saveTheme,
  THEME_STORAGE_KEY,
  prefersDarkScheme,
} from './theme';

describe('resolveTheme', () => {
  it('persisted "dark" wins over a light system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('persisted "light" wins over a dark system preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('falls back to the system preference when nothing is saved', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(undefined, false)).toBe('light');
  });

  it('ignores an invalid saved value and uses the system preference', () => {
    expect(resolveTheme('luxury', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
  });

  it('accepts case variants and BCP-47 prefixes like the locale resolver', () => {
    expect(resolveTheme('DARK', false)).toBe('dark');
    expect(resolveTheme('dark-system', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('adds the dark class and color-scheme for dark, removes them for light', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a saved theme through localStorage', () => {
    expect(getSavedTheme()).toBeNull();
    saveTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(getSavedTheme()).toBe('dark');
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    try {
      expect(() => saveTheme('light')).not.toThrow();
      expect(getSavedTheme()).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });

  it('prefersDarkScheme reads the media query, safe without matchMedia', () => {
    const original = window.matchMedia;
    // @ts-expect-error - intentionally removing matchMedia for the SSR/jsdom guard test
    delete window.matchMedia;
    try {
      expect(prefersDarkScheme()).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
