// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import {
  buildZones,
  buildUserZones,
  buildStaffZone,
  CATEGORY_ORDER,
  findService,
  zoneColorOf,
  STAFF_META,
} from './catalog';

const cfg = DEFAULT_CONFIG as unknown as typeof DEFAULT_CONFIG;

describe('catalog — gemeinsames Quell-Modell (Portal + 3D + Landscape)', () => {
  it('baut Zonen in kanonischer Reihenfolge (CATEGORY_ORDER zuerst)', () => {
    const zones = buildZones(cfg);
    expect(zones.length).toBeGreaterThan(0);
    const ids = zones.map((z) => z.id);
    // Die bekannten Kategorien erscheinen in kanonischer Ordnung vor Unbekannten.
    for (const k of CATEGORY_ORDER) {
      if (ids.includes(k)) {
        expect(ids.indexOf(k)).toBe(CATEGORY_ORDER.indexOf(k));
      }
    }
    expect(zones[0].id).toEqual('identity');
  });

  it('jede Zone kennt ihre Services und Diamant-Metadaten (Farbe/Icon)', () => {
    for (const z of buildZones(cfg)) {
      expect(z.services.length).toBeGreaterThan(0);
      expect(z.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(z.icon).toBeTruthy();
      expect(z.labelKey).toMatch(/^category\./);
    }
  });

  it('Haupt- und Staff-Dienste sind gemeinsam abgedeckt', () => {
    const all = buildZones(cfg).flatMap((z) => z.services);
    const ids = new Set(all.map((s) => s.id));
    for (const s of cfg.services) expect(ids.has(s.id)).toBe(true);
    for (const s of cfg.staffServices) expect(ids.has(s.id)).toBe(true);
  });

  it('findService findet Haupt- und Staff-Dienste', () => {
    const first = cfg.services[0];
    expect(findService(cfg, first.id)?.id).toEqual(first.id);
    if (cfg.staffServices[0]) {
      expect(findService(cfg, cfg.staffServices[0].id)?.id).toEqual(cfg.staffServices[0].id);
    }
  });

  it('zoneColorOf liefert die Zonenfarbe eines Dienstes', () => {
    const s = cfg.services.find((x) => x.category) ?? cfg.services[0];
    expect(zoneColorOf(cfg, s)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('unbekannte Kategorien bleiben robust (Fallback-Metadaten)', () => {
    const weird = { ...cfg, services: [...cfg.services, { id: 'z-test', category: 'bizarre-xyz', launchUrl: 'https://x', icon: '🧪' } as never] };
    const zones = buildZones(weird);
    const z = zones.find((x) => x.id === 'bizarre-xyz');
    expect(z).toBeDefined();
    expect(z!.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(z!.services.length).toBe(1);
  });

  // --- Zwei-Kreise-Aufbau (3D): User-Kreis vs. Staff-Kreis -----------------
  it('buildUserZones enthält nur Hauptdienste (kein Staff)', () => {
    const zones = buildUserZones(cfg);
    const ids = new Set(zones.flatMap((z) => z.services).map((s) => s.id));
    expect(ids.size).toBeGreaterThan(0);
    for (const s of cfg.services) expect(ids.has(s.id)).toBe(true);
    for (const s of cfg.staffServices) expect(ids.has(s.id)).toBe(false);
    // Kanonische Reihenfolge bleibt gültig (User-Kreis = Themen-Kreise).
    expect(zones[0].id).toEqual('identity');
  });

  it('buildStaffZone bündelt alle Staff-Dienste in einer Zone (eigener Kreis)', () => {
    const staff = buildStaffZone(cfg);
    expect(staff).toBeDefined();
    expect(staff!.id).toEqual('staff');
    expect(staff!.labelKey).toEqual('category.staff');
    expect(staff!.icon).toEqual(STAFF_META.icon);
    expect(staff!.color).toEqual(STAFF_META.color);
    const ids = new Set(staff!.services.map((s) => s.id));
    expect(ids.size).toBe(cfg.staffServices.length);
    for (const s of cfg.staffServices) expect(ids.has(s.id)).toBe(true);
  });

  it('buildStaffZone liefert undefined, wenn keine Staff-Dienste existieren', () => {
    const none = { ...cfg, staffServices: [] };
    expect(buildStaffZone(none)).toBeUndefined();
  });

  it('buildUserZones + buildStaffZone decken zusammen alle Dienste ab', () => {
    const all = [...buildUserZones(cfg).flatMap((z) => z.services), ...(buildStaffZone(cfg)?.services ?? [])];
    const ids = new Set(all.map((s) => s.id));
    for (const s of [...cfg.services, ...cfg.staffServices]) expect(ids.has(s.id)).toBe(true);
  });
});
