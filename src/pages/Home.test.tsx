import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import Home from './Home';

function renderHome() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Home (portal)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    // Header probes /oauth2/auth: 401 => signed out => “Anmelden” shown by
    // default; the flat-layout test below overrides to signed-in for “Abmelden”.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
  });

  it('renders English content by default', async () => {
    renderHome();
    expect(await waitFor(() => screen.getByText('Login'))).toBeInTheDocument();
    // Hero-Text ist entfernt: die Landing-Seite zeigt keinen Begrüßungs-Hero
    // mehr (der Header-Untertitel ui.subtitle bleibt bewusst bestehen).
    expect(screen.queryByText('Your collaborative workspace')).not.toBeInTheDocument();
    // Signed out: no service tiles and no account link anywhere.
    expect(screen.queryByTestId('section-dienste')).not.toBeInTheDocument();
    expect(document.querySelectorAll('a[href*="account"]').length).toBe(0);
    // Öffentliche Landing ohne three.js: keine interaktive 3D-Szene und kein
    // WebGL-Fallback — stattdessen die Kunstgalerie (SVG-Poster im Stil großer
    // Künstler:innen); Picassos Projektübersicht bleibt die erste Folie.
    expect(screen.queryByTestId('overview-3d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-fallback')).not.toBeInTheDocument();
    expect(screen.getByTestId('art-gallery')).toBeInTheDocument();
    expect(screen.getByAltText(/Projektübersicht/).getAttribute('src')).toBe('/brand/landing-overview.svg');
  });

  it('keeps the public landing free of the 3D scene (tiles = portal default)', async () => {
    // Die three.js-Szene ist von der öffentlichen Startseite entfernt: anonyme
    // Besucher sehen statt des interaktiven 3D-Teasers die Kunstgalerie (ohne
    // WebGL-Fallback) — die Kachel-Ansicht ist die Default-Ansicht des
    // (eingeloggten) Portals, die Sign-out-Landing bleibt ohne Dienste
    // (Galerie + Widgets + Login-CTA).
    renderHome();
    await waitFor(() => expect(screen.getByTestId('widgets-row')).toBeInTheDocument());
    expect(screen.getByTestId('art-gallery')).toBeInTheDocument();
    expect(screen.queryByTestId('overview-3d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-fallback')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workplace-canvas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-search')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-dienste')).not.toBeInTheDocument();
    // Kein Kacheln/3D-Toggle für anonyme Besucher:innen.
    expect(screen.queryByTestId('view-toggle')).not.toBeInTheDocument();
  });

  it('renders no 3D while the auth probe is pending (no flicker)', async () => {
    // authed === null (Laden): weder Teaser noch Dashboard — die Szene darf
    // nicht aufblitzen, nur um nach dem Probe-Ergebnis zu verschwinden.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    renderHome();
    expect(screen.queryByTestId('overview-3d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-fallback')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workplace-canvas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-dienste')).not.toBeInTheDocument();
    expect(screen.queryByTestId('widgets-row')).toBeInTheDocument();
  });

  it('shows calendar and news feeds on the signed-out landing page', async () => {
    // Widgets (Wetter/News/Kalender) sind keine geschützten Dienste — sie
    // rendern für jeden Besucher, auch abgemeldet, auf der öffentlichen
    // Landing-Seite (ohne 3D-Teaser).
    renderHome();
    await waitFor(() => expect(screen.getByTestId('widgets-row')).toBeInTheDocument());
    expect(screen.getByTestId('feed-news')).toBeInTheDocument();
    expect(screen.getByTestId('feed-kalender')).toBeInTheDocument();
    // Wetter ist im Default-Config deaktiviert (kein src in dev/offline).
    expect(screen.queryByTestId('weather-widget')).not.toBeInTheDocument();
  });

  it('renders German after switching via the language picker', async () => {
    renderHome();
    fireEvent.change(screen.getByTestId('lang-switcher'), { target: { value: 'de' } });
    // Beide Texte abwarten: Untertitel (sofort sichtbar) UND „Anmelden“ — der
    // Login-Knopf mountet erst, wenn der Auth-Probe-Promise aufgelöst ist
    // (async-401-Stub); auf langsamen CI-Hillern reicht das Subtitle-Warten
    // sonst nicht aus (getByText würde zu früh ins Leere greifen).
    await waitFor(() => {
      expect(screen.getByText('Kollaborationsplattform')).toBeInTheDocument();
      expect(screen.getByText('Anmelden')).toBeInTheDocument();
    });
  });

  it('renders French and Chinese content', async () => {
    renderHome();
    fireEvent.change(screen.getByTestId('lang-switcher'), { target: { value: 'fr' } });
    await waitFor(() =>
      expect(screen.getByText('Plateforme de collaboration')).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId('lang-switcher'), { target: { value: 'zh' } });
    await waitFor(() => expect(screen.getByText('协作平台')).toBeInTheDocument());
  });

  it('keeps the document lang attribute in sync for screen readers', async () => {
    renderHome();
    await i18n.changeLanguage('fr');
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'));
  });

  it('remains free of decision level and landscape (moved to /landscape)', async () => {
    // Die Entscheiderebene lebt jetzt auf der Landscape-Seite (/landscape),
    // nicht mehr auf dem Dashboard: eingeloggte Nutzer sehen hier NUR den
    // Arbeitsplatz (Suche + Dienstkacheln), keine Entscheider-Navigation und
    // keine eingebettete 2D-Landscape.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    renderHome();
    await waitFor(() => expect(screen.getByTestId('service-search')).toBeInTheDocument());
    expect(screen.queryByTestId('decision-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-landscape')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landscape-overview')).not.toBeInTheDocument();
  });

  it('keeps the anonymous landing page free of decision nav and landscape', async () => {
    // Öffentliche Landing: Kunstgalerie statt 3D, keine
    // Entscheiderebene-Navigation und keine eingebettete 2D-Landscape.
    renderHome();
    await waitFor(() => expect(screen.getByTestId('art-gallery')).toBeInTheDocument());
    expect(screen.queryByTestId('overview-3d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decision-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-landscape')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landscape-overview')).not.toBeInTheDocument();
  });

  it('keeps the dashboard a pure workspace (no LandscapeOverview embed)', async () => {
    // Kein 2D-Landscape-Embed mehr auf der Startseite — die IT-Landschaft
    // und die Entscheiderebene sind vollständig nach /landscape umgezogen.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    renderHome();
    await waitFor(() => expect(screen.getByTestId('service-search')).toBeInTheDocument());
    expect(screen.queryByTestId('home-landscape')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landscape-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landscape-zoom')).not.toBeInTheDocument();
  });

  it('switches between tiles (default) and the 3D view for signed-in users', async () => {
    // Eingeloggte Nutzer:innen wählen zwischen Kacheln (Default, ?view=services)
    // und der 3D-Ansicht (?view=workplace) — über den Filter-Contract `view`.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    window.history.replaceState(null, '', '/');
    renderHome();
    await waitFor(() => expect(screen.getByTestId('view-toggle')).toBeInTheDocument());
    expect(screen.getByTestId('view-tiles')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('service-search')).toBeInTheDocument();
    expect(screen.queryByTestId('workplace-3d')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-3d'));
    await waitFor(() => expect(screen.getByTestId('workplace-3d')).toBeInTheDocument());
    expect(screen.getByTestId('view-3d')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('service-search')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-dienste')).not.toBeInTheDocument();
    // 3D-Interaktion bleibt: Zonen-Klick wechselt zurück zu den Kacheln.
    expect(screen.getByTestId('overview-3d')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('view-tiles'));
    await waitFor(() => expect(screen.getByTestId('service-search')).toBeInTheDocument());
    expect(screen.getByTestId('view-tiles')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('workplace-3d')).not.toBeInTheDocument();
  });

  it('opens directly in the 3D view via ?view=workplace for signed-in users', async () => {
    // Deeplink/Refresh-Stabilität: ?view=workplace reproduziert die 3D-Ansicht.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
    window.history.replaceState(null, '', '/?view=workplace');
    renderHome();
    await waitFor(() => expect(screen.getByTestId('workplace-3d')).toBeInTheDocument());
    expect(screen.getByTestId('view-3d')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('service-search')).not.toBeInTheDocument();
  });

  it('scrolls to and highlights the service tile from a ?service= deeplink', async () => {
    // T-PRS-06/07: `?service=<katalog-id>` scrollt zur Kachel und hebt sie
    // hervor; die URL bleibt unverändert teilbar (kein Rewrite beim Laden).
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, '', '/?service=sogo');
    try {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
      renderHome();
      // Kachel des Deeplink-Dienstes trägt data-service-id + Highlight-Ring …
      const tile = await waitFor(() => {
        const el = document.querySelector('[data-service-tile="sogo"]');
        expect(el).not.toBeNull();
        expect(el?.className).toContain('ring-4');
        return el as HTMLElement;
      });
      expect(tile.className).toContain('ring-blue-500');
      // … nur DER Deeplink-Dienst wird hervorgehoben.
      expect(document.querySelectorAll('.ring-4').length).toBe(1);
      // Scroll-Ziel ist die hervorgehobene Kachel (rAF-gewartet).
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      // Reset-Chip nimmt die Hervorhebung zurück (non-destructive Contract).
      expect(screen.getByTestId('filter-reset-service')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('filter-reset-service'));
      await waitFor(() =>
        expect(document.querySelector('[data-service-tile="sogo"]')?.className ?? '').not.toContain(
          'ring-4',
        ),
      );
      expect(window.location.search).not.toContain('service=sogo');
    } finally {
      window.history.replaceState(null, '', '/');
      delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  describe('dark mode', () => {
    beforeEach(() => {
      // Tooling clears localStorage; also reset the class the hook manages.
      document.documentElement.classList.remove('dark');
    });

    it('renders a theme toggle next to the language picker', async () => {
      renderHome();
      const toggle = screen.getByTestId('theme-toggle');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('toggles the dark class on <html> and persists the choice on click', async () => {
      renderHome();
      const toggle = screen.getByTestId('theme-toggle');
      fireEvent.click(toggle);
      await waitFor(() =>
        expect(document.documentElement.classList.contains('dark')).toBe(true),
      );
      expect(localStorage.getItem('portal-theme')).toBe('dark');
      expect(screen.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(screen.getByTestId('theme-toggle'));
      await waitFor(() =>
        expect(document.documentElement.classList.contains('dark')).toBe(false),
      );
      expect(localStorage.getItem('portal-theme')).toBe('light');
    });

    it('snapshots a persisted dark preference without any click', async () => {
      localStorage.setItem('portal-theme', 'dark');
      renderHome();
      await waitFor(() =>
        expect(document.documentElement.classList.contains('dark')).toBe(true),
      );
      expect(screen.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('renders the classic flat-layout sections and widgets when configured', async () => {
    // Load a config that opts into the flat placement (same shape the live
    // ConfigMap provides) and re-render.
    const { loadConfig, getConfig } = await import('../config');
    await loadConfig();
    const cur = getConfig();
    const originalWidgets = cur.widgets;
    try {
      (cur as unknown as Record<string, unknown>).layout = {
        sections: [
          // Sections platzieren echte Katalog-Ids: config.default.json ist die
          // single source, Home löst die Ids über den Katalog auf und lässt
          // unbekannte Ids entfallen — eine Section ohne Katalog-Treffer
          // rendert gar nicht (deshalb keine Phantom-Ids wie `operaton`).
          { id: 'dienste', title: 'ui.sectionServices', services: ['sogo', 'element'] },
          {
            id: 'universitaet',
            title: 'ui.sectionUniversity',
            services: ['openproject', 'xwiki'],
          },
        ],
      };
      (cur as unknown as Record<string, unknown>).widgets = {
        weather: { enabled: true, src: 'https://example.test/wetter', title: 'ui.weather' },
        news: {
          enabled: true,
          feeds: [
            { id: 'news', title: 'ui.news', path: '/news' },
            { id: 'events', title: 'ui.events', path: '/events' },
            { id: 'ub', title: 'ui.ub', path: '/ub' },
            { id: 'kalender', title: 'ui.kalender', path: '/kalender' },
          ],
        },
      };
      // Signed-in probe => header shows Abmelden → oauth2-proxy end-session.
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response));
      renderHome();
      // Sections render in configured order with the configured tiles.
      // Tiles appear only after the auth probe resolves (signed-in stub).
      await waitFor(() => expect(screen.getByTestId('section-dienste')).toBeInTheDocument());
      expect(screen.getByTestId('section-universitaet')).toBeInTheDocument();
      // Die platzierten Katalog-Dienste erscheinen als Kacheln (launchUrl aus
      // dem Katalog — Section-Platzierung und Katalog greifen ineinander).
      const dienste = screen.getByTestId('section-dienste');
      expect(dienste.querySelector('a[href="https://mail.example.org"]')).toBeInTheDocument();
      expect(dienste.querySelector('a[href="https://chat.example.org"]')).toBeInTheDocument();
      expect(
        screen.getByTestId('section-universitaet').querySelector('a[href="https://project.example.org"]'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('widgets-row')).toBeInTheDocument();
      expect(screen.getByTestId('weather-widget')).toBeInTheDocument();
      expect(screen.getByTestId('feed-news')).toBeInTheDocument();
      expect(screen.getByTestId('feed-events')).toBeInTheDocument();
      // Kalender-Tile sitzt direkt neben der UB-Kachel (Ende der Feeds-Liste).
      expect(screen.getByTestId('feed-ub')).toBeInTheDocument();
      expect(screen.getByTestId('feed-kalender')).toBeInTheDocument();
      // Header logout link points at the oauth2-proxy end-session endpoint.
      await waitFor(() =>
        expect(screen.getByText('Logout').getAttribute('href')).toBe('/oauth2/sign_out'),
      );
      // Der 3D-Arbeitsplatz ist nur per ?view=workplace erreichbar (eingeloggt
      // bleibt es im Kacheln-Default des Dashboards: keine 3D-Szene, kein
      // WebGL-SVG-Fallback).
      expect(screen.queryByTestId('overview-3d')).not.toBeInTheDocument();
      expect(screen.queryByTestId('overview-fallback')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workplace-canvas')).not.toBeInTheDocument();
      // Dafür bleiben Suche/Filter und die Kachel-Sections erhalten.
      expect(screen.getByTestId('service-search')).toBeInTheDocument();
    } finally {
      // Config-Mutation zurückrollen: getConfig() liefert das module-globale
      // DEFAULT_CONFIG-Objekt, sonst leckt die Flat-Layout-/Widget-
      // Überschreibung in nachfolgende Tests dieser Datei.
      delete (cur as unknown as Record<string, unknown>).layout;
      cur.widgets = originalWidgets;
    }
  });
});
