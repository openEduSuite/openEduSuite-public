// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// filter.ts — generischer, wiederverwendbarer URL-Filter-Contract des Portals.
//
// Design (Strom F + T-PRS-06): Jeder Ansichts-Filter-Zustand wird in die
// URL-Abfrage serialisiert, damit Ansichten teilbar, bookmarkbar und
// refresh-stabil sind – ohne Router-Abhängigkeit (Historie via
// pushState/replaceState). Der Contract ist SEITEN-AGNOSTISCH: Home,
// Vergleich, Integrations-Register, Landscape und Writer nutzen denselben
// Mechanismus statt seiten-spezifischer URL-Bastelei.
//
// Contract-Regeln (specs/deeplink-filter):
//   1. Nur whitelistete Schlüssel werden serialisiert — Kern-Whitelist
//      `FILTER_KEYS` (mind. view|zone|q|service, plus legacy `focus`),
//      pro Seite deklarativ erweiterbar (`createFilterContract([{key:…}])`
//      bzw. `useFilterState({ keys: […] })`).
//   2. EIN Codepfad für parse + serialize: beide laufen über dieselbe
//      Schlüssel-Regel-Liste (Normalizer pro Schlüssel). Die Modul-
//      Funktionen (parseFilter/serializeFilter/…) delegieren an
//      `defaultFilterContract`.
//   3. Non-destructive Updates: fremde Query-Parameter (z. B. `theme`)
//      bleiben beim Schreiben erhalten; nur Contract-Schlüssel werden
//      gesetzt/entfernt.
//   4. Normierung: unbekannte Schlüssel und unbekannte Werte (falsche view,
//      Zone außerhalb des Katalogs, service ohne Katalog-Id) werden beim
//      Serialisieren entfernt.
//   5. `service=<katalog-id>` ist round-trip-fähig (parse∘serialize stabil);
//      unbekannte Ids werden normiert entfernt.
//
// URL-Vertrag (kanonisch):
//   ?view=services|workplace   — welche Oberfläche angezeigt wird
//   &zone=<Kategorie-Id>       — aktive Kategorie/Zone (Katalog-Zone)
//   &q=<text>                  — Freitext-Filter
//   &service=<katalog-id>      — Deeplink auf einen konkreten Dienst
//   &focus=<serviceId>         — Einzeldienst im Spotlight (Legacy, Home)

import { getConfig } from '../config';
import { CATEGORY_ORDER } from './catalog';

export type PortalView = 'services' | 'workplace';

/** Kanonische Portal-Views (Normierung für `view`). */
export const PORTAL_VIEWS = ['services', 'workplace'] as const;

/** Filter-Zustand einer Ansicht; alle Felder optional. Zusätzliche, von
 * Seiten deklarierte Schlüssel sind als String-Werte zulässig. */
export interface FilterState {
  view?: PortalView;
  zone?: string;
  q?: string;
  /** Deeplink auf einen Katalog-Dienst (Katalog-Id). */
  service?: string;
  focus?: string;
  /** Von Seiten angemeldete Zusatzschlüssel (String-Werte). */
  [extraKey: string]: string | undefined;
}

/**
 * Regel für einen whitelisteten URL-Schlüssel. `normalize` entscheidet,
 * ob ein roher Query-Wert gültig ist (getrimmt zurückgegeben) oder
 * unbekannt (`undefined` → Parameter wird beim Serialisieren entfernt).
 */
export interface FilterKeyRule {
  /** URL-Query-Schlüssel (Whitelist-Eintrag). */
  key: string;
  /** Normierung; Default: nicht-leerer, getrimmter String. */
  normalize?: (raw: string) => string | undefined;
}

/** Default-Normalizer: nicht-leere, getrimmte Strings. */
export function nonEmpty(raw: string): string | undefined {
  const v = raw.trim();
  return v === '' ? undefined : v;
}

/** Normalizer-Factory: nur Werte aus einer bekannten Werteliste. */
export function enumOf<T extends string>(values: readonly T[]): (raw: string) => T | undefined {
  return (raw: string): T | undefined => {
    const v = raw.trim();
    return (values as readonly string[]).includes(v) ? (v as T) : undefined;
  };
}

/** Bekannte Zonen: kanonische Reihenfolge ∪ Zonen aus der Portal-Config
 * (bleibt robust gegen Deployments mit eigenen Kategorien). Die Berechnung
 * ist pro Config-Objekt memoiziert (WeakMap, Identität als Schlüssel): bei
 * `loadConfig()` wird ein NEUES Config-Objekt gesetzt und der Cache verfällt
 * automatisch — Verhalten bleibt identisch, nur der Set-Aufbau entfällt. */
const zonesByConfig = new WeakMap<object, Set<string>>();
function knownZones(): Set<string> {
  const cfg = getConfig();
  let zones = zonesByConfig.get(cfg);
  if (zones === undefined) {
    zones = new Set<string>(CATEGORY_ORDER);
    for (const svc of cfg.services) if (svc.category) zones.add(svc.category);
    for (const svc of cfg.staffServices) if (svc.category) zones.add(svc.category);
    zonesByConfig.set(cfg, zones);
  }
  return zones;
}

function normalizeZone(raw: string): string | undefined {
  const v = nonEmpty(raw);
  return v !== undefined && knownZones().has(v) ? v : undefined;
}

/** Bekannte Dienst-Ids (Haupt- + Staff-Dienste) aus der Portal-Config;
 * memoiziert wie knownZones (WeakMap pro Config-Objekt). */
const serviceIdsByConfig = new WeakMap<object, Set<string>>();
function knownServiceIds(): Set<string> {
  const cfg = getConfig();
  let ids = serviceIdsByConfig.get(cfg);
  if (ids === undefined) {
    ids = new Set<string>();
    for (const svc of cfg.services) ids.add(svc.id);
    for (const svc of cfg.staffServices) ids.add(svc.id);
    serviceIdsByConfig.set(cfg, ids);
  }
  return ids;
}

/** Normierung für `service=<katalog-id>`: unbekannte Ids → undefined. */
function normalizeServiceId(raw: string): string | undefined {
  const v = nonEmpty(raw);
  return v !== undefined && knownServiceIds().has(v) ? v : undefined;
}

/** Kanonische Kern-Whitelist des Contracts (deklarativ, ein Codepfad). */
export const FILTER_KEYS = ['view', 'zone', 'q', 'service', 'focus'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Regelwerk der Kern-Whitelist (Reihenfolge = Serialisierungs-Reihenfolge). */
export const CORE_FILTER_RULES: readonly FilterKeyRule[] = [
  { key: 'view', normalize: enumOf(PORTAL_VIEWS) },
  { key: 'zone', normalize: normalizeZone },
  { key: 'q', normalize: nonEmpty },
  { key: 'service', normalize: normalizeServiceId },
  { key: 'focus', normalize: nonEmpty },
];

/**
 * Ein URL-Filter-Contract: Whitelist + Normierung + EIN Codepfad für
 * parse/serialize. Seiten erstellen eigene Instanzen mit zusätzlichen
 * Schlüsseln (überschreiben Kern-Regeln bei gleicher key) oder nutzen die
 * Modul-Funktionen (= `defaultFilterContract`).
 */
export interface FilterContract {
  /** Whitelistete Schlüssel dieses Contracts (Kern + Seiten-Anmeldungen). */
  readonly keys: readonly string[];
  /** Tolerantes Parsen: nur whitelistete Schlüssel, unbekannte Werte fallen weg. */
  parse(search: string): FilterState;
  /** Serialisiert normiert in `?k=v&k2=v2` (leer => ''); unbekanntes wird entfernt. */
  serialize(f: FilterState): string;
  /** Gemeinsamer Codepfad: parse∘serialize — der kanonisch normierte Zustand. */
  normalize(f: FilterState): FilterState;
  /** Liest den Filter aus einer Location (window.location o. inert). */
  read(location?: { search?: string }): FilterState;
  /** Schreibt non-destructive in die Browser-URL (push/replace), gibt Ziel zurück. */
  apply(f: FilterState, opts?: { mode?: 'push' | 'replace'; base?: string }): string;
  /** Deeplink-URL für einen Filter (schreibt nichts). */
  url(f: FilterState, base?: string): string;
}

function normalizeRaw(rule: FilterKeyRule, raw: string | undefined): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  return rule.normalize ? rule.normalize(raw) : nonEmpty(raw);
}

/** Baut einen Contract aus Kern-Whitelist + Seiten-Regeln (key = Identität). */
export function createFilterContract(extraRules: readonly FilterKeyRule[] = []): FilterContract {
  // Seiten-Regeln überschreiben Kern-Regeln mit gleichem key (bewusst):
  // eine Seite darf strenger sein, ohne den globalen Contract zu ändern.
  const byKey = new Map<string, FilterKeyRule>();
  for (const rule of CORE_FILTER_RULES) byKey.set(rule.key, rule);
  for (const rule of extraRules) byKey.set(rule.key, rule);
  const rules = [...byKey.values()];

  const parse = (search: string): FilterState => {
    const out: FilterState = {};
    // defensiv: nur Strings sind sinnvolle Suchstrings (null/undefined/'')
    if (typeof search !== 'string' || search === '') return out;
    let p: URLSearchParams;
    try {
      p = new URLSearchParams(search);
    } catch {
      return out;
    }
    for (const rule of rules) {
      const v = normalizeRaw(rule, p.get(rule.key) ?? undefined);
      if (v !== undefined) out[rule.key] = v;
    }
    return out;
  };

  const write = (params: URLSearchParams, f: FilterState): void => {
    for (const rule of rules) {
      const v = normalizeRaw(rule, f[rule.key]);
      if (v !== undefined) params.set(rule.key, v);
      else params.delete(rule.key); // non-destructive: fremde Keys bleiben unberührt
    }
  };

  const serialize = (f: FilterState): string => {
    const p = new URLSearchParams();
    write(p, f);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const read = (location?: { search?: string }): FilterState => {
    const search =
      (location ?? (typeof window !== 'undefined' ? window.location : { search: '' })).search ?? '';
    return parse(search);
  };

  const apply = (
    f: FilterState,
    opts: { mode?: 'push' | 'replace'; base?: string } = {},
  ): string => {
    const { mode = 'replace', base } = opts;
    if (typeof window === 'undefined' && !base) {
      // ssr/tests ohne window: nur serialisieren
      return serialize(f);
    }
    const url = new URL(base ?? window.location.href);
    write(url.searchParams, f);
    if (typeof window !== 'undefined') {
      window.history[mode === 'push' ? 'pushState' : 'replaceState'](
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    return `${url.pathname}${url.search}`;
  };

  const url = (f: FilterState, base?: string): string => {
    const url = new URL(
      base ?? (typeof window !== 'undefined' ? window.location.href : 'https://portal.example'),
    );
    write(url.searchParams, f);
    return `${url.pathname}${url.search}`;
  };

  return {
    keys: rules.map((r) => r.key),
    parse,
    serialize,
    normalize: (f: FilterState) => parse(serialize(f)),
    read,
    apply,
    url,
  };
}

/** Portal-globaler Standard-Contract (Kern-Whitelist). */
export const defaultFilterContract: FilterContract = createFilterContract();

// Modul-API (kompatibel zu Strom F): delegiert an EINEN Codepfad.
export const parseFilter = defaultFilterContract.parse;
export const serializeFilter = defaultFilterContract.serialize;
export const readFilter = defaultFilterContract.read;
export const applyFilter = defaultFilterContract.apply;
export const filterUrl = defaultFilterContract.url;
