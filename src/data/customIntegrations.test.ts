// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// customIntegrations.test.ts — L1-Vertragstest fuer das Register der
// SSO-integrierten Eigenentwicklungen (Praesentationsschicht P-02).
//
// Vertrag (specs/entscheider-ebene, Requirement "Register der SSO-
// integrierten Eigenentwicklungen"): Single Source customIntegrations.ts mit
// Schema + Validierung; jede Integration beschreibt Name (i18n), Zweck,
// betroffene Dienste (IDs muessen im Katalog existieren), Verifikation
// (Test-Referenz), Repo/Datei und Betriebshinweis. Dieser Test haelt das
// Register gruen und beweist kaputte Daten (Duplikat-ID, leere Pflichtfelder,
// unbekannte Katalog-ID) als rot.

import { describe, expect, it } from 'vitest';
// @ts-ignore — @types/node ist im Dashboard bewusst nicht installiert (keine
// Node-APIs im Produktivcode). Der Repo-Abgleich läuft nur unter Vitest/Node,
// wo 'node:fs' nativ aufgelöst wird; tsc überspringt deshalb nur diese Zeile.
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../config';
import {
  CUSTOM_INTEGRATIONS,
  INTEGRATION_I18N,
  INTEGRATION_LANGS,
  REQUIRED_INTEGRATION_IDS,
  SERVICE_WILDCARD,
  validateCustomIntegrations,
} from './customIntegrations';

// Repo-Root relativ zu dieser Datei (collab-dashboard/src/data/ → Repo-Root).
// Unter Vitest ist import.meta.url eine /@fs-URL — das Praefix wird entfernt;
// der relative Pfad endet bewusst auf '/', sodass Konkatenationen sicher sind.
const REPO_ROOT = (() => {
  let p = decodeURIComponent(new URL('../../../', import.meta.url).pathname);
  if (p.startsWith('/@fs/')) p = p.slice('/@fs'.length);
  if (!p.endsWith('/')) p += '/';
  return p;
})();

// ---------------------------------------------------------------------------
// Katalog-Quellen: gebuendelter Fallback (src/config.default.json via
// DEFAULT_CONFIG) UND der deployte Katalog (config.json-Block aus der
// ConfigMap k8s/openedusuite/configmap-portal.yaml — dieselbe Quelle wie
// tests/sso/check-app-test-matrix.mjs). Nur IDs, die in mindestens einer
// Quelle liegen, duerfen in services[] referenziert werden.
//
// Im Image-Build (Dockerfile-Context = nur collab-dashboard/) liegt das
// Repo-Root mit k8s/ NICHT vor — dann faellt die deployte Quelle aus und der
// repoFile-Existenz-Test wird übersprungen (sonst: Suite-Fehler beim `npm
// test`-Gate, jeder :main-Build bricht ab). Im Voll-Repo-Checkout bleiben
// beide Quellen aktiv.
const REPO_AVAILABLE = existsSync(`${REPO_ROOT}k8s/openedusuite/configmap-portal.yaml`);

function toSurrogate(cpHex: string): string {
  const cp = Number.parseInt(cpHex, 16);
  if (cp < 0x10000) return '\\u' + cp.toString(16).padStart(4, '0');
  const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
  const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
  return '\\u' + hi.toString(16) + '\\u' + lo.toString(16);
}

function readDeployedCatalogIds(): string[] {
  if (!REPO_AVAILABLE) return [];
  const src = readFileSync(`${REPO_ROOT}k8s/openedusuite/configmap-portal.yaml`, 'utf8');
  const m = src.match(/config\.json:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error('config.json nicht aus configmap-portal.yaml extrahierbar');
  const raw = m[1]
    .replace(/\\x([0-9a-fA-F]{2})/g, (_h: string, hex: string) => '\\u00' + hex)
    .replace(/\\U([0-9a-fA-F]{8})/g, (_h: string, cp: string) => toSurrogate(cp));
  const cfg = JSON.parse(JSON.parse('"' + raw + '"')) as {
    services?: { id: string }[];
    staffServices?: { id: string }[];
  };
  return [...(cfg.services ?? []), ...(cfg.staffServices ?? [])].map((s) => s.id);
}

const CATALOG_IDS = new Set<string>([
  ...DEFAULT_CONFIG.services.map((s) => s.id),
  ...DEFAULT_CONFIG.staffServices.map((s) => s.id),
  ...readDeployedCatalogIds(),
]);

/** Listet referenzierbare Katalog-IDs (services[] ohne Wildcard). */
function referencedServiceIds(services: readonly string[]): string[] {
  return services.filter((id) => id !== SERVICE_WILDCARD);
}

describe('customIntegrations — Register der SSO-Eigenentwicklungen (P-02)', () => {
  // Schema- und Katalog-Kreuzcheck brauchen die deployte Katalog-Quelle
  // (configmap-portal.yaml); ohne Repo-Root (Image-Build-Context) sind nur
  // lokale IDs prüfbar — dann wird geskippt statt falsch-rot zu melden.
  it.skipIf(!REPO_AVAILABLE)('erfuellt das Schema ohne Fehler (Single Source gruen)', () => {
    const errors = validateCustomIntegrations(CUSTOM_INTEGRATIONS, {
      knownServiceIds: [...CATALOG_IDS],
    });
    expect(errors).toEqual([]);
  });

  it('enthaelt alle laut Spec geforderten Integrationen', () => {
    const ids = new Set(CUSTOM_INTEGRATIONS.map((i) => i.id));
    for (const required of REQUIRED_INTEGRATION_IDS) {
      expect(ids.has(required), `fehlende Pflicht-Integration: ${required}`).toBe(true);
    }
    expect(CUSTOM_INTEGRATIONS.length).toBeGreaterThanOrEqual(REQUIRED_INTEGRATION_IDS.length);
  });

  it.skipIf(!REPO_AVAILABLE)('referenziert nur Katalog-Dienste (Gebuendelt-Fallback ODER deployter Katalog)', () => {
    expect(CATALOG_IDS.size).toBeGreaterThan(0);
    for (const integration of CUSTOM_INTEGRATIONS) {
      expect(integration.services.length, `${integration.id}: services[] leer`).toBeGreaterThan(0);
      for (const id of referencedServiceIds(integration.services)) {
        expect(
          CATALOG_IDS.has(id),
          `${integration.id}: '${id}' ist keine Katalog-Dienst-ID`,
        ).toBe(true);
      }
    }
  });

  it(`Wildcard '*' (alle Katalog-Dienste) nur allein und nur als services[]-Eintrag`, () => {
    for (const integration of CUSTOM_INTEGRATIONS) {
      const hasWildcard = integration.services.includes(SERVICE_WILDCARD);
      if (hasWildcard) {
        expect(integration.services).toEqual([SERVICE_WILDCARD]);
      }
    }
    // Mindestens eine querschnittliche Integration nutzt die Wildcard.
    expect(CUSTOM_INTEGRATIONS.some((i) => i.services.includes(SERVICE_WILDCARD))).toBe(true);
  });

  it('RT Support-Triage: Register-Eintrag rt-support-triage (Dienst rt, Workflow + Doku)', () => {
    const entry = CUSTOM_INTEGRATIONS.find((i) => i.id === 'rt-support-triage');
    expect(entry, 'Register-Eintrag rt-support-triage fehlt').toBeDefined();
    expect(entry?.services).toEqual(['rt']);
    expect(entry?.verification).toContain('tests/test_rt_support_triage.py');
    expect(entry?.repoFile).toContain('k8s/n8n/workflows/rt-support-triage.json');
    expect(entry?.repoFile).toContain('docs/support-triage.md');
    // Dry-Run-Default ist Teil des Betriebsvertrags (kein Schreiben ohne Env).
    expect(entry?.operational).toContain('RT_TRIAGE_DRY_RUN');
    // Klassifizierung laeuft ueber den LiteLLM-Gateway-Alias, nicht direkt Ollama.
    expect(entry?.purpose).toContain('qwen3-30b');
  });

  it.skipIf(!REPO_AVAILABLE)(
    `Verifikations- und repoFile-Referenzen existieren im Repo`,
    () => {
      const refs = new Set<string>();
      for (const integration of CUSTOM_INTEGRATIONS) {
        integration.verification
          .split(';')
          .map((r) => r.trim())
          .filter(Boolean)
          .forEach((r) => refs.add(`${integration.id}.verification: ${r}`));
        integration.repoFile
          .split(';')
          .map((r) => r.trim())
          .filter(Boolean)
          .forEach((r) => refs.add(`${integration.id}.repoFile: ${r}`));
      }
      expect(refs.size).toBeGreaterThanOrEqual(CUSTOM_INTEGRATIONS.length * 2);
      for (const ref of refs) {
        const path = ref.split(': ', 2)[1];
        expect(existsSync(`${REPO_ROOT}${path}`), `Referenz fehlt im Repo: ${path}`).toBe(true);
      }
    },
  );

  it('nameKey ist in allen vier Sprachdateien des Moduls vorhanden (de/en Pflicht, fr/zh harmonisch)', () => {
    expect(INTEGRATION_LANGS).toContain('de');
    expect(INTEGRATION_LANGS).toContain('en');
    for (const lang of INTEGRATION_LANGS) {
      const bundle = INTEGRATION_I18N[lang];
      expect(bundle, `i18n-Bundle '${lang}' fehlt`).toBeDefined();
      for (const key of ['integrationen.title', 'integrationen.subtitle']) {
        expect(bundle[key], `${lang}: UI-Key '${key}' fehlt`).toBeTruthy();
      }
      for (const integration of CUSTOM_INTEGRATIONS) {
        expect(
          bundle[integration.nameKey],
          `${lang}: nameKey '${integration.nameKey}' fehlt`,
        ).toBeTruthy();
      }
    }
  });

  it('Rot-Beweis: kaputte Datenquelle faellt durch die Validierung', () => {
    const good = {
      id: 'probe-integration',
      nameKey: 'integrationen.items.probe.name',
      purpose: 'Zweck',
      services: ['keycloak'],
      verification: 'tests/sso/pw/pw-drift-guards.mjs',
      repoFile: 'k8s/openedusuite/deploy-oauth2-proxy-admin.yaml',
      operational: 'Betriebshinweis',
    };
    // Basis-Objekt ist gueltig …
    expect(validateCustomIntegrations([good], { knownServiceIds: [...CATALOG_IDS] })).toEqual([]);

    const cases: { label: string; candidates: unknown[]; contains: string }[] = [
      {
        label: 'doppelte ID',
        candidates: [good, { ...good }],
        contains: 'doppelte ID',
      },
      {
        label: 'leerer Zweck',
        candidates: [{ ...good, purpose: '  ' }],
        contains: 'purpose',
      },
      {
        label: 'fehlender Betriebshinweis',
        candidates: [{ ...good, operational: undefined }],
        contains: 'operational',
      },
      {
        label: 'unbekannte Katalog-ID',
        candidates: [{ ...good, services: ['gibt-es-nicht'] }],
        contains: 'keine Katalog-Dienst-ID',
      },
      {
        label: 'Wildcard gemischt mit Katalog-ID',
        candidates: [{ ...good, services: ['keycloak', SERVICE_WILDCARD] }],
        contains: 'nur allein',
      },
      {
        label: 'leere services[]',
        candidates: [{ ...good, services: [] }],
        contains: 'services',
      },
      {
        label: 'kein Objekt',
        candidates: ['kein-objekt'],
        contains: 'kein Integrations-Objekt',
      },
    ];

    for (const { label, candidates, contains } of cases) {
      const errors = validateCustomIntegrations(candidates, { knownServiceIds: [...CATALOG_IDS] });
      expect(errors.length, `Fall '${label}' sollte Fehler liefern`).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.includes(contains)),
        `Fall '${label}' sollte '${contains}' melden, war: ${errors.join(' | ')}`,
      ).toBe(true);
    }
  });
});
