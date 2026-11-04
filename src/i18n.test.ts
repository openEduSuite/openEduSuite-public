import { describe, expect, it } from 'vitest';
import { resolveLanguage } from './i18n';

describe('resolveLanguage', () => {
  it('persisted choice wins over browser language', () => {
    expect(resolveLanguage(['de-DE', 'en-US'], 'fr')).toBe('fr');
  });
  it('falls back to browser language when nothing saved', () => {
    expect(resolveLanguage(['fr-FR', 'en-US'], null)).toBe('fr');
    expect(resolveLanguage(['en-US', 'zh-CN'], null)).toBe('en');
    expect(resolveLanguage(['zh-CN'], null)).toBe('zh');
  });
  it('ignores an unsupported saved value', () => {
    expect(resolveLanguage(['de-DE'], 'es')).toBe('de');
  });
  it('defaults to de when nothing matches', () => {
    expect(resolveLanguage(['es-ES', 'it-IT'], null)).toBe('de');
    expect(resolveLanguage([], '')).toBe('de');
  });
  it('normalizes region codes down to the base language', () => {
    expect(resolveLanguage(['de-DE'], null)).toBe('de');
    expect(resolveLanguage(['zh-CN'], null)).toBe('zh');
    expect(resolveLanguage(['FR'], null)).toBe('fr');
  });
});
