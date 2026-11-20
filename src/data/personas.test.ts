import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PERSONAS,
  REQUIRED_PERSONA_IDS,
  buildPersonaSystemPrompt,
  getEnabledPersonas,
  validatePersonas,
  type Persona,
} from './personas';
import {
  AI_GENERATE_ENDPOINT,
  GenerateError,
  buildGenerateBody,
  generatePersonaText,
} from '../pages/writerGenerate';
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

// ---------------------------------------------------------------------------
// P3-3 — Generierung ueber das Portal-Backend (/api/ai/generate → LiteLLM).
// Vertrag: Der System-Prompt entsteht NUR aus der Registry (role + tone +
// rules); der Client ruft ausschliesslich den relativen same-origin Pfad auf
// und transportiert keinen Key / keine Gateway-URL (siehe server/ai-generate.mjs).
// ---------------------------------------------------------------------------

/** fetch-Stub, der URL + Init aufzeichnet (kein echter Netzwerk-Call). */
function stubFetch(
  impl: (url: unknown, init: unknown) => Promise<unknown>,
): Array<[unknown, unknown]> {
  const calls: Array<[unknown, unknown]> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: unknown) => {
      calls.push([url, init]);
      return impl(url, init);
    }),
  );
  return calls;
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('System-Prompt aus der Registry (P3-3, LiteLLM-Gateway)', () => {
  it('baut den Prompt aus role + tone + rules jeder Persona', () => {
    for (const p of PERSONAS) {
      const prompt = buildPersonaSystemPrompt(p);
      expect(prompt, p.id + '.role').toContain(p.role);
      expect(prompt, p.id + '.tone').toContain(p.tone);
      for (const rule of p.rules) {
        expect(prompt, p.id + '.rule').toContain(rule);
      }
      // Regeln werden nummeriert, damit das Modell sie eindeutig befolgen kann.
      expect(prompt).toContain('1. ' + p.rules[0].trim());
    }
  });

  it('laesst den Beispieltext (example) ausserhalb des System-Prompts', () => {
    for (const p of PERSONAS) {
      expect(buildPersonaSystemPrompt(p)).not.toContain(p.example);
    }
  });

  it('ist deterministisch (kein Zufall, kein i18n-/Netz-Zugriff)', () => {
    for (const p of PERSONAS) {
      expect(buildPersonaSystemPrompt(p)).toBe(buildPersonaSystemPrompt(p));
    }
  });
});

describe('Client-Request an /api/ai/generate (P3-3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const persona = getEnabledPersonas()[0];

  it('zielt auf den relativen same-origin Pfad /api/ai/generate', () => {
    expect(AI_GENERATE_ENDPOINT).toBe('/api/ai/generate');
    expect(AI_GENERATE_ENDPOINT).not.toMatch(/^https?:/);
    expect(AI_GENERATE_ENDPOINT).not.toContain('litellm');
  });

  it('sendet personaId, System-Prompt und Text per POST als JSON', async () => {
    const calls = stubFetch(async () => jsonResponse(200, { text: 'Generierter Text' }));

    const result = await generatePersonaText({ persona, text: '  Rohtext  ' });

    expect(result).toBe('Generierter Text');
    expect(calls.length).toBe(1);
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ai/generate');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.personaId).toBe(persona.id);
    expect(body.systemPrompt).toBe(buildPersonaSystemPrompt(persona));
    expect(body.text).toBe('Rohtext');
  });

  it('sendet KEINEN Key: nur Content-Type-Header, kein Authorization/Bearer', async () => {
    const calls = stubFetch(async () => jsonResponse(200, { text: 'ok' }));

    await generatePersonaText({ persona, text: 'Rohtext' });

    const [, init] = calls[0] as [string, RequestInit];
    expect(Object.keys(init.headers as Record<string, string>)).toEqual(['Content-Type']);
    const serialized = JSON.stringify({
      headers: init.headers,
      body: JSON.parse(String(init.body)),
      url: AI_GENERATE_ENDPOINT,
    });
    // Guard gegen key material / gateway-interna im Client-Request.
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/i);
    expect(serialized).not.toMatch(/bearer|authorization|api[-_]?key|token/i);
    expect(serialized).not.toMatch(/litellm|ollama|cluster\.local|https?:\/\//i);
  });

  it('leitet keinen Key aus der Registry oder dem Body ab (Body nur 3 Felder)', () => {
    const body = buildGenerateBody(persona, 'Rohtext');
    expect(Object.keys(body).sort()).toEqual(['personaId', 'systemPrompt', 'text']);
  });

  it('lehnt leeren Entwurf ab, ohne das Gateway zu fragen', async () => {
    const calls = stubFetch(async () => jsonResponse(200, { text: 'ok' }));
    await expect(generatePersonaText({ persona, text: '   ' })).rejects.toBeInstanceOf(
      GenerateError,
    );
    expect(calls.length).toBe(0);
  });

  it('wirft GenerateError bei HTTP-Fehler (z. B. 503 ohne Gateway) statt zu werfen-los', async () => {
    stubFetch(async () => jsonResponse(503, { error: 'ai-gateway-not-configured' }));
    const error = await generatePersonaText({ persona, text: 'Rohtext' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GenerateError);
    expect((error as GenerateError).status).toBe(503);
  });

  it('wirft GenerateError bei Netzwerkfehler und bei unbrauchbarer Antwort', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(generatePersonaText({ persona, text: 'Rohtext' })).rejects.toBeInstanceOf(
      GenerateError,
    );

    stubFetch(async () => jsonResponse(200, { text: '' }));
    await expect(generatePersonaText({ persona, text: 'Rohtext' })).rejects.toBeInstanceOf(
      GenerateError,
    );
  });
});
