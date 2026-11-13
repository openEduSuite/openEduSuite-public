// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// OverviewScene.tsx — Einstieg in den interaktiven 3D-«Arbeitsplatz».
//
// Progressive enhancement (Strom B):
//  * WebGL verfügbar  -> drei.js-Szene wird lazy geladen (eigenes Chunk,
//    die kleine Portal-Basis bleibt leicht).
//  * WebGL fehlt      -> statisches Landing-Bild (bisheriges Verhalten),
//    auch als Suspense-Fallback während des Ladens.
//
// Props erlauben der aufrufenden Surface, auf Zonen-Klicks zu reagieren
// (z. B. Deeplink-Filter setzen + scrollen — Strom F).

import { Suspense, lazy } from 'react';
import { webglAvailable } from './webgl';

const WorkplaceScene3D = lazy(() => import('./WorkplaceScene3D'));

interface OverviewSceneProps {
  /** Wird bei Klick auf eine Zonen-Station aufgerufen (zoneId). */
  onZoneSelect?: (zoneId: string) => void;
  className?: string;
}

/** Statisches Fallback-Bild (identisch zur bisherigen Landing-Übersicht). */
export function StaticOverview({ className = '' }: { className?: string }) {
  return (
    <img
      src="/brand/landing-overview.svg"
      alt="openEduSuite — Projektübersicht: ein Login für Mail, Chat, Cloud, Video, Dokumente, Kalender, Identität und KI"
      className={`mx-auto max-w-full w-[840px] h-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg ${className}`}
      data-testid="overview-fallback"
    />
  );
}

export default function OverviewScene({ onZoneSelect, className = '' }: OverviewSceneProps) {
  const ok = webglAvailable();
  return (
    <div className={className} data-testid="overview-3d">
      {ok ? (
        <Suspense fallback={<StaticOverview />}>
          <WorkplaceScene3D onZoneSelect={onZoneSelect} />
        </Suspense>
      ) : (
        <StaticOverview />
      )}
    </div>
  );
}
