// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// landscapeData.test.ts — Unit-Tests (L1) für die Landscape-Datenquelle (P-03):
// Konstantes Admin-Set + Katalog-Referenzintegrität. Eine kaputte Datenquelle
// (z. B. catalogId, die es im Katalog nicht gibt) MUSS den Test rot machen.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../config';
import { findService } from '../../lib/catalog';
import {
  ADMIN_COMPONENTS,
  adminCatalogIds,
  buildAdminTiles,
  buildApplicationZones,
  validateLandscapeData,
} from './landscapeData';
import { LANDSCAPE_DE, LANDSCAPE_EN } from './landscapeI18n';

const cfg = DEFAULT_CONFIG;

/** Löst einen Punkt-i18n-Key in einem Katalog-Objekt auf. */
function lookup(catalog: unknown, key: string): string | undefined {
  let cur: unknown = catalog;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

describe('Landscape-Datenquelle (P-03) — Admin-Set + Katalogreferenzen', () => {
  it('Admin-Set erfüllt das Schema (eindeutige, wohlgeformte IDs; Icon gesetzt)', () => {
    expect(ADMIN_COMPONENTS.length).toBeGreaterThanOrEqual(5);
    const seen = new Set<string>();
    for (const c of ADMIN_COMPONENTS) {
      expect(c.id, 'id kebab-case').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(c.icon, `icon ${c.id}`).toBeTruthy();
      expect(seen.has(c.id), `id doppelt: ${c.id}`).toBe(false);
      seen.add(c.id);
    }
  });

  it('jede Katalogreferenz eines Admin-Elements existiert im Katalog (Referenzintegrität)', () => {
    const withRef = ADMIN_COMPONENTS.filter((c) => c.catalogId);
    expect(withRef.length).toBeGreaterThan(0); // der Mechanismus ist belegt
    for (const c of withRef) {
      expect(findService(cfg, c.catalogId!), `${c.id} -> ${c.catalogId}`).toBeDefined();
    }
    expect(validateLandscapeData(cfg)).toEqual([]);
  });

  it('kaputte Datenquelle wird gemeldet (Schema-/Referenzverstoß)', () => {
    const broken = [
      { id: 'Bad_ID', icon: '' }, // Schema-Verstoß: ID-Format + leeres Icon
      { id: 'ghost', icon: '👻', catalogId: 'does-not-exist' }, // Referenzbruch
    ];
    const problems = validateLandscapeData(cfg, broken);
    expect(problems.some((p) => p.startsWith('admin.id.invalid'))).toBe(true);
    expect(problems.some((p) => p.startsWith('admin.icon.empty'))).toBe(true);
    expect(problems.some((p) => p.startsWith('admin.catalogId.missing'))).toBe(true);
  });

  it('Anwendungszonen enthalten keine Admin-beanspruchten Dienste und keine leere Zone', () => {
    const claimed = adminCatalogIds(ADMIN_COMPONENTS);
    expect(claimed.size).toBeGreaterThan(0);
    const zones = buildApplicationZones(cfg);
    expect(zones.length).toBeGreaterThan(0);
    for (const z of zones) {
      expect(z.services.length, `zone ${z.id} leer`).toBeGreaterThan(0);
      for (const s of z.services) {
        expect(claimed.has(s.id), `${s.id} darf nicht im Anwendungs-Layer liegen`).toBe(false);
      }
    }
  });

  it('Schichten überlappen sich nicht: Anwendung ∩ Admin = ∅', () => {
    const claimed = adminCatalogIds(ADMIN_COMPONENTS);
    const appIds = new Set(buildApplicationZones(cfg).flatMap((z) => z.services.map((s) => s.id)));
    for (const id of claimed) {
      expect(appIds.has(id), `${id} darf nur in EINER Schicht liegen`).toBe(false);
    }
    // Alle nicht beanspruchten Katalogdienste bleiben im Anwendungs-Layer sichtbar.
    for (const s of [...cfg.services, ...cfg.staffServices]) {
      if (!claimed.has(s.id)) {
        expect(appIds.has(s.id), `${s.id} fehlt im Anwendungs-Layer`).toBe(true);
      }
    }
  });

  it('Admin-Kacheln lösen ihre Katalogreferenz (launchUrl) auf', () => {
    for (const tile of buildAdminTiles(cfg)) {
      if (tile.catalogId) {
        expect(tile.service?.id, tile.id).toEqual(tile.catalogId);
        expect(tile.service?.launchUrl).toBeTruthy();
      }
    }
  });

  it('i18n: de/en liefern Name + Zweck für jedes Admin-Element und alle UI-Keys', () => {
    for (const c of ADMIN_COMPONENTS) {
      expect(lookup(LANDSCAPE_DE, `landscape.admin.${c.id}.name`), `de name ${c.id}`).toBeTruthy();
      expect(
        lookup(LANDSCAPE_DE, `landscape.admin.${c.id}.purpose`),
        `de purpose ${c.id}`,
      ).toBeTruthy();
      expect(lookup(LANDSCAPE_EN, `landscape.admin.${c.id}.name`), `en name ${c.id}`).toBeTruthy();
      expect(
        lookup(LANDSCAPE_EN, `landscape.admin.${c.id}.purpose`),
        `en purpose ${c.id}`,
      ).toBeTruthy();
    }
    const uiKeys = [
      'landscape.page.title',
      'landscape.page.subtitle',
      'landscape.layer.application',
      'landscape.layer.applicationHint',
      'landscape.layer.admin',
      'landscape.layer.adminHint',
      'landscape.zoom.open',
      'landscape.zoom.close',
      'landscape.zoom.title',
      'landscape.zoom.hint',
    ];
    for (const key of uiKeys) {
      expect(lookup(LANDSCAPE_DE, key), `de ${key}`).toBeTruthy();
      expect(lookup(LANDSCAPE_EN, key), `en ${key}`).toBeTruthy();
    }
  });
});
