// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Admin.tsx — rollen-gated Admin-Arbeitsbereich der Portal-SPA (Variante 1).
// Die Seite rendert ausschließlich bei nachgewiesener Mitgliedschaft in der
// Gruppe `/portal-admins` (progressive enhancement): ohne Nachweis keinerlei
// Admin-Inhalt. Die Admin-Kacheln kommen aus dem Portal-Katalog
// (staffServices/catalog-LaunchUrls) — die launchUrl wird nicht doppelt
// gepflegt, sondern direkt aus config.json aufgelöst.

import { useTranslation } from 'react-i18next';
import { getConfig } from '../config';
import type { PortalService } from '../config';
import { usePortalAuth } from '../lib/portalAuth';

/** Admin-Kacheln (Variante 1): Verwaltungs-/Betriebs-Dienste aus dem Katalog.
    Nicht im Katalog → Kachel entfällt (robust, progressive). */
const ADMIN_TILE_IDS = ['argocd', 'keycloak'] as const;

/** Löst die Admin-Kacheln gegen den Portal-Katalog auf (Haupt + Staff). */
function adminTiles(): PortalService[] {
  const cfg = getConfig();
  const byId = new Map<string, PortalService>();
  for (const s of cfg.services) byId.set(s.id, s);
  for (const s of cfg.staffServices) byId.set(s.id, s);
  return ADMIN_TILE_IDS.map((id) => byId.get(id)).filter(
    (s): s is PortalService => Boolean(s),
  );
}

interface AdminProps {
  /** Extern nachgewiesene Admin-Mitgliedschaft; falls undefined entscheidet portalAuth. */
  isAdmin?: boolean;
}

export default function Admin({ isAdmin: isAdminProp }: AdminProps = {}) {
  const { t } = useTranslation();
  const { isAdmin: hookIsAdmin } = usePortalAuth();
  const allowed = isAdminProp ?? hookIsAdmin;

  if (!allowed) return null;

  const tiles = adminTiles();

  return (
    <main
      data-testid="admin-workspace"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
        {t('admin.title', { defaultValue: 'Admin-Arbeitsbereich' })}
      </h1>
      <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
        {t('admin.subtitle', {
          defaultValue:
            'Verwaltung und Betrieb der openEduSuite-Plattform — sichtbar nur für Mitglieder der Admin-Gruppe.',
        })}
      </p>

      {tiles.length > 0 && (
        <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {tiles.map((service) => (
            <a
              key={service.id}
              href={service.launchUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`admin-tile-${service.id}`}
              className="group block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg dark:hover:shadow-blue-900/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl" role="img" aria-label={t(`services.${service.id}.name`)}>
                  {service.icon}
                </span>
                <svg
                  className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h4 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {t(`services.${service.id}.name`)}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t(`services.${service.id}.description`)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                {t('admin.open', { defaultValue: 'Öffnen' })}
              </span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
