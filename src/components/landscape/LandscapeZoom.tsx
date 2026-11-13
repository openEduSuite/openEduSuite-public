// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// LandscapeZoom.tsx — Detail-/Drill-down-Modus der 2D-Landscape (P-03).
//
// Vollfläche-Overlay (fixed inset-0, scrollbar): Dienstnamen, Zonen und
// Admin-Zwecke in großer Typografie — nichts wird abgeschnitten (kein
// truncate/line-clamp, alles break-words). Schließen per Button oder Escape.

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getConfig } from '../../config';
import { ensureLandscapeI18n } from './landscapeI18n';
import {
  ADMIN_LAYER_COLOR,
  buildAdminTiles,
  buildApplicationZones,
} from './landscapeData';

ensureLandscapeI18n();

function serviceName(t: TFunction, id: string): string {
  return t(`services.${id}.name`, { defaultValue: id });
}

function serviceDescription(t: TFunction, id: string): string {
  return t(`services.${id}.description`, { defaultValue: '' });
}

export interface LandscapeZoomProps {
  /** Schließt die Detailansicht (Button oder Escape). */
  onClose: () => void;
}

/** Vergrößerte, vollständig lesbare Ansicht beider Schichten (Overlay). */
export default function LandscapeZoom({ onClose }: LandscapeZoomProps) {
  const { t } = useTranslation();
  const cfg = getConfig();
  const zones = buildApplicationZones(cfg);
  const tiles = buildAdminTiles(cfg);

  // Escape schließt das Overlay (Tastatur-Zugang zur Übersicht).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      data-testid="landscape-zoom"
      data-landscape="zoom"
      role="dialog"
      aria-modal="true"
      aria-label={t('landscape.zoom.title')}
      className="fixed inset-0 z-50 overflow-y-auto bg-white/95 backdrop-blur-sm dark:bg-slate-950/95"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('landscape.zoom.title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('landscape.zoom.hint')}
            </p>
          </div>
          <button
            type="button"
            data-testid="landscape-zoom-close"
            onClick={onClose}
            className="sticky top-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span aria-hidden="true">✕</span>
            {t('landscape.zoom.close')}
          </button>
        </div>

        {/* Anwendungsschicht (Detail): Zonen mit Namen + Beschreibung */}
        <section
          data-testid="landscape-zoom-layer-application"
          data-layer="application"
          aria-label={t('landscape.layer.application')}
          className="mt-6 rounded-2xl border-2 border-blue-300/70 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/20"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl">🖥️</span>
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
              {t('landscape.layer.application')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/70">
            {t('landscape.layer.applicationHint')}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {zones.map((zone) => (
              <div
                key={zone.id}
                data-testid={`landscape-zone-${zone.id}`}
                data-zoneid={zone.id}
                className="rounded-xl border bg-white/80 p-4 dark:bg-slate-900/70"
                style={{ borderColor: `${zone.color}66` }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{zone.icon}</span>
                  <h4
                    className="break-words text-base font-semibold"
                    style={{ color: zone.color }}
                  >
                    {t(zone.labelKey, { defaultValue: zone.id })}
                  </h4>
                </div>
                <ul className="mt-3 space-y-2">
                  {zone.services.map((s) => {
                    const desc = serviceDescription(t, s.id);
                    return (
                      <li
                        key={s.id}
                        data-testid="landscape-zoom-app-service"
                        data-service-id={s.id}
                        className="text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span aria-hidden="true">{s.icon}</span>
                          <span className="break-words font-medium text-gray-900 dark:text-gray-100">
                            {serviceName(t, s.id)}
                          </span>
                        </div>
                        {desc !== '' && (
                          <p className="mt-1 break-words text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                            {desc}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Admin-/Betriebsschicht (Detail): Name + Zweck vollständig */}
        <section
          data-testid="landscape-zoom-layer-admin"
          data-layer="admin"
          aria-label={t('landscape.layer.admin')}
          className="mt-6 rounded-2xl border-2 p-4"
          style={{ borderColor: `${ADMIN_LAYER_COLOR}99`, backgroundColor: 'rgba(244,63,94,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl">🛠️</span>
            <h3 className="text-lg font-bold" style={{ color: ADMIN_LAYER_COLOR }}>
              {t('landscape.layer.admin')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-200/70">
            {t('landscape.layer.adminHint')}
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => (
              <li
                key={tile.id}
                data-testid="landscape-zoom-admin-component"
                data-admin-id={tile.id}
                className="rounded-xl border border-rose-300/60 bg-white/80 p-3 dark:border-rose-800/60 dark:bg-slate-900/70"
              >
                <div className="flex items-start gap-2">
                  <span aria-hidden="true">{tile.icon}</span>
                  <span className="break-words text-sm font-semibold text-rose-900 dark:text-rose-100">
                    {t(`landscape.admin.${tile.id}.name`)}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {t(`landscape.admin.${tile.id}.purpose`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
