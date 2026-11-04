import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../config';
import ServiceCard from '../components/ServiceCard';
import WeatherWidget from '../components/WeatherWidget';
import NewsFeeds from '../components/NewsFeeds';
import { useTheme } from '../useTheme';

const categories = [
  { key: 'identity' as const, icon: '🔐' },
  { key: 'communication' as const, icon: '💬' },
  { key: 'productivity' as const, icon: '⚡' },
  { key: 'knowledge' as const, icon: '📚' },
  { key: 'development' as const, icon: '🤖' },
  { key: 'infrastructure' as const, icon: '🛠️' },
];

function Home() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const cfg = getConfig();
  const { services, staffServices, layout, widgets } = cfg;
  const byId = new Map(services.concat(staffServices).map((s) => [s.id, s]));
  const [authed, setAuthed] = useState<boolean | null>(null);

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

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 sm:text-5xl">
            {t('ui.hero')}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('ui.heroSub')}
          </p>

          {/* Projektübersicht (Bird's-Eye) — unter dem Begrüßungstext, gut
              sichtbar auf der Landing-/Abgemeldet-Ansicht, gewollt:
              „so people get an idea what the project is about“. */}
          {authed !== true && (
            <img
              src="/brand/birdeye.webp"
              alt="openEduSuite — Projektübersicht (Bird's-Eye)"
              className="mt-8 mx-auto max-w-full w-[840px] h-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg"
            />
          )}

        </div>
      </div>

      {/* Service Grid — full width so tiles span the whole page.
          Tiles (and widgets) render only for authenticated visitors: while
          signed out the portal is a plain landing page with the login CTA. */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16 w-full">
        {authed === true && (layoutSections
          ? layoutSections.map((sec) => (
              <section key={sec.id} className="mb-10" data-testid={`section-${sec.id}`}>
                <div className="flex items-center gap-2 mb-4">
                  {sec.icon && <span className="text-xl">{sec.icon}</span>}
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t(sec.title)}</h3>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                  {sec.services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            ))
          : categories.map((cat) => {
              const filtered = services.filter((s) => s.category === cat.key);
              if (filtered.length === 0) return null;
              return (
                <section key={cat.key} className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{cat.icon}</span>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t(`category.${cat.key}`)}</h3>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {filtered.map((service) => (
                      <ServiceCard key={service.id} service={service} />
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
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </section>
        )}

        {/* Widgets: weather + university news feeds — one flow, classic minmax(340px) layout */}
        {authed === true && widgets && (
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
