// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// LandscapeOverview.tsx — 2D-Landscape der Entscheiderebene (P-03).
//
// Zwei klar getrennte, beschriftete und farblich unterschiedene Layer:
//   * „Anwendungsschicht"  = Katalogzonen (src/lib/catalog.ts, config.json)
//   * „Admin-/Betriebsschicht" = konstantes Admin-Set (Verwaltungskomponenten)
// Kein three.js, keine 3D-Szene — bewusst flach und entzifferbar. Über den
// Zoom-Button öffnet LandscapeZoom den Detail-/Drill-down-Modus.
//
// Die Komponente ist embeddable (z. B. Startseite, T-PRS-07): `className`
// wird durchgereicht, der Zoom-Modus ist optional von außen steuerbar
// (`zoomed` + `onZoomChange`); ohne Props verwaltet sie den Zustand selbst.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getConfig } from '../../config';
import { ensureLandscapeI18n } from './landscapeI18n';
import {
  ADMIN_LAYER_COLOR,
  buildAdminTiles,
  buildApplicationZones,
} from './landscapeData';
import LandscapeZoom from './LandscapeZoom';

ensureLandscapeI18n();

function serviceName(t: TFunction, id: string): string {
  return t(`services.${id}.name`, { defaultValue: id });
}

export interface LandscapeOverviewProps {
  /** Zusätzliche Klassen für die einbettende Fläche. */
  className?: string;
  /** Optional gesteuerter Zoom-Zustand (undefined = interner Zustand). */
  zoomed?: boolean;
  /** Meldet Zoom-Öffnen/Schließen an die einbettende Seite. */
  onZoomChange?: (open: boolean) => void;
}

function LandscapeOverview({
  className = '',
  zoomed: zoomedProp,
  onZoomChange,
}: LandscapeOverviewProps) {
  const { t } = useTranslation();
  const [internalZoom, setInternalZoom] = useState(false);
  const zoomed = zoomedProp ?? internalZoom;

  const openZoom = () => {
    setInternalZoom(true);
    onZoomChange?.(true);
  };
  const closeZoom = () => {
    setInternalZoom(false);
    onZoomChange?.(false);
  };

  const cfg = getConfig();
  const zones = buildApplicationZones(cfg);
  const tiles = buildAdminTiles(cfg);

  return (
    <div data-testid="landscape-overview" data-landscape="2d" className={className}>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Layer 1: Anwendungsschicht (Endnutzer-Dienste aus dem Katalog) */}
        <section
          data-testid="landscape-layer-application"
          data-layer="application"
          aria-label={t('landscape.layer.application')}
          className="rounded-2xl border-2 border-blue-300/70 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/20"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl">🖥️</span>
            <h3
              data-testid="landscape-application-title"
              className="text-lg font-bold text-blue-900 dark:text-blue-100"
            >
              {t('landscape.layer.application')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/70">
            {t('landscape.layer.applicationHint')}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {zones.map((zone) => (
              <div
                key={zone.id}
                data-testid={`landscape-zone-${zone.id}`}
                data-zoneid={zone.id}
                className="rounded-xl border bg-white/80 p-3 dark:bg-slate-900/70"
                style={{ borderColor: `${zone.color}66` }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{zone.icon}</span>
                  <h4
                    className="break-words text-sm font-semibold"
                    style={{ color: zone.color }}
                  >
                    {t(zone.labelKey, { defaultValue: zone.id })}
                  </h4>
                </div>
                <ul className="mt-2 space-y-1">
                  {zone.services.map((s) => (
                    <li
                      key={s.id}
                      data-testid="landscape-app-service"
                      data-service-id={s.id}
                      className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200"
                    >
                      <span aria-hidden="true">{s.icon}</span>
                      <span className="break-words">{serviceName(t, s.id)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Layer 2: Admin-/Betriebsschicht (Verwaltungskomponenten) */}
        <section
          data-testid="landscape-layer-admin"
          data-layer="admin"
          aria-label={t('landscape.layer.admin')}
          className="rounded-2xl border-2 p-4"
          style={{ borderColor: `${ADMIN_LAYER_COLOR}99`, backgroundColor: 'rgba(244,63,94,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl">🛠️</span>
            <h3
              data-testid="landscape-admin-title"
              className="text-lg font-bold"
              style={{ color: ADMIN_LAYER_COLOR }}
            >
              {t('landscape.layer.admin')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-200/70">
            {t('landscape.layer.adminHint')}
          </p>
          <ul className="mt-3 space-y-2">
            {tiles.map((tile) => (
              <li
                key={tile.id}
                data-testid="landscape-admin-component"
                data-admin-id={tile.id}
                className="flex items-start gap-2 rounded-lg border border-rose-300/60 bg-white/80 px-3 py-2 text-sm dark:border-rose-800/60 dark:bg-slate-900/70"
              >
                <span aria-hidden="true">{tile.icon}</span>
                <span className="break-words font-medium text-rose-900 dark:text-rose-100">
                  {t(`landscape.admin.${tile.id}.name`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Zoom-/Drill-down-Einstieg (Detailansicht, vollständig lesbar) */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          data-testid="landscape-zoom-open"
          onClick={openZoom}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <span aria-hidden="true">🔍</span>
          {t('landscape.zoom.open')}
        </button>
      </div>

      {zoomed && <LandscapeZoom onClose={closeZoom} />}
    </div>
  );
}

export { LandscapeOverview };
export default LandscapeOverview;
