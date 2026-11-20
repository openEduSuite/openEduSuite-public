// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// userFacing.ts — Nutzerorientiert-Filter für die 3D-Szene (pure, kein three.js).
//
// Die 3D-Szene ist eine «Benutzer-Bühne»: Admin-/Plattform-Einrichtungen wie
// GitOps (Argo CD) oder die interne BBB-Zweitinstanz haben hier nichts zu
// suchen — sie raubten den echten Werkzeugen Platz und verwirrten. Die
// Keycloak-*Account-Konsole* zählt dagegen zu den nutzerorientierten Diensten
// (Passwort/Profil verwalten) und bleibt sichtbar (Zone „Identität“). Der
// Filter ist bewusst SZENEN-lokal: das Kachel-Dashboard und die
// Landscape-Ansicht zeigen weiterhin den vollen Katalog; nur der 3D-Raum baut
// die gefilterten, aufgeräumten Zonen.
//
// Bewusst ein eigenes (drei-freies) Modul: WorkplaceScene3D lädt die WebGL-
// Szene lazy per dynamischem Import — ein Runtime-Import des drei-Moduls aus
// der Komponente würde diesen Code-Split wieder zunichtemachen.

import type { SceneZone } from './scene';

/** Dienst-Ids, die in der 3D-Szene unterdrückt werden (Admin/Intern). */
export const NON_USER_FACING_SERVICE_IDS: ReadonlySet<string> = new Set([
  'argocd', // GitOps-Plattform (Admin)
  'bbb-internal', // interne Zweit-Instanz von BBB (Nutzer nutzen `bbb`)
]);

/** Ganz ausgeblendete Kategorien (kein dortiger Dienst ist nutzerorientiert). */
export const NON_USER_FACING_CATEGORIES: ReadonlySet<string> = new Set(['infrastructure']);

/**
 * Entfernt alle nicht-nutzerorientierten Tools aus den Zonen und wirft Zonen
 * ohne verbleibende Tools weg (z. B. eine reine Infrastructure-Zone).
 */
export function filterUserFacingZones(zones: SceneZone[]): SceneZone[] {
  const out: SceneZone[] = [];
  for (const zone of zones) {
    const tools = zone.tools.filter(
      (t) =>
        !NON_USER_FACING_SERVICE_IDS.has(t.id) && !NON_USER_FACING_CATEGORIES.has(t.zoneId),
    );
    if (tools.length === 0) continue;
    out.push({ ...zone, tools });
  }
  return out;
}
