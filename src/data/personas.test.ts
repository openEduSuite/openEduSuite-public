import { describe, expect, it } from 'vitest';
import {
  PERSONAS,
  REQUIRED_PERSONA_IDS,
  getEnabledPersonas,
  validatePersonas,
  type Persona,
} from './personas';
import de from '../locales/de.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import zh from '../locales/zh.json';

/** Löst einen Punkt-i18n-Key ("writer.title") in einem Katalog-Objekt auf. */
function lookup(catalog: unknown, key: string): string | undefined {
  let cur: unknown = catalog;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

const LOCALES: Record<string, unknown> = { de, en, fr, zh };

/** Erzeugt eine wohlgeformte Persona mit Override (fuer Negativ-Tests). */
function personaFixture(overrides: Partial<Record<keyof Persona, unknown>> = {}): Persona {
  return {
    id: 'fixture-redakteur',
    nameKey: 'writer.personas.cioRedakteur',
    role: 'Rolle',
    tone: 'Ton',
    rules: ['Regel 1', 'Regel 2'],
    example: 'Beispieltext',
    enabled: true,
    ...overrides,
  } as Persona;
}

describe('AI-Writer-Persona-Registry (P-05)', () => {
  it('validiert sauber gegen das Schema (keine Fehler)', () => {
    expect(validatePersonas(PERSONAS)).toEqual([]);
  });

  it('enthaelt mindestens vier Personas mit eindeutigen IDs', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(4);
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deckt die geforderten Zielgruppen ab (CIO, Studierenden-Service, Didaktik, Oeffentlichkeit)', () => {
    const ids = PERSONAS.map((p) => p.id);
    for (const required of REQUIRED_PERSONA_IDS) {
      expect(ids, `Persona ${required} fehlt`).toContain(required);
    }
  });

  it('fuellt alle Pflichtfelder und hat je Persona mindestens zwei Regeln', () => {
    for (const p of PERSONAS) {
      expect(p.id, p.id + '.id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.nameKey.trim(), p.id + '.nameKey').not.toBe('');
      expect(p.role.trim(), p.id + '.role').not.toBe('');
      expect(p.tone.trim(), p.id + '.tone').not.toBe('');
      expect(p.example.trim(), p.id + '.example').not.toBe('');
      expect(Array.isArray(p.rules), p.id + '.rules').toBe(true);
      expect(p.rules.length, p.id + '.rules >= 2').toBeGreaterThanOrEqual(2);
      for (const r of p.rules) expect(r.trim(), p.id + '.rule leer').not.toBe('');
      expect(typeof p.enabled, p.id + '.enabled').toBe('boolean');
    }
  });

  it('loest jeden nameKey in allen Sprachkatalogen auf (i18n de/en/fr/zh)', () => {
    for (const p of PERSONAS) {
      for (const [lng, catalog] of Object.entries(LOCALES)) {
        const value = lookup(catalog, p.nameKey);
        expect(value, `${lng}.${p.nameKey} fehlt`).toBeTruthy();
        expect((value ?? '').trim(), `${lng}.${p.nameKey} leer`).not.toBe('');
      }
    }
  });

  it('liefert nur aktivierte Personas fuer die Writer-UI', () => {
    const enabled = getEnabledPersonas();
    expect(enabled.length).toBeGreaterThan(0);
    expect(enabled.every((p) => p.enabled)).toBe(true);
  });

  it('meldet Duplikat-IDs als Validierungsfehler (rot-Beweis)', () => {
    const broken = [personaFixture(), personaFixture()];
    const errors = validatePersonas(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toMatch(/doppelte|duplicate/i);
  });

  it('meldet leere Pflichtfelder als Validierungsfehler (rot-Beweis)', () => {
    const cases: Array<[string, unknown]> = [
      ['id', ''],
      ['id', 'Kein Slug!'],
      ['nameKey', ''],
      ['role', ''],
      ['tone', ''],
      ['example', ''],
      ['rules', []],
      ['rules', ['nur eine Regel']],
      ['rules', ['Regel 1', '  ']],
      ['enabled', 'yes'],
    ];
    for (const [field, value] of cases) {
      const errors = validatePersonas([personaFixture({ [field]: value } as Partial<Persona>)]);
      expect(errors.length, `Feld ${field}=${JSON.stringify(value)} muss fehlschlagen`).toBeGreaterThan(0);
      expect(errors.join('\n')).toContain(String(field));
    }
  });

  it('weist kaputte Eintraege (falscher Typ) zurueck', () => {
    expect(validatePersonas([null as unknown as Persona, 42 as unknown as Persona]).length).toBeGreaterThan(0);
    expect(validatePersonas([])).toEqual([]);
  });
});
