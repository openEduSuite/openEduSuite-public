// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import {
  CORE_FILTER_RULES,
  FILTER_KEYS,
  applyFilter,
  createFilterContract,
  defaultFilterContract,
  enumOf,
  filterUrl,
  parseFilter,
  readFilter,
  serializeFilter,
  type FilterState,
} from './filter';

describe('filter — Serialisierung (Strom F, URL-Vertrag)', () => {
  it('serialisiert einen vollen Filter kanonisch', () => {
    expect(serializeFilter({ view: 'services', zone: 'communication', q: 'mail', focus: 'xwiki' })).toBe(
      '?view=services&zone=communication&q=mail&focus=xwiki',
    );
  });

  it('serialisiert einen leeren Filter zu leerem String', () => {
    expect(serializeFilter({})).toBe('');
  });

  it('encodiert Sonderzeichen korrekt (URLSearchParams-Konvention: Leerzeichen = +)', () => {
    expect(serializeFilter({ q: 'a&b=c ü' })).toBe('?q=a%26b%3Dc+%C3%BC');
    // und der Roundtrip dekodiert '+' korrekt zurück
    expect(parseFilter('?q=a%26b%3Dc+%C3%BC')).toEqual({ q: 'a&b=c ü' });
  });

  it('Roundtrip parse∘serialize ist stabil (auch mit leerem String)', () => {
    const cases = [
      {},
      { view: 'services' as const },
      { view: 'workplace' as const, zone: 'knowledge' },
      { q: 'matrix' },
      { view: 'services' as const, zone: 'communication', q: 'x', focus: 'element' },
    ];
    for (const c of cases) {
      expect(parseFilter(serializeFilter(c))).toEqual(c);
    }
    expect(parseFilter('')).toEqual({});
  });
});

describe('filter — tolerantes Parsen', () => {
  it('ignoriert unbekannte Views und fremde Parameter', () => {
    const f = parseFilter('?view=bogus&zone=communication&other=1&unrelated=x');
    expect(f).toEqual({ zone: 'communication' });
  });

  it('trimmt leere Werte weg', () => {
    expect(parseFilter('?q=%20%20&zone=  ')).toEqual({});
  });

  it('liest aus einer inerten Location', () => {
    expect(readFilter({ search: '?view=workplace&focus=bbb' })).toEqual({ view: 'workplace', focus: 'bbb' });
  });
});

describe('filter — applyFilter/filterUrl (URL-Schreiben ohne Router)', () => {
  it('filterUrl setzt Filter-Parameter auf Basis-URL', () => {
    expect(filterUrl({ view: 'services', zone: 'identity' }, 'https://home.example.org/')).toBe(
      '/?view=services&zone=identity',
    );
  });

  it('applyFilter erhält fremde Query-Parameter und löscht leere Filter-Felder', () => {
    // window.history ist in jsdom vorhanden — nutze applyFilter mit Fenster-URL.
    const orig = window.location.href;
    try {
      window.history.replaceState(null, '', '/?theme=dark&q=mail');
      const next = applyFilter({ zone: 'communication', q: undefined }, { base: window.location.href });
      expect(next).toBe('/?theme=dark&zone=communication');
      expect(new URLSearchParams(window.location.search).get('q')).toBeNull();
    } finally {
      window.history.replaceState(null, '', orig);
    }
  });

  it('applyFilter schreibt pushState bei mode=push', () => {
    const orig = window.location.href;
    try {
      window.history.replaceState(null, '', '/');
      const spy = vi.spyOn(window.history, 'pushState');
      applyFilter({ focus: 'sogo' }, { mode: 'push' });
      expect(spy).toHaveBeenCalled();
      // pushState ohne URL-Update des Location-Objekts in jsdom — Aufruf reicht.
      spy.mockRestore();
    } finally {
      window.history.replaceState(null, '', orig);
    }
  });
});

// ---------------------------------------------------------------------------
// T-PRS-06 — Generischer URL-Filter-Contract (service, Normierung,
// Erweiterbarkeit, non-destructive). Die Blöcke oben bleiben unverändert
// grün (Regressions-Anker); hier kommen die Contract-Erweiterungen.
// ---------------------------------------------------------------------------

describe('filter — generischer Contract: Whitelist & service', () => {
  it('whitelistet mindestens die Schlüssel view|zone|q|service (deklarativ im Modul)', () => {
    for (const k of ['view', 'zone', 'q', 'service'] as const) {
      expect(FILTER_KEYS).toContain(k);
      expect(CORE_FILTER_RULES.map((r) => r.key)).toContain(k);
    }
  });

  it('service=<katalog-id> ist durch parse+serialize round-trip-fähig', () => {
    const f = { view: 'services' as const, zone: 'communication', service: 'xwiki' };
    expect(serializeFilter(f)).toBe('?view=services&zone=communication&service=xwiki');
    expect(parseFilter('?view=services&zone=communication&service=xwiki')).toEqual(f);
    expect(parseFilter(serializeFilter(f))).toEqual(f);
    // Deeplink auf einen Dienst ist teilbar (URL unverändert reproduzierbar)
    expect(filterUrl({ service: 'bbb' }, 'https://portal.example/')).toBe('/?service=bbb');
  });

  it('erkennt auch Staff-/internationale Katalog-Ids als service', () => {
    expect(parseFilter('?service=sogo-staff')).toEqual({ service: 'sogo-staff' });
    expect(parseFilter('?service=bbb-internal')).toEqual({ service: 'bbb-internal' });
  });

  it('normiert unbekannte service-Ids weg (nicht im Katalog)', () => {
    expect(parseFilter('?service=does-not-exist')).toEqual({});
    expect(serializeFilter({ service: 'does-not-exist' })).toBe('');
    // kombiniert mit gültigen Parametern: nur der unbekannte fällt weg
    expect(parseFilter('?service=nope&zone=knowledge')).toEqual({ zone: 'knowledge' });
  });
});

describe('filter — Normierung unbekannter Werte (ein Codepfad)', () => {
  it('entfernt unbekannte view-/zone-Werte beim Serialisieren, hält bekannte', () => {
    expect(serializeFilter({ view: 'bogus' } as unknown as FilterState)).toBe('');
    expect(serializeFilter({ zone: 'no-such-zone' } as unknown as FilterState)).toBe('');
    expect(serializeFilter({ zone: 'communication', view: 'bogus' } as unknown as FilterState)).toBe('?zone=communication');
    // parse∘serialize auf einer "schmutzigen" URL: unbekannt raus, Rest unverändert
    expect(serializeFilter(parseFilter('?view=bogus&zone=communication&service=not-a-service&q=mail'))).toBe(
      '?zone=communication&q=mail',
    );
  });

  it('normalize() ist der gemeinsame Codepfad (parse∘serialize) und verwirft Fremdschlüssel', () => {
    expect(defaultFilterContract.normalize({ view: 'bogus' } as unknown as FilterState)).toEqual({});
    expect(defaultFilterContract.normalize({ zone: 'knowledge', service: 'xwiki' })).toEqual({
      zone: 'knowledge',
      service: 'xwiki',
    });
    // Schlüssel außerhalb der Whitelist werden NIE serialisiert
    expect(defaultFilterContract.normalize({ theme: 'dark' } as unknown as FilterState)).toEqual({});
  });

  it('Modul-Funktionen und defaultFilterContract laufen durch denselben Codepfad', () => {
    for (const s of ['?view=services&zone=knowledge&service=xwiki', '?service=nope&view=bogus', '?q=mail&theme=dark']) {
      expect(parseFilter(s)).toEqual(defaultFilterContract.parse(s));
      expect(serializeFilter(parseFilter(s))).toBe(defaultFilterContract.serialize(defaultFilterContract.parse(s)));
    }
  });

  it('applyFilter ist non-destructive und normiert beim Schreiben', () => {
    const orig = window.location.href;
    try {
      window.history.replaceState(null, '', '/?theme=dark&lang=de');
      const next = applyFilter({ service: 'bbb' }, { base: window.location.href });
      expect(next).toBe('/?theme=dark&lang=de&service=bbb');
      expect(new URLSearchParams(window.location.search).get('theme')).toBe('dark');
      // unbekannter Wert wird auch beim Schreiben normiert entfernt
      const next2 = applyFilter({ zone: 'no-such-zone', service: 'xwiki' } as FilterState, {
        base: window.location.href,
      });
      expect(next2).toBe('/?theme=dark&lang=de&service=xwiki');
    } finally {
      window.history.replaceState(null, '', orig);
    }
  });
});

describe('filter — deklarative Erweiterbarkeit pro Seite', () => {
  it('createFilterContract() meldet zusätzliche Schlüssel an, Kern-Whitelist bleibt', () => {
    const contract = createFilterContract([
      { key: 'persona', normalize: enumOf(['cio', 'studierende', 'didaktik', 'oeffentlichkeit']) },
    ]);
    expect(contract.keys).toEqual(expect.arrayContaining(['view', 'zone', 'q', 'service', 'persona']));
    expect(contract.parse('?persona=cio&view=workplace')).toEqual({ persona: 'cio', view: 'workplace' });
    expect(contract.serialize({ persona: 'cio', q: 'mail' })).toBe('?q=mail&persona=cio');
    // Normierung greift auch für angemeldete Schlüssel
    expect(contract.parse('?persona=unknown')).toEqual({});
    expect(contract.serialize({ persona: 'unknown' })).toBe('');
  });

  it('angemeldete Schlüssel ohne Normalizer akzeptieren beliebige nicht-leere Werte', () => {
    const contract = createFilterContract([{ key: 'tab' }]);
    expect(contract.parse('?tab=ops&zone=identity')).toEqual({ tab: 'ops', zone: 'identity' });
    expect(contract.parse('?tab=%20')).toEqual({});
    expect(contract.serialize({ tab: 'ops' })).toBe('?tab=ops');
  });

  it('Seiten-Regeln überschreiben Kern-Regeln: view kann pro Seite strenger gezogen werden', () => {
    const contract = createFilterContract([{ key: 'view', normalize: enumOf(['services']) }]);
    expect(contract.parse('?view=workplace')).toEqual({});
    expect(contract.serialize({ view: 'workplace' } as unknown as FilterState)).toBe('');
    expect(contract.serialize({ view: 'services' })).toBe('?view=services');
  });
});

// ---------------------------------------------------------------------------
// T-PRS-06 (Erweiterung) — Contract-Verhalten pinnen: kanonische Reihenfolge,
// Position fremder Parameter, wiederholte Parameter, Hash-Erhalt, defensives
// Parsen und Codepfad-Identität. Diese Fälle sichern die Spec-Aussagen
// ab ("Reihenfolge/Existenz vorhandener Parameter bleibt erhalten", "EIN
// Codepfad") zusätzlich zu den Roundtrip-Tests oben.
// ---------------------------------------------------------------------------

describe('filter — Contract-Verhalten pinnen (T-PRS-06 Erweiterung)', () => {
  it('serialisiert kanonisch — unabhängig von der Objekt-Schlüsselreihenfolge', () => {
    // Regel-Reihenfolge (view, zone, q, service, focus) schlägt Insertions-Reihenfolge
    expect(serializeFilter({ q: 'mail', zone: 'knowledge', view: 'services' })).toBe(
      '?view=services&zone=knowledge&q=mail',
    );
    expect(serializeFilter({ service: 'bbb', view: 'workplace' })).toBe('?view=workplace&service=bbb');
    // => identische Zustände erzeugen identische, teilbare URLs
    expect(serializeFilter({ view: 'workplace', service: 'bbb' })).toBe('?view=workplace&service=bbb');
  });

  it('fremde Parameter behalten ihre Position (Reihenfolge bleibt erhalten)', () => {
    const orig = window.location.href;
    try {
      window.history.replaceState(null, '', '/?theme=dark&lang=de');
      const next = applyFilter({ zone: 'identity' }, { base: window.location.href });
      expect(next).toBe('/?theme=dark&lang=de&zone=identity');
      // theme bleibt der ERSTE Parameter — Existenz UND Reihenfolge (Spec-Formulierung)
      expect(window.location.search.startsWith('?theme=dark')).toBe(true);
    } finally {
      window.history.replaceState(null, '', orig);
    }
  });

  it('wiederholte Query-Parameter: erster Wert gewinnt, Serialisierung deterministisch', () => {
    expect(parseFilter('?zone=communication&zone=knowledge')).toEqual({ zone: 'communication' });
    // round-trip entfernt das Duplikat
    expect(serializeFilter(parseFilter('?zone=communication&zone=knowledge'))).toBe('?zone=communication');
  });

  it('applyFilter erhält den URL-Hash (Anker bleibt teilbar)', () => {
    const orig = window.location.href;
    try {
      window.history.replaceState(null, '', '/?theme=dark#top');
      applyFilter({ service: 'bbb' }, { base: window.location.href });
      expect(window.location.search).toBe('?theme=dark&service=bbb');
      expect(window.location.hash).toBe('#top');
    } finally {
      window.history.replaceState(null, '', orig);
    }
  });

  it('parst defensiv: ungültige/leere Suchstrings ergeben den leeren Zustand', () => {
    expect(parseFilter('')).toEqual({});
    expect(parseFilter(null as unknown as string)).toEqual({});
    expect(parseFilter(undefined as unknown as string)).toEqual({});
    expect(parseFilter('?')).toEqual({});
    expect(parseFilter('%%%=' as unknown as string)).toEqual({});
  });

  it('Modul-API und defaultFilterContract sind dieselben Funktionen (EIN Codepfad)', () => {
    expect(parseFilter).toBe(defaultFilterContract.parse);
    expect(serializeFilter).toBe(defaultFilterContract.serialize);
    expect(readFilter).toBe(defaultFilterContract.read);
    expect(applyFilter).toBe(defaultFilterContract.apply);
    expect(filterUrl).toBe(defaultFilterContract.url);
  });

  it('erweiterter Contract: Service-Deeplink und Seitenschlüssel sind gemeinsam round-trip-fähig', () => {
    const contract = createFilterContract([
      { key: 'persona', normalize: enumOf(['cio', 'studierende', 'didaktik', 'oeffentlichkeit']) },
    ]);
    const f = { view: 'services' as const, service: 'xwiki', persona: 'cio' };
    const s = contract.serialize(f);
    expect(s).toBe('?view=services&service=xwiki&persona=cio');
    expect(contract.parse(s)).toEqual(f);
    expect(contract.normalize(f)).toEqual(f);
    // unbekannte persona fällt weg, service bleibt
    expect(contract.parse('?persona=unknown&service=bbb')).toEqual({ service: 'bbb' });
  });
});
