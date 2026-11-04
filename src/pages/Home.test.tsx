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
    expect(screen.getByText('Collaboration Platform')).toBeInTheDocument();
    expect(screen.getByText('Your collaborative workspace')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
    // Signed out: no service tiles and no account link anywhere.
    expect(screen.queryByTestId('section-dienste')).not.toBeInTheDocument();
    expect(document.querySelectorAll('a[href*="account"]').length).toBe(0);
    // Abgemeldet-/Landing-Ansicht: Projektübersicht (Bird's-Eye) unter dem Text.
    expect(screen.getByAltText(/Bird's-Eye/).getAttribute('src')).toBe('/brand/birdeye.webp');
  });

  it('renders German after switching via the language picker', async () => {
    renderHome();
    fireEvent.change(screen.getByTestId('lang-switcher'), { target: { value: 'de' } });
    await waitFor(() =>
      expect(screen.getByText('Kollaborationsplattform')).toBeInTheDocument(),
    );
    expect(screen.getByText('Anmelden')).toBeInTheDocument();
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
    (cur as unknown as Record<string, unknown>).layout = {
      sections: [
        { id: 'dienste', title: 'ui.sectionServices', services: ['sogo6', 'operaton'] },
        { id: 'universitaet', title: 'ui.sectionUniversity', services: ['marvin'] },
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
    // Eingeloggt: keine Projektübersicht mehr unter dem Hero (nur Landing-/Logout-Ansicht).
    expect(screen.queryByAltText(/Bird's-Eye/)).not.toBeInTheDocument();
  });
});
