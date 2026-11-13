// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Integrationen.tsx — Register der SSO-integrierten Eigenentwicklungen (P-02).
//
// Rendert die validierte Single Source src/data/customIntegrations.ts als
// Karten-Ansicht: Name (i18n), Zweck, betroffene Dienste (Katalog-Chips) und
// ein Verifikations-/Testabzeichen, das nennt, welcher Regressionstest die
// Erweiterung absichert (Spec-Szenario "Entscheider sieht das
// Integrations-Register"). Querschnittliche Integrationen tragen die
// Wildcard '*' (alle Katalog-Dienste), die hier gegen den aktuellen Katalog
// aufgeloest wird.
//
// i18n: Das Bundle INTEGRATION_I18N (de/en Pflicht, fr/zh harmonisch) wird
// beim Modul-Import einmalig als Namespace `integrationen` registriert — so
// bleibt das Register eigenverantwortlich, ohne die globalen locales/*.json
// anzufassen.
//
// Route: /integrationen (Pfad-Konstante INTEGRATIONEN_PATH; Verdrahtung in
// App.tsx gehoert zur Integration T-PRS-07, die Home/Nav/Routen bündelt).

import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getConfig } from '../config';
import { findService, zoneMeta } from '../lib/catalog';
import {
  CUSTOM_INTEGRATIONS,
  INTEGRATION_I18N,
  INTEGRATION_LANGS,
  SERVICE_WILDCARD,
  type CustomIntegration,
} from '../data/customIntegrations';

/** Route dieser Seite (verdrahtet in App.tsx, siehe T-PRS-07). */
export const INTEGRATIONEN_PATH = '/integrationen';

// Namespace einmalig registrieren (idempotent, deep-merge): die Keys leben im
// Datenmodul, nicht in den globalen locales — Single Source bleibt gewahrt.
for (const lng of INTEGRATION_LANGS) {
  i18n.addResourceBundle('integrationen', lng, INTEGRATION_I18N[lng], true, true);
}

/** Löst services[] gegen den Katalog auf: Wildcard → alle Katalog-Dienst-IDs. */
function resolveServiceIds(integration: CustomIntegration): string[] {
  if (!integration.services.includes(SERVICE_WILDCARD)) return [...integration.services];
  const cfg = getConfig();
  const ids = new Set<string>([...cfg.services, ...cfg.staffServices].map((s) => s.id));
  return [...ids];
}

/** ';'-getrennte Repo-Referenzen (verification/repoFile) als Liste. */
function splitRefs(refs: string): string[] {
  return refs
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean);
}

function IntegrationCard({ integration }: { integration: CustomIntegration }) {
  const { t } = useTranslation('integrationen');
  const serviceIds = resolveServiceIds(integration);
  const isWildcard = integration.services.includes(SERVICE_WILDCARD);
  const verificationRefs = splitRefs(integration.verification);

  return (
    <article
      data-testid={`integrationen-card-${integration.id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t(integration.nameKey)}
        </h2>
        {/* Verifikations-/Testabzeichen: nennt die absichernden Regressionstests. */}
        <span
          data-testid={`integrationen-badge-${integration.id}`}
          title={verificationRefs.join('\n')}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          {t('integrationen.badgeVerified')}
        </span>
      </header>

      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {integration.purpose}
      </p>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {isWildcard ? t('integrationen.allServicesLabel') : t('integrationen.servicesLabel')}
        </h3>
        <ul
          data-testid={`integrationen-services-${integration.id}`}
          className="mt-1.5 flex flex-wrap gap-1.5"
        >
          {serviceIds.map((id) => {
            const svc = findService(getConfig(), id);
            const color = zoneMeta(svc?.category ?? '').color;
            return (
              <li
                key={id}
                style={{ borderColor: color }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs text-slate-700 dark:text-slate-300"
                title={svc ? `${svc.icon} ${svc.category}` : id}
              >
                <span aria-hidden="true">{svc?.icon ?? zoneMeta('').icon}</span>
                {id}
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('integrationen.verificationLabel')}
          </dt>
          <dd data-testid={`integrationen-verification-${integration.id}`}>
            <ul className="mt-1 space-y-0.5">
              {verificationRefs.map((ref) => (
                <li key={ref} className="font-mono text-xs text-slate-600 dark:text-slate-400">
                  {ref}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('integrationen.repoFileLabel')}
          </dt>
          <dd className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-400">
            {splitRefs(integration.repoFile).join(' · ')}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('integrationen.operationalLabel')}
          </dt>
          <dd className="mt-1 text-slate-700 dark:text-slate-300">{integration.operational}</dd>
        </div>
      </dl>
    </article>
  );
}

function Integrationen() {
  const { t } = useTranslation('integrationen');

  return (
    <main data-testid="integrationen-page" className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
        {t('integrationen.title')}
      </h1>
      <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
        {t('integrationen.subtitle')}
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {CUSTOM_INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>
    </main>
  );
}

export default Integrationen;
