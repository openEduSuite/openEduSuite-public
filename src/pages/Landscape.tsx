// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Landscape.tsx — Seite der 2D-Landscape (Entscheiderebene, P-03).
//
// Routen-Pfad: /landscape (exportiert als LANDSCAPE_PATH). Die Seite bettet
// die embeddable LandscapeOverview ein: zwei klar getrennte Schichten
// (Anwendung vs. Admin/Betrieb) + Zoom-/Detailmodus. Bewusst 2D — keine
// 3D-Szene (der 3D-Arbeitsplatz ist der Anonymous-/Workplace-Modus des
// Dashboards). Zusammen mit Integrationen-/Writer-Zugang ist diese Seite der
// zentrale Einstieg der Entscheiderebene; der Vergleich ist bewusst KEIN Teil
// der Landscape (eigene Seite auf der Marketing-Präsenz).

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LandscapeOverview from '../components/landscape/LandscapeOverview';
import { INTEGRATIONEN_PATH } from './Integrationen';

/** Route der Landscape-Seite (Verdrahtung in App.tsx, s. T-PRS-07). */
export const LANDSCAPE_PATH = '/landscape';

export default function Landscape() {
  const { t } = useTranslation();
  return (
    <main data-testid="landscape-page" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
        {t('landscape.page.title')}
      </h1>
      <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
        {t('landscape.page.subtitle')}
      </p>

      {/* Entscheiderebene-Navigation (aus dem Dashboard hierher umgezogen):
          IT-Landscape (selbst), Eigenentwicklungen und AI-Writer-Personas.
          Der Vergleich ist eigene Seite der Marketing-Präsenz und wird hier
          bewusst nicht verlinkt. */}
      <nav
        data-testid="decision-nav"
        aria-label={t('landscape.decisionNavLabel')}
        className="mt-6 border-b border-gray-200 bg-white/60 dark:border-gray-800 dark:bg-gray-900/60"
      >
        <div className="py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('landscape.decisionNavLabel')}
          </span>
          <Link
            to={LANDSCAPE_PATH}
            data-testid="nav-landscape"
            className="rounded-lg px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/40"
          >
            🗺️ {t('landscape.navLandscape')}
          </Link>
          <Link
            to={INTEGRATIONEN_PATH}
            data-testid="nav-integrationen"
            className="rounded-lg px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/40"
          >
            🧩 {t('landscape.navIntegrationen')}
          </Link>
          <Link
            to="/writer"
            data-testid="nav-writer"
            className="rounded-lg px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/40"
          >
            ✍️ {t('landscape.navWriter')}
          </Link>
        </div>
      </nav>

      <div className="mt-8">
        <LandscapeOverview />
      </div>
    </main>
  );
}
