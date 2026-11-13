// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// catalog.ts — gemeinsames Quell-Modell für Portal-Tiles, 3D-Arbeitsplatz und
// Landscape. Ein Dienst nur einmal definiert (config.json), alle Oberflächen
// konsumieren denselben Karten/Metadaten-Builder. So bleibt die Präsentations-
// schicht erweiterbar: ein neues Tool = ein Eintrag in config.json.

import type { PortalConfig, PortalService } from '../config';

export interface CategoryZone {
  /** Kategorie-Id (config.json `category`), identisch zum URL-Filter `zone`. */
  id: string;
  /** Anzeige-Key (i18n) bzw. Fallback-Label. */
  labelKey: string;
  /** Emoji-Icon der Zone. */
  icon: string;
  /** Akzentfarbe (hex) — einheitlich für Tiles, Zonen-Ringe und 3D-Objekte. */
  color: string;
  services: PortalService[];
}

/** Kanonische Zonen-Reihenfolge (wird von Home + 3D-Szene geteilt). */
export const CATEGORY_ORDER = [
  'identity',
  'communication',
  'productivity',
  'knowledge',
  'development',
  'infrastructure',
] as const;

/** Fallback-Metadaten für unbekannte Kategorien (robust gegen neue Kategorien). */
export const ZONE_META: Record<string, { icon: string; color: string }> = {
  identity: { icon: '🔐', color: '#6366f1' },
  communication: { icon: '💬', color: '#0ea5e9' },
  productivity: { icon: '⚡', color: '#22c55e' },
  knowledge: { icon: '📚', color: '#eab308' },
  development: { icon: '🤖', color: '#a855f7' },
  infrastructure: { icon: '🛠️', color: '#64748b' },
};

/**
 * Metadaten des Staff-/Admin-Kreises (eigener innerer Ring im 3D-Raum,
 * getrennt vom User-Kreis).
 */
export const STAFF_META = { icon: '👥', color: '#f59e0b' as const };

const DEFAULT_META = { icon: '🧩', color: '#94a3b8' };

export function zoneMeta(id: string): { icon: string; color: string } {
  return ZONE_META[id] ?? DEFAULT_META;
}

/** Baut eine geordnete Zonen-Karte aus der Portal-Config (inkl. Staff-Dienste). */
export function buildZones(cfg: PortalConfig): CategoryZone[] {
  const map = new Map<string, CategoryZone>();
  const push = (svc: PortalService) => {
    const id = svc.category || 'infrastructure';
    let z = map.get(id);
    if (!z) {
      const meta = zoneMeta(id);
      z = { id, labelKey: `category.${id}`, icon: meta.icon, color: meta.color, services: [] };
      map.set(id, z);
    }
    z.services.push(svc);
  };
  for (const svc of cfg.services) push(svc);
  for (const svc of cfg.staffServices) push(svc);

  const order = new Map<string, number>();
  CATEGORY_ORDER.forEach((id, i) => order.set(id, i));
  const sorted = [...map.values()].sort((a, b) => {
    const ai = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.id.localeCompare(b.id);
  });
  return sorted;
}

/**
 * User-Kreis: geordnete Zonen-Karte NUR aus den Hauptdiensten (kein Staff).
 * Der 3D-Raum trennt User-Apps (äußerer Kreis) und Staff-Apps (innerer Kreis)
 * — dafür stellen buildUserZones/buildStaffZone die beiden Datenquellen.
 */
export function buildUserZones(cfg: PortalConfig): CategoryZone[] {
  const map = new Map<string, CategoryZone>();
  for (const svc of cfg.services) {
    const id = svc.category || 'infrastructure';
    let z = map.get(id);
    if (!z) {
      const meta = zoneMeta(id);
      z = { id, labelKey: `category.${id}`, icon: meta.icon, color: meta.color, services: [] };
      map.set(id, z);
    }
    z.services.push(svc);
  }
  const order = new Map<string, number>();
  CATEGORY_ORDER.forEach((id, i) => order.set(id, i));
  return [...map.values()].sort((a, b) => {
    const ai = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Staff-Kreis: alle Staff-Dienste gebündelt in genau einer Zone (id 'staff').
 * undefined, wenn keine Staff-Dienste konfiguriert sind.
 */
export function buildStaffZone(cfg: PortalConfig): CategoryZone | undefined {
  if (cfg.staffServices.length === 0) return undefined;
  return {
    id: 'staff',
    labelKey: 'category.staff',
    icon: STAFF_META.icon,
    color: STAFF_META.color,
    services: cfg.staffServices,
  };
}

/** Dienst-Lookup über alle Services (Haupt + Staff), für `focus`-Spotlights. */
export function findService(cfg: PortalConfig, id: string): PortalService | undefined {
  return cfg.services.find((s) => s.id === id) ?? cfg.staffServices.find((s) => s.id === id);
}

/** Farbe der Zone eines Dienstes (für Kachel-/3D-Highlighting). */
export function zoneColorOf(_cfg: PortalConfig, svc: PortalService): string {
  return zoneMeta(svc.category || 'infrastructure').color;
}
