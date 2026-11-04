import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';

const STORAGE_KEY = 'portal-locale';

export const SUPPORTED = ['de', 'en', 'fr', 'zh'] as const;
export type SupportedLang = (typeof SUPPORTED)[number];

/**
 * Pick the language to show. A persisted override (header switcher) wins;
 * otherwise the first browser-language candidate that we support; else 'de'.
 * Pure + synchronous so it is unit-testable without i18next globals.
 */
export function resolveLanguage(
  candidates: readonly string[],
  saved: string | null | undefined,
): SupportedLang {
  if (saved) {
    const base = saved.toLowerCase().split('-')[0];
    if ((SUPPORTED as readonly string[]).includes(base)) return base as SupportedLang;
  }
  for (const c of candidates) {
    const base = c.toLowerCase().split('-')[0];
    if ((SUPPORTED as readonly string[]).includes(base)) return base as SupportedLang;
  }
  return 'de';
}

function browserLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages)) return [...navigator.languages];
  if (navigator.language) return [navigator.language];
  return [];
}

// Custom detector: the shipping detection logic IS resolveLanguage, so the
// unit tests for resolveLanguage test exactly what runs in production.
// Detection order (per design): persisted localStorage choice wins, then
// browser language (de->en->fr->zh preference), else fallback 'de'.
export const resolveLanguageDetector = {
  type: 'languageDetector' as const,
  init: () => {},
  detect: (): string =>
    resolveLanguage(browserLanguages(), globalThis.localStorage?.getItem(STORAGE_KEY) ?? null),
  cacheUserLanguage: (lng: string) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, lng);
    } catch {
      // localStorage unavailable (e.g. privacy mode) — detection still works per-visit
    }
  },
};

i18n.use(resolveLanguageDetector).use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
    zh: { translation: zh },
  },
  supportedLngs: [...SUPPORTED],
  nonExplicitSupportedLngs: true,
  fallbackLng: 'de',
  interpolation: { escapeValue: false }, // React handles escaping
});

export default i18n;
