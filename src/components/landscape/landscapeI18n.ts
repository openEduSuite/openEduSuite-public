// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// landscapeI18n.ts — i18n-Katalog der 2D-Landscape (P-03), de/en Pflicht.
//
// Bewusst als eigenes Bundle NUR für die Landscape: Die zentralen Locale-
// Dateien (src/locales/*.json) gehören nicht zum Datei-Umfang dieses Moduls;
// die Keys werden hier per addResourceBundle registriert (fr/zh fallen über
// fallbackLng auf Deutsch zurück, bis zentrale Dateien erweitert werden).

import i18n from '../../i18n';

/** Deutsche Texte der Landscape (Schicht-Titel, Zoom, Admin-Set, Seite). */
export const LANDSCAPE_DE = {
  landscape: {
    page: {
      title: 'IT-Landscape',
      subtitle:
        'Klare Schichttrennung: Anwendungsdienste für alle Nutzenden — getrennt von Admin- und Betriebskomponenten. Bewusst 2D, ohne 3D-Szene.',
    },
    layer: {
      application: 'Anwendungsschicht',
      applicationHint: 'Endnutzer-Dienste aus dem Portal-Katalog, gruppiert nach Zonen',
      admin: 'Admin-/Betriebsschicht',
      adminHint: 'Verwaltungs- und Betriebskomponenten — kein Bestandteil der Anwendungsschicht',
    },
    zoom: {
      open: 'Übersicht vergrößern',
      close: 'Detailansicht schließen',
      title: 'Landscape — Detailansicht',
      hint: 'Vergrößerte Ansicht: Dienstnamen, Zonen und Zwecke vollständig lesbar.',
    },
    admin: {
      'portal-admin': {
        name: 'Admin-Arbeitsbereich',
        purpose: 'Rollen-gesteuerte Verwaltungsoberfläche des Portals (Gruppe portal-admins).',
      },
      'keycloak-realm': {
        name: 'SSO-Realm- & Nutzerverwaltung',
        purpose: 'Verwaltung von Realms, Clients und Konten des Identitätsanbieters.',
      },
      'argocd-gitops': {
        name: 'GitOps-Bereitstellung (Argo CD)',
        purpose: 'Continuous Delivery der Plattform: Bereitstellungen direkt aus Git.',
      },
      'group-gate': {
        name: 'oauth2-proxy Group-Gate',
        purpose: 'Gruppenbasierter Zugriffsschutz für Admin-Flächen (portal-admins).',
      },
      'api-me': {
        name: 'Portal-API /api/me',
        purpose: 'Session- und Gruppen-Endpoint hinter dem Portal-nginx.',
      },
      'bbb-relay': {
        name: 'BBB-Shortlink-Relay (/r/)',
        purpose: 'Kurzlink-Dienst, der BigBlueButton-Raum-URLs weiterleitet.',
      },
      'sso-pyramid': {
        name: 'SSO-Testpyramide',
        purpose: 'Playwright-Regressionssuite über alle SSO-geschützten Dienste.',
      },
      'blackbox-probes': {
        name: 'Blackbox-Probes',
        purpose: 'Verfügbarkeits- und Authentifizierungs-Monitoring der Dienste.',
      },
      'drift-guard': {
        name: 'Config-Drift-Guard',
        purpose: 'check-portal-config erkennt Abweichungen zwischen Ist- und Soll-Konfiguration.',
      },
    },
  },
} as const;

/** Englische Texte der Landscape (Keys identisch zu LANDSCAPE_DE). */
export const LANDSCAPE_EN = {
  landscape: {
    page: {
      title: 'IT landscape',
      subtitle:
        'Clear layer separation: end-user application services — strictly separated from admin and operations components. Deliberately 2D, no 3D scene.',
    },
    layer: {
      application: 'Application layer',
      applicationHint: 'End-user services from the portal catalogue, grouped by zone',
      admin: 'Admin & operations layer',
      adminHint: 'Management and operations components — not part of the application layer',
    },
    zoom: {
      open: 'Enlarge overview',
      close: 'Close detail view',
      title: 'Landscape — detail view',
      hint: 'Enlarged view: service names, zones and purposes fully readable.',
    },
    admin: {
      'portal-admin': {
        name: 'Admin workspace',
        purpose: 'Role-gated administration surface of the portal (portal-admins group).',
      },
      'keycloak-realm': {
        name: 'SSO realm & user administration',
        purpose: 'Managing realms, clients and accounts of the identity provider.',
      },
      'argocd-gitops': {
        name: 'GitOps delivery (Argo CD)',
        purpose: 'Continuous delivery of the platform: deployments rolled out from Git.',
      },
      'group-gate': {
        name: 'oauth2-proxy group gate',
        purpose: 'Group-based access protection for admin surfaces (portal-admins).',
      },
      'api-me': {
        name: 'Portal API /api/me',
        purpose: 'Session and group endpoint behind the portal nginx.',
      },
      'bbb-relay': {
        name: 'BBB short-link relay (/r/)',
        purpose: 'Short-link service forwarding BigBlueButton room URLs.',
      },
      'sso-pyramid': {
        name: 'SSO test pyramid',
        purpose: 'Playwright regression suite across all SSO-protected services.',
      },
      'blackbox-probes': {
        name: 'Blackbox probes',
        purpose: 'Availability and authentication monitoring of the services.',
      },
      'drift-guard': {
        name: 'Config drift guard',
        purpose: 'check-portal-config detects drift between actual and desired configuration.',
      },
    },
  },
} as const;

/**
 * Registriert die Landscape-Bundles (deep-merge, overwrite): bestehende Keys
 * der zentralen Locale-Dateien bleiben unberührt. Idempotent aufrufbar.
 */
export function ensureLandscapeI18n(): void {
  i18n.addResourceBundle('de', 'translation', LANDSCAPE_DE, true, true);
  i18n.addResourceBundle('en', 'translation', LANDSCAPE_EN, true, true);
}

ensureLandscapeI18n();
