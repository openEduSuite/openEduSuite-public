import { afterEach, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resolveLanguageDetector } from './i18n';
// Mirror the production configuration from src/i18n.ts so we test the REAL
// detection machinery (custom detector backed by resolveLanguage, persistence
// through cacheUserLanguage) rather than only the pure helper.
const DETECTION_OPTIONS = {
  resources: { en: { translation: {} }, de: { translation: {} }, fr: { translation: {} }, zh: { translation: {} } },
  supportedLngs: ['de', 'en', 'fr', 'zh'],
  nonExplicitSupportedLngs: true,
  fallbackLng: 'de',
};

async function freshInstance() {
  const inst = i18next.createInstance();
  inst.use(resolveLanguageDetector).use(initReactI18next);
  await inst.init(DETECTION_OPTIONS);
  return inst;
}

// jsdom does not provide navigator.languages by default; define it read-only
function setNavigatorLanguages(langs: string[]) {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    value: langs,
  });
}

describe('real language-detection machinery (localStorage + navigator)', () => {
  afterEach(() => {
    localStorage.clear();
    delete (navigator as { languages?: unknown }).languages;
  });

  it('persisted localStorage choice wins over navigator', async () => {
    localStorage.setItem('portal-locale', 'fr');
    setNavigatorLanguages(['de-DE', 'en-US']);
    const inst = await freshInstance();
    expect(inst.language).toBe('fr');
  });

  it('falls back to the first supported navigator language when nothing cached', async () => {
    setNavigatorLanguages(['de-DE', 'en-US']);
    const inst = await freshInstance();
    expect(inst.language).toBe('de');
  });

  it('normalizes a region-specific navigator language (zh-CN -> zh)', async () => {
    setNavigatorLanguages(['zh-CN']);
    const inst = await freshInstance();
    expect(inst.language).toBe('zh');
  });

  it('falls back to de when nothing matches', async () => {
    setNavigatorLanguages(['es-ES', 'pt-BR']);
    const inst = await freshInstance();
    expect(inst.language).toBe('de');
  });

  it('changeLanguage persists to localStorage for the next visit', async () => {
    setNavigatorLanguages(['de-DE']);
    const inst = await freshInstance();
    await inst.changeLanguage('fr');
    expect(localStorage.getItem('portal-locale')).toBe('fr');
    expect(inst.language).toBe('fr');
  });
});
