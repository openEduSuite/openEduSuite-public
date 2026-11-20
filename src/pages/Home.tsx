import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getConfig, type PortalService } from '../config';
import ServiceCard from '../components/ServiceCard';
import WeatherWidget from '../components/WeatherWidget';
import NewsFeeds from '../components/NewsFeeds';
import ArtGallery from '../components/ArtGallery';
import OverviewScene from '../components/overview3d/OverviewScene';
import { useFilterState } from '../lib/useFilterState';
import type { PortalView } from '../lib/filter';
import { usePortalAuth } from '../lib/portalAuth';
import { useTheme } from '../useTheme';

const categories = [
  { key: 'identity' as const, icon: '🔐' },
  { key: 'communication' as const, icon: '💬' },
  { key: 'productivity' as const, icon: '⚡' },
  { key: 'knowledge' as const, icon: '📚' },
  { key: 'development' as const, icon: '🤖' },
  { key: 'infrastructure' as const, icon: '🛠️' },
];

/**
 * Kachel-Wrapper für das `?service=<katalog-id>`-Deeplink-Ziel (T-PRS-06/07):
 * trägt `data-service-id` als Scroll-Ziel und hebt die Kachel des aktiven
 * Dienst-Deeplinks visuell hervor (Ring). Ohne Deeplink transparent.
 */
function ServiceTile({
  service,
  highlighted,
}: {
  service: PortalService;
  highlighted: boolean;
}) {
  return (
    <div
      data-service-tile={service.id}
      className={
        highlighted
          ? 'rounded-2xl ring-4 ring-blue-500/80 shadow-lg transition-shadow'
          : ''
      }
    >
      <ServiceCard service={service} />
    </div>
  );
}

function Home() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const cfg = getConfig();
  const { services, staffServices, layout, widgets } = cfg;
  const byId = new Map(services.concat(staffServices).map((s) => [s.id, s]));
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { filter, push } = useFilterState();
  const { isAdmin } = usePortalAuth();
  const activeZone = filter.zone;
  const activeService = filter.service;
  const q = (filter.q ?? '').trim().toLowerCase();
  // `view` (Filter-Contract) entscheidet die Oberfläche: `services` = Kacheln
  // (Default), `workplace` = 3D-Ansicht für Eingeloggte. Teilbar/refresh-stabil
  // über ?view=services|workplace (Strom F / T-PRS-06).
  const view: PortalView = filter.view ?? 'services';
  const setView = (v: PortalView) => push({ ...filter, view: v });

  /** q-Filter auf einen Dienst (id/Kategorie-Substring). */
  const matchesQ = (s: { id: string; category?: string }) =>
    !q || s.id.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q);

  /** Sanft zu einer Zonen-/Sections-Spalte scrollen (trotz Sticky-Header). */
  const scrollToZone = (zoneId: string) => {
    requestAnimationFrame(() => {
      try {
        document
          .querySelector(`[data-zoneid="${CSS.escape(zoneId)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* jsdom ohne scrollIntoView — ignorieren */
      }
    });
  };

  /** Sanft zum Dienstkachel eines `service=`-Deeplinks scrollen (T-PRS-06/07).
   * Selektor bewusst getrennt von den Landscape-Listen (`data-service-id`):
   * `data-service-tile` existiert nur auf den Startseiten-Kacheln. */
  const scrollToService = (serviceId: string) => {
    requestAnimationFrame(() => {
      try {
        document
          .querySelector(`[data-service-tile="${CSS.escape(serviceId)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        /* jsdom ohne scrollIntoView — ignorieren */
      }
    });
  };

  /** Zonen-Station in der 3D-Szene => Deeplink-Filter setzen + scrollen (Strom F). */
  const handleZoneSelect = (zoneId: string) => {
    push({ view: 'services', zone: zoneId });
    scrollToZone(zoneId);
  };

  // Deeplink `?view=services&zone=…`: nach dem Laden/Auth-Übergang scrollen.
  useEffect(() => {
    if (authed === true && filter.zone) scrollToZone(filter.zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, filter.zone]);

  // Deeplink `?service=<katalog-id>` (T-PRS-06-Contract): nach dem Auth-
  // Übergang zum Dienstkachel scrollen — die Hervorhebung selbst ist rein
  // deklarativ (activeService), damit Refresh/Teilen denselben Zustand
  // reproduzieren und die URL unverändert teilbar bleibt.
  useEffect(() => {
    if (authed === true && activeService) scrollToService(activeService);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, activeService]);

  // The portal runs behind oauth2-proxy; /oauth2/auth answers 200 when a valid
  // session cookie exists, 401 otherwise. One header action follows the real
  // state: Anmelden when signed out, Abmelden when signed in.
  useEffect(() => {
    let cancelled = false;
    fetch('/oauth2/auth', { cache: 'no-store' })
      .then((r) => !cancelled && setAuthed(r.ok))
      .catch(() => !cancelled && setAuthed(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lang = i18n.resolvedLanguage ?? i18n.language;
    if (lang) document.documentElement.lang = lang;
  }, [i18n.language, i18n.resolvedLanguage]);

  const layoutSections = layout?.sections?.length
    ? layout.sections.map((sec) => ({
        ...sec,
        services: sec.services
          .map((id) => byId.get(id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s)),
      }))
    : null;

  // In flat-layout mode the staff section shows only tiles that are not already
  // placed in the configured sections (avoids duplicates).
  const placedIds = new Set(layout?.sections?.flatMap((s) => s.services) ?? []);
  const remainingStaff = staffServices.filter((s) => !placedIds.has(s.id));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 py-2 flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/brand/openedusuite-logo.svg"
                alt="openEduSuite"
                className="w-10 h-10 shrink-0 rounded-xl shadow-md object-contain"
              />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">openEduSuite</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight truncate">{t('ui.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <label className="sr-only" htmlFor="lang-switcher">{t('ui.langPickerLabel')}</label>
              <select
                id="lang-switcher"
                data-testid="lang-switcher"
                value={i18n.resolvedLanguage}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="zh">中文</option>
              </select>
              <button
                type="button"
                onClick={toggleTheme}
                aria-pressed={isDark}
                aria-label={t('ui.themeToggleLabel')}
                title={t('ui.themeToggleLabel')}
                data-testid="theme-toggle"
                className="inline-flex items-center justify-center w-9 h-9 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              {isAdmin && (
                <Link
                  to="/admin"
                  data-testid="admin-nav"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {t('ui.adminNav', { defaultValue: 'Administration' })}
                </Link>
              )}
              {authed === false && (
                <a
                  href={cfg.sso.loginUrl}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5-4v8" />
                  </svg>
                  {t('ui.login')}
                </a>
              )}
              {authed === true && (
                <a
                  href="/oauth2/sign_out"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t('ui.logout')}
                </a>
              )}
              {authed === true && (
                <a
                  href={`${cfg.sso.accountUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hidden md:inline-flex"
                >
                  {t('ui.account')}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Öffentliche Landing: Kunstgalerie (leichtgewichtige SVG-Poster im Stil
          großer Künstler:innen) statt der interaktiven three.js-Szene — die Szene
          ist von der öffentlichen Seite entfernt und bleibt eingeloggt als
          Arbeitsplatz-Ansicht (?view=workplace) erhalten. Ohne WebGL-Anforderung;
          während authed === null (Auth-Probe läuft) wird gar nichts gerendert,
          damit die Galerie nicht aufblitzt (kein Flackern). */}
      {authed === false && <ArtGallery />}

      {/* Ansichts-Umschalter Kacheln ↔ 3D (Filter-Contract `view`): nur für
          eingeloggte Nutzer:innen. Default sind die Dienstkacheln
          (?view=services), die 3D-Ansicht ist per ?view=workplace teilbar und
          refresh-stabil (T-PRS-06). Kein 3D-Teaser auf der öffentlichen
          Landing-Seite (dort die Kunstgalerie). */}
      {authed === true && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div
            data-testid="view-toggle"
            role="group"
            aria-label={t('ui.viewLabel')}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 p-1"
          >
            <button
              type="button"
              data-testid="view-tiles"
              aria-pressed={view === 'services'}
              onClick={() => setView('services')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'services'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              🧩 {t('ui.viewTiles')}
            </button>
            <button
              type="button"
              data-testid="view-3d"
              aria-pressed={view === 'workplace'}
              onClick={() => setView('workplace')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'workplace'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              🌐 {t('ui.view3d')}
            </button>
          </div>
        </div>
      )}

      {/* 3D-Arbeitsplatz-Ansicht für eingeloggte Nutzer:innen
          (?view=workplace): die interaktive Szene als vollwertige
          Arbeitsplatz-Ansicht — Zonen-Klick springt zurück zu den Kacheln
          (handleZoneSelect setzt view=services). */}
      {authed === true && view === 'workplace' && (
        <section
          data-testid="workplace-3d"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4"
        >
          <OverviewScene onZoneSelect={handleZoneSelect} className="w-full" />
        </section>
      )}

      {/* Entscheider-Navigation ist aus dem Dashboard entfernt: Entscheiderebene
          und IT-Landschaft leben ausschließlich unter /landscape (ohne
          Vergleich — der Vergleich ist eine eigene Seite der Marketing-Präsenz). */}

      {/* Such-/Filterleiste (Strom F: URL-Filter `q` + `zone`) — nur in der
          Kachel-Ansicht (view=services) und nur eingeloggt. */}
      {authed === true && view === 'services' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="service-search">
            {t('services.searchPlaceholder')}
          </label>
          <input
            id="service-search"
            data-testid="service-search"
            type="search"
            value={q}
            onChange={(e) => push({ ...filter, q: e.target.value || undefined })}
            placeholder={t('services.searchPlaceholder')}
            className="w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {q && (
            <button
              type="button"
              data-testid="filter-reset-q"
              onClick={() => push({ ...filter, q: undefined })}
              className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              ✕ {t('services.filterReset')}
            </button>
          )}
          {activeZone && (
            <button
              type="button"
              data-testid="filter-reset-zone"
              onClick={() => push({ ...filter, zone: undefined, view: undefined })}
              className="rounded-lg bg-blue-100 dark:bg-blue-900/50 px-3 py-2 text-sm text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800/60"
            >
              ✕ {t('services.zoneReset', { zone: activeZone })}
            </button>
          )}
          {activeService && (
            <button
              type="button"
              data-testid="filter-reset-service"
              onClick={() => push({ ...filter, service: undefined })}
              className="rounded-lg bg-blue-100 dark:bg-blue-900/50 px-3 py-2 text-sm text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800/60"
            >
              ✕ {t('services.serviceReset', { service: activeService })}
            </button>
          )}
        </div>
      )}

      {/* Service Grid — full width so tiles span the whole page.
          Tiles (and widgets) render only for authenticated visitors: while
          signed out the portal is a plain landing page with the login CTA. */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-16 w-full">
        {authed === true && view === 'services' && (layoutSections
          ? layoutSections.map((sec) => {
              const zoneId = sec.services[0]?.category || sec.id;
              const visible = sec.services.filter((s) => matchesQ(s));
              if (visible.length === 0) return null;
              return (
              <section
                key={sec.id}
                className={`mb-10 scroll-mt-20 rounded-2xl p-4 transition-shadow ${
                  activeZone && (activeZone === sec.id || activeZone === zoneId)
                    ? 'ring-2 ring-blue-500/70 shadow-lg'
                    : ''
                }`}
                data-testid={`section-${sec.id}`}
                data-zoneid={zoneId}
              >
                <div className="flex items-center gap-2 mb-4">
                  {sec.icon && <span className="text-xl">{sec.icon}</span>}
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t(sec.title)}</h3>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                  {visible.map((service) => (
                    <ServiceTile
                      key={service.id}
                      service={service}
                      highlighted={activeService === service.id}
                    />
                  ))}
                </div>
              </section>
              );
            })
          : categories.map((cat) => {
              const filtered = services.filter((s) => s.category === cat.key && matchesQ(s));
              if (filtered.length === 0) return null;
              return (
                <section
                  key={cat.key}
                  className={`mb-10 scroll-mt-20 rounded-2xl p-4 transition-shadow ${
                    activeZone === cat.key ? 'ring-2 ring-blue-500/70 shadow-lg' : ''
                  }`}
                  data-zoneid={cat.key}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{cat.icon}</span>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t(`category.${cat.key}`)}</h3>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {filtered.map((service) => (
                      <ServiceTile
                        key={service.id}
                        service={service}
                        highlighted={activeService === service.id}
                      />
                    ))}
                  </div>
                </section>
              );
            }))}

        {/* Staff & Student Services (deduplicated in flat-layout mode) */}
        {authed === true && remainingStaff.length > 0 && layoutSections && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎓</span>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('ui.staffServices')}</h3>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {remainingStaff.map((service) => (
                <ServiceTile
                  key={service.id}
                  service={service}
                  highlighted={activeService === service.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Widgets: weather + university news feeds + Kalender — one flow,
            classic minmax(340px) layout. Für JEDEN Besucher sichtbar (auch
            abgemeldet): Feeds sind öffentliche Uni-Quellen, keine Dienste. */}
        {widgets && (
          <section className="mb-10" data-testid="widgets-row">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
              {widgets.weather?.enabled && (
                <WeatherWidget src={widgets.weather.src} title={widgets.weather.title} />
              )}
              {widgets.news?.enabled && <NewsFeeds feeds={widgets.news.feeds} />}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('ui.poweredBy', {
                operator: cfg.branding.operator,
                institution: cfg.branding.institution,
              })}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              {authed === true && (
                <a href={cfg.sso.accountUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 dark:hover:text-gray-200">
                  {t('ui.account')}
                </a>
              )}
              {authed === true && <span className="text-gray-300 dark:text-gray-600">|</span>}
              <a href={cfg.docsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 dark:hover:text-gray-200">
                {t('ui.docs')}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
