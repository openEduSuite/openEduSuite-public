// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// LandscapeOverview.test.tsx — Komponententests (L1) für die 2D-Landscape
// (P-03): Schichttrennung Anwendung vs. Admin/Betrieb, keine Vermischung und
// Zoom-/Detailmodus mit vollständig lesbaren Inhalten.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { DEFAULT_CONFIG } from '../../config';
import LandscapeOverview from './LandscapeOverview';
import { ADMIN_COMPONENTS, buildApplicationZones } from './landscapeData';

const cfg = DEFAULT_CONFIG;

function renderOverview(props: Record<string, unknown> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LandscapeOverview {...props} />
    </I18nextProvider>,
  );
}

const appName = (id: string) => i18n.t(`services.${id}.name`, { defaultValue: id });
const adminName = (id: string) => i18n.t(`landscape.admin.${id}.name`);
const adminPurpose = (id: string) => i18n.t(`landscape.admin.${id}.purpose`);

/** Dienste des Anwendungs-Layers (Katalog minus Admin-beanspruchte Dienste). */
const applicationZones = buildApplicationZones(cfg);
const applicationServices = applicationZones.flatMap((z) => z.services);

describe('LandscapeOverview — 2D-Landscape mit Schichttrennung (P-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('(a) rendert zwei klar getrennte, beschriftete Layer mit Katalogzonen — ohne three.js', () => {
    const { container } = renderOverview();
    const appLayer = screen.getByTestId('landscape-layer-application');
    const adminLayer = screen.getByTestId('landscape-layer-admin');
    expect(appLayer).toBeInTheDocument();
    expect(adminLayer).toBeInTheDocument();

    // Eigene, unterschiedliche Überschriften je Layer.
    expect(screen.getByTestId('landscape-application-title').textContent).toBe(
      i18n.t('landscape.layer.application'),
    );
    expect(screen.getByTestId('landscape-admin-title').textContent).toBe(
      i18n.t('landscape.layer.admin'),
    );

    // Anwendungs-Layer: Katalogzonen bleiben erkennbar (eigenes Feld je Zone).
    for (const zone of applicationZones) {
      const zoneEl = screen.getByTestId(`landscape-zone-${zone.id}`);
      expect(zoneEl.textContent).toContain(i18n.t(zone.labelKey, { defaultValue: zone.id }));
    }

    // Bewusst 2D: kein three.js, kein Canvas.
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('(b) Admin-Elemente sind NICHT im Anwendungs-Layer — und umgekehrt', () => {
    renderOverview();
    const appLayer = screen.getByTestId('landscape-layer-application');
    const adminLayer = screen.getByTestId('landscape-layer-admin');

    // Strukturell: keine Admin-Kachel im Anwendungs-Abschnitt, kein
    // Anwendungsdienst im Admin-Abschnitt.
    expect(appLayer.querySelector('[data-admin-id]')).toBeNull();
    expect(adminLayer.querySelector('[data-service-id]')).toBeNull();

    // Inhaltlich: kein Admin-Name im Anwendungs-Layer …
    for (const comp of ADMIN_COMPONENTS) {
      expect(appLayer.textContent).not.toContain(adminName(comp.id));
    }
    // … und kein Anwendungs-Dienstname im Admin-Layer.
    for (const svc of applicationServices) {
      expect(adminLayer.textContent).not.toContain(appName(svc.id));
    }

    // Positiv: die Layer enthalten ihre eigenen Elemente.
    expect(appLayer.querySelectorAll('[data-service-id]').length).toBe(applicationServices.length);
    expect(adminLayer.querySelectorAll('[data-admin-id]').length).toBe(ADMIN_COMPONENTS.length);
  });

  it('(c) Zoom-/Detailmodus zeigt ALLE Inhalte vollständig lesbar (kein Abschneiden)', () => {
    renderOverview();
    fireEvent.click(screen.getByTestId('landscape-zoom-open'));

    const zoom = screen.getByTestId('landscape-zoom');
    expect(zoom.getAttribute('role')).toBe('dialog');

    // Jeder Anwendungsdienst-Name ist als vollständiger Textknoten vorhanden.
    for (const svc of applicationServices) {
      expect(within(zoom).getByText(appName(svc.id))).toBeInTheDocument();
    }
    // Zonenbeschriftungen vollständig lesbar.
    for (const zone of applicationZones) {
      const zoneEl = within(zoom).getByTestId(`landscape-zone-${zone.id}`);
      expect(zoneEl.textContent).toContain(i18n.t(zone.labelKey, { defaultValue: zone.id }));
    }
    // Admin-Elemente mit vollständigem Name + Zweck.
    for (const comp of ADMIN_COMPONENTS) {
      expect(within(zoom).getByText(adminName(comp.id))).toBeInTheDocument();
      expect(zoom.textContent).toContain(adminPurpose(comp.id));
    }

    // Kein Abschneiden: keine truncate/line-clamp-Klassen, stattdessen
    // scrollbare Vollfläche (overflow-y-auto) mit Zeilenumbruch (break-words).
    expect(zoom.className).toContain('overflow-y-auto');
    const clipping = [...zoom.querySelectorAll('*')].filter((el) =>
      /\btruncate\b|line-clamp/.test(el.getAttribute('class') ?? ''),
    );
    expect(clipping).toEqual([]);

    // Schließen per Button und per Escape.
    fireEvent.click(within(zoom).getByTestId('landscape-zoom-close'));
    expect(screen.queryByTestId('landscape-zoom')).toBeNull();

    fireEvent.click(screen.getByTestId('landscape-zoom-open'));
    expect(screen.getByTestId('landscape-zoom')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('landscape-zoom')).toBeNull();
  });

  it('ist embeddable (className durchgereicht) mit steuerbarem Zoom-Modus', () => {
    const onZoomChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <LandscapeOverview className="embedded-home" zoomed onZoomChange={onZoomChange} />
      </I18nextProvider>,
    );
    const root = screen.getByTestId('landscape-overview');
    expect(root.className).toContain('embedded-home');
    // Geöffneter Zustand wird durchgereicht …
    expect(screen.getByTestId('landscape-zoom')).toBeInTheDocument();
    // … und das Schließen meldet die Zustandsänderung an die einbettende Seite.
    fireEvent.click(screen.getByTestId('landscape-zoom-close'));
    expect(onZoomChange).toHaveBeenCalledWith(false);
  });

  it('i18n: Layer-Beschriftungen wechseln mit der Sprache (de/en)', async () => {
    renderOverview();
    expect(screen.getByTestId('landscape-application-title').textContent).toBe(
      'Anwendungsschicht',
    );
    expect(screen.getByTestId('landscape-admin-title').textContent).toBe('Admin-/Betriebsschicht');

    await i18n.changeLanguage('en');
    expect(screen.getByTestId('landscape-application-title').textContent).toBe('Application layer');
    expect(screen.getByTestId('landscape-admin-title').textContent).toBe(
      'Admin & operations layer',
    );
  });
});
