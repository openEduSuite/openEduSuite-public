import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import { DEFAULT_CONFIG } from './config';

const LOCALES: Record<string, unknown> = { en, de, fr, zh };
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? prefix + '.' + k : k),
  );
}

function baseKeys(obj: unknown): string[] {
  return [...new Set(flatten(obj).map((k) => k.replace(PLURAL_SUFFIX, '')))].sort();
}

function walk(obj: unknown, prefix = ''): Array<[string, string]> {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? prefix + '.' + k : k;
    return typeof v === 'string' ? [[path, v]] : walk(v, path);
  });
}

describe('translation catalogs', () => {
  it('every locale has exactly the same key set as en', () => {
    const enKeys = baseKeys(en);
    for (const [lng, data] of Object.entries(LOCALES)) {
      expect(baseKeys(data), lng + ' key set must match en').toEqual(enKeys);
    }
  });

  it('no value is empty or a bare placeholder', () => {
    const nonEmpty = (v: string) => v.trim().length > 0 && !/^[{}<>]+$/.test(v);
    for (const [lng, data] of Object.entries(LOCALES)) {
      for (const [k, v] of walk(data)) {
        expect(nonEmpty(v), lng + '.' + k + ' empty').toBe(true);
      }
    }
  });

  it('all count-interpolated strings keep their {{count}} placeholder', () => {
    for (const [lng, data] of Object.entries(LOCALES)) {
      const ui = (data as { ui: Record<string, string> }).ui;
      for (const [k, v] of Object.entries(ui)) {
        if (k.startsWith('servicesLive') || k.startsWith('ssoEnabled')) {
          expect(v, lng + '.' + k + ' must keep {{count}}').toContain('{{count}}');
        }
      }
    }
  });

  it('fr _many plural text matches fr _other (only intl rules differ, wording does not)', () => {
    const fr = LOCALES.fr as { ui: Record<string, string> };
    expect(fr.ui.servicesLive_many).toBe(fr.ui.servicesLive_other);
    expect(fr.ui.ssoEnabled_many).toBe(fr.ui.ssoEnabled_other);
  });

  it('pluralization shapes: en/de/fr have _one/_other, fr also _many, zh has the base key only', () => {
    for (const lng of ['en', 'de'] as const) {
      expect(LOCALES[lng]).toMatchObject({
        ui: { servicesLive_one: expect.any(String), servicesLive_other: expect.any(String) },
      });
    }
    expect(LOCALES.fr).toMatchObject({
      ui: {
        servicesLive_one: expect.any(String),
        servicesLive_many: expect.any(String),
        servicesLive_other: expect.any(String),
      },
    });
    expect(zh).toMatchObject({ ui: { servicesLive: expect.any(String) } });
  });

  it('services catalog covers every tile id in the default config', () => {
    const ids = [...DEFAULT_CONFIG.services, ...DEFAULT_CONFIG.staffServices].map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const lng of Object.keys(LOCALES)) {
      const catalog = (LOCALES[lng] as { services: Record<string, unknown> }).services;
      for (const id of ids) {
        expect(catalog[id], lng + ' missing service ' + id).toBeDefined();
      }
    }
  });
});
