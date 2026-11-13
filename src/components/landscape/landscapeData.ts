// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// landscapeData.ts — einzelverantwortliche Datenquelle der 2D-Landscape (P-03).
//
// * Anwendungs-Layer  = Katalogzonen (src/lib/catalog.ts buildZones) minus
//   der Dienste, die der Admin-/Betriebsschicht zugeschlagen sind.
// * Admin-/Betriebs-Layer = konstantes Admin-Set (Verwaltungskomponenten);
//   optionale catalogId wird gegen den Katalog aufgelöst (Name/launchUrl)
//   und per validateLandscapeData + Unit-Test gesichert (Referenzintegrität).

import type { PortalConfig, PortalService } from '../../config';
import { buildZones, findService, type CategoryZone } from '../../lib/catalog';

/** Eine Verwaltungs-/Betriebskomponente der Admin-Schicht. */
export interface AdminComponent {
  /** Wohlgeformte, eindeutige ID (kebab-case). */
  id: string;
  /** Emoji-Icon der Komponente. */
  icon: string;
  /** Optionale Referenz auf einen Katalog-Dienst (launchUrl/Name) — validiert. */
  catalogId?: string;
  /** Optionaler interner SPA-Pfad (statt externer URL). */
  path?: string;
}

/**
 * Konstantes Admin-Set der Admin-/Betriebsschicht. Dienste mit `catalogId`
 * werden aus dem Anwendungs-Layer herausgehalten (keine Vermischung):
 * Betriebstools wie Argo CD gehören zur Betriebsschicht, nicht zu den
 * Endnutzer-Diensten.
 */
export const ADMIN_COMPONENTS: readonly AdminComponent[] = [
  { id: 'portal-admin', icon: '🛡️', path: '/admin' },
  { id: 'keycloak-realm', icon: '🔑' },
  { id: 'argocd-gitops', icon: '🚀', catalogId: 'argocd' },
  { id: 'group-gate', icon: '🚧' },
  { id: 'api-me', icon: '🔌' },
  { id: 'bbb-relay', icon: '🔗' },
  { id: 'sso-pyramid', icon: '🧪' },
  { id: 'blackbox-probes', icon: '📡' },
  { id: 'drift-guard', icon: '📏' },
];

/** Akzentfarbe der Admin-/Betriebsschicht (klar getrennt von Zonenfarben). */
export const ADMIN_LAYER_COLOR = '#f43f5e';

/** Katalog-IDs, die vom Admin-Set beansprucht werden (exkludiert aus Anwendung). */
export function adminCatalogIds(
  components: readonly AdminComponent[] = ADMIN_COMPONENTS,
): Set<string> {
  return new Set(
    components.flatMap((c) => (c.catalogId && c.catalogId !== '' ? [c.catalogId] : [])),
  );
}

/**
 * Zonen des Anwendungs-Layers: Katalogzonen ohne Admin-beanspruchte Dienste;
 * Zonen, die dabei leer werden, entfallen (keine leeren Schichten darstellen).
 */
export function buildApplicationZones(
  cfg: PortalConfig,
  components: readonly AdminComponent[] = ADMIN_COMPONENTS,
): CategoryZone[] {
  const claimed = adminCatalogIds(components);
  return buildZones(cfg)
    .map((z) => ({ ...z, services: z.services.filter((s) => !claimed.has(s.id)) }))
    .filter((z) => z.services.length > 0);
}

/** Admin-Kachel inkl. aufgelöster Katalogreferenz (falls catalogId gesetzt). */
export interface AdminTile extends AdminComponent {
  /** Aufgelöster Katalog-Dienst zur catalogId (undefined ohne/bei Bruch). */
  service?: PortalService;
}

/** Löst das Admin-Set gegen den Katalog auf (Haupt- und Staff-Dienste). */
export function buildAdminTiles(
  cfg: PortalConfig,
  components: readonly AdminComponent[] = ADMIN_COMPONENTS,
): AdminTile[] {
  const byId = new Map<string, PortalService>();
  for (const s of cfg.services) byId.set(s.id, s);
  for (const s of cfg.staffServices) byId.set(s.id, s);
  return components.map((c) => {
    const service = c.catalogId ? byId.get(c.catalogId) : undefined;
    return service ? { ...c, service } : { ...c };
  });
}

/**
 * Validiert die Landscape-Datenquelle gegen ihr Schema und die Katalog-
 * Referenzintegrität. Rückgabe: Liste der Probleme (leer = gültig) —
 * der Unit-Test (landscapeData.test.ts) wird bei Verletzungen rot.
 */
export function validateLandscapeData(
  cfg: PortalConfig,
  components: readonly AdminComponent[] = ADMIN_COMPONENTS,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of components) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) problems.push(`admin.id.invalid:${c.id}`);
    if (!c.icon || c.icon.trim() === '') problems.push(`admin.icon.empty:${c.id}`);
    if (seen.has(c.id)) problems.push(`admin.id.duplicate:${c.id}`);
    seen.add(c.id);
    if (c.catalogId && !findService(cfg, c.catalogId)) {
      problems.push(`admin.catalogId.missing:${c.id}->${c.catalogId}`);
    }
  }
  return problems;
}
