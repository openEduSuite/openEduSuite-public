// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// LandscapePage.test.tsx — Test der Landscape-SEITE (/landscape, P-03).
// Liegt bewusst im Landscape-Testordner (alle Landscape-Tests an einem Ort):
// die Seite bettet die embeddable LandscapeOverview ein und bietet den
// Zoom-/Detailmodus; der Route-Pfad wird als Konstante exportiert
// (App.tsx-Verdrahtung erfolgt in T-PRS-07).

import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import Landscape, { LANDSCAPE_PATH } from '../../pages/Landscape';

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Landscape />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Landscape-Seite (/landscape, P-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('exportiert den Route-Pfad /landscape und rendert die Seite mit Überschrift', () => {
    expect(LANDSCAPE_PATH).toBe('/landscape');
    renderPage();
    expect(screen.getByTestId('landscape-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      i18n.t('landscape.page.title'),
    );
  });

  it('bettet die LandscapeOverview ein: beide Schichten getrennt, Zoom erreichbar', () => {
    renderPage();
    expect(screen.getByTestId('landscape-overview')).toBeInTheDocument();
    expect(screen.getByTestId('landscape-layer-application')).toBeInTheDocument();
    expect(screen.getByTestId('landscape-layer-admin')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('landscape-zoom-open'));
    expect(screen.getByTestId('landscape-zoom')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('landscape-zoom-close'));
    expect(screen.queryByTestId('landscape-zoom')).toBeNull();
  });

  it('beherbergt die Entscheiderebene (Integrationen, Writer, self — ohne Vergleich)', () => {
    // Die Entscheider-Navigation ist vom Dashboard hierher umgezogen: Die
    // Landscape-Seite ist der zentrale Einstieg der Entscheiderebene. Der
    // Vergleich lebt bewusst NICHT hier — er ist eine eigene Seite der
    // Marketing-Präsenz (example.org/vergleich, „andere digitale
    // Arbeitsplatz-Lösungen").
    renderPage();
    expect(screen.getByTestId('decision-nav')).toBeInTheDocument();
    expect(screen.getByTestId('nav-landscape')).toHaveAttribute('href', LANDSCAPE_PATH);
    expect(screen.getByTestId('nav-integrationen')).toHaveAttribute('href', '/integrationen');
    expect(screen.getByTestId('nav-writer')).toHaveAttribute('href', '/writer');
    expect(screen.queryByTestId('nav-vergleich')).not.toBeInTheDocument();
    // Kein 3D auf der 2D-Landscape-Seite (P-03-Vertrag).
    expect(screen.queryByTestId('overview-3d')).not.toBeInTheDocument();
  });
});
