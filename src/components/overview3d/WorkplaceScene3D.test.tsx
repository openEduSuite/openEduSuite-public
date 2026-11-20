// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// WorkplaceScene3D.test.tsx — UI-Overlay-Verträge des 3D-«Arbeitsplatz»:
//  * Expand/Collapse-Knopf zeigt je Zustand ein unterscheidbares Glyph/Label
//    (Bug: beide Zweige zeigten '⤢') und hält aria-label/title synchron.
//  * Stabile DOM-Headline über dem Canvas — auch im Vollbild sichtbar.
//  * T-PRS-08: Ladezustand während des lazy-Loads (keine leere Fläche),
//    Fade-in der Szene (aus bei prefers-reduced-motion) und der Embedded-
//    Parameter (Vollbild rotiert dezenter als die Einbettung).
//
// drei.js selbst wird gemockt: jsdom hat kein WebGL und der Komponenten-Test
// prüft das Overlay, nicht die Renderer-Geometrie (die deckt scene.test.ts ab).

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import WorkplaceScene3D from './WorkplaceScene3D';

/** Alle von createWorkplaceScene erzeugten Handles (für Handle-Rufe wie resetView). */
const sceneInstances: Array<{
  dispose: ReturnType<typeof vi.fn>;
  setAutoRotate: ReturnType<typeof vi.fn>;
  setEmbedded: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  resetView: ReturnType<typeof vi.fn>;
  focusZone: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('./scene', () => ({
  createWorkplaceScene: vi.fn(() => {
    const handle = {
      dispose: vi.fn(),
      setAutoRotate: vi.fn(),
      setEmbedded: vi.fn(),
      resize: vi.fn(),
      resetView: vi.fn(),
      focusZone: vi.fn(),
    };
    sceneInstances.push(handle);
    return handle;
  }),
}));


function renderScene() {
  return render(
    <I18nextProvider i18n={i18n}>
      <WorkplaceScene3D />
    </I18nextProvider>,
  );
}

describe('WorkplaceScene3D — Overlay (T-PRS-04)', () => {
  beforeEach(async () => {
    sceneInstances.length = 0;
    await i18n.changeLanguage('en');
  });

  it('rendert eine stabile DOM-Headline über dem Canvas (lokalisierbar)', () => {
    renderScene();
    const headline = screen.getByTestId('workplace-headline');
    expect(headline).toBeInTheDocument();
    expect(headline.tagName).toBe('H2');
    expect(headline).toHaveTextContent('The digital workplace');
    // «Über dem Canvas»: die Headline steht im DOM vor dem Canvas-Mount und
    // liegt damit nicht hinter dem (absolute inset-0) Canvas-Element.
    const canvas = screen.getByTestId('workplace-canvas');
    expect(
      headline.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('zeigt die Headline deutsch, wenn die Sprache umgeschaltet wird', async () => {
    renderScene();
    await i18n.changeLanguage('de');
    expect(screen.getByTestId('workplace-headline')).toHaveTextContent(
      'Der digitale Arbeitsplatz',
    );
  });

  it('zeigt im eingebetteten Zustand das Expand-Glyph/Label (⤢ / Enlarge)', () => {
    renderScene();
    const btn = screen.getByRole('button', { name: 'Enlarge' });
    expect(btn).toHaveAttribute('title', 'Enlarge');
    expect(btn).toHaveAttribute('aria-label', 'Enlarge');
    expect(btn.textContent).toContain('⤢');
    expect(btn.textContent).not.toContain('⤡');
  });

  it('wechselt nach dem Klick auf ein unterscheidbares Collapse-Glyph/Label', () => {
    renderScene();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge' }));
    const btn = screen.getByRole('button', { name: 'Shrink' });
    expect(btn).toHaveAttribute('title', 'Shrink');
    expect(btn).toHaveAttribute('aria-label', 'Shrink');
    // Beide Zustände müssen sich in Glyph UND Label unterscheiden.
    expect(btn.textContent).toContain('⤡');
    expect(btn.textContent).not.toContain('⤢');
  });

  it('bleibt im Vollbild headline-sichtbar', () => {
    renderScene();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge' }));
    const headline = screen.getByTestId('workplace-headline');
    expect(headline).toBeInTheDocument();
    expect(headline).toHaveTextContent('The digital workplace');
    // Vollbild-Overlay über der ganzen Seite, Canvas bleibt gemountet.
    expect(screen.getByTestId('workplace-canvas')).toBeInTheDocument();
  });

  it('nutzt deutsche Knopf-Labels nach Sprachwechsel', async () => {
    renderScene();
    await i18n.changeLanguage('de');
    expect(screen.getByRole('button', { name: 'Vergrößern' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    expect(screen.getByRole('button', { name: 'Verkleinern' })).toBeInTheDocument();
  });

  it('bietet einen «Zur Übersicht»-Knopf, der die Kamera zurücksetzt', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    expect(sceneInstances.length).toBeGreaterThan(0);
    const btn = screen.getByRole('button', { name: 'Reset view' });
    expect(btn).toHaveAttribute('title', 'Reset view');
    expect(btn).toHaveAttribute('aria-label', 'Reset view');
    fireEvent.click(btn);
    expect(sceneInstances[sceneInstances.length - 1]?.resetView).toHaveBeenCalledTimes(1);
  });

  it('gibt dem Arbeitsplatz mehr Raum: größere eingebettete Höhe, randloses Vollbild', () => {
    const { container } = renderScene();
    const root = container.firstElementChild as HTMLElement;
    // Eingebettet: größer als zuvor (h-[340px] md:h-[440px] ist Geschichte).
    expect(root.className).toContain('h-[420px]');
    expect(root.className).toContain('md:h-[560px]');
    expect(root.className).not.toContain('h-[340px]');
    // Vollbild: randlos + bildschirmfüllend; zurück kehrt die eingebettete Höhe.
    fireEvent.click(screen.getByTestId('workplace-toggle'));
    expect(root.className).toContain('fixed inset-0');
    expect(root.className).toContain('rounded-none');
    // Regression: `relative` DARF im Vollbild nicht mehr aktiv sein — `.relative`
    // steht im erzeugten CSS nach `.fixed` und würde position auf relative
    // setzen, die Höhe auf 0 kollabieren lassen und die Szene verschwinden.
    expect(root.className).not.toContain('relative');
    fireEvent.click(screen.getByTestId('workplace-toggle'));
    expect(root.className).toContain('h-[420px]');
  });

  it('überreicht lokalisierte Werkzeugnamen (services.<id>.name statt roher Id)', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    const zonesArg = sceneMock.mock.lastCall?.[1] as { id: string; tools: { id: string; name: string }[] }[] | undefined;
    expect(zonesArg).toBeDefined();
    const identityTools = zonesArg!.find((z) => z.id === 'identity')?.tools ?? [];
    // Keycloak hat einen services.keycloak.name-Eintrag („Keycloak SSO“) — die
    // Szene bekommt den lokalisierten Namen, nicht die rohe Id.
    const kc = identityTools.find((t) => t.id === 'keycloak');
    expect(kc).toBeDefined();
    expect(kc!.name).not.toBe('🔐 keycloak');
    expect(kc!.name).toContain('Keycloak SSO');
  });

  it('lokalisiert Staff-Tool-Namen beim Sprachwechsel (services.<id>.name)', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    const staffFirst = (() => {
      const opts = sceneMock.mock.lastCall?.[3] as { staff: { tools: { name: string }[] } | null } | undefined;
      return opts?.staff?.tools[0]?.name;
    })();
    expect(staffFirst).toBeDefined();
    expect(staffFirst).not.toContain('staff.'); // kein roher Key ohne Übersetzung
    await i18n.changeLanguage('de');
    await waitFor(() => expect(sceneMock.mock.calls.length).toBeGreaterThan(1));
    const staffSecond = (() => {
      const opts = sceneMock.mock.lastCall?.[3] as { staff: { tools: { name: string }[] } | null } | undefined;
      return opts?.staff?.tools[0]?.name;
    })();
    expect(staffSecond).toBeDefined();
    await i18n.changeLanguage('en'); // Test-Suite bleibt auf en.
  });
});

// --- T-PRS-08: Ladezustand, Fade-in, Embedded-Rotation ----------------------
import { createWorkplaceScene } from './scene';

const sceneMock = vi.mocked(createWorkplaceScene);

/** jsdom kennt kein matchMedia — hier gezielt für reduced-motion Tests setzen. */
function stubMatchMedia(matches: boolean) {
  const mm = vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('matchMedia', mm);
  return mm;
}

describe('WorkplaceScene3D — Ladezustand & Fade-in (T-PRS-08)', () => {
  beforeEach(async () => {
    sceneMock.mockClear();
    await i18n.changeLanguage('en');
  });

  it('zeigt waehrend des lazy-Loads einen Ladeindikator statt einer leeren Flaeche', () => {
    renderScene();
    // Der dynamische Import ist im ersten (synchronen) Render noch nicht
    // aufgeloest — genau dann darf keine leere Flaeche stehen.
    expect(screen.getByTestId('workplace-loading')).toBeInTheDocument();
    // Der Canvas-Mount bleibt die ganze Zeit im DOM (kein Flackern/Reflow).
    expect(screen.getByTestId('workplace-canvas')).toBeInTheDocument();
  });

  it('nimmt den Ladeindikator zurueck, sobald die Szene bereit ist', async () => {
    renderScene();
    await waitFor(() => expect(screen.queryByTestId('workplace-loading')).toBeNull());
    expect(sceneMock).toHaveBeenCalled();
  });

  it('blendet die fertige Szene sanft ein (opacity + transition)', async () => {
    renderScene();
    const mount = screen.getByTestId('workplace-canvas');
    expect(mount.className).toContain('opacity-0');
    await waitFor(() => expect(mount.className).toContain('opacity-100'));
    expect(mount.className).toContain('transition-opacity');
  });

  it('verzichtet bei prefers-reduced-motion auf Fade/Transition', async () => {
    stubMatchMedia(true);
    try {
      renderScene();
      const mount = screen.getByTestId('workplace-canvas');
      await waitFor(() => expect(mount.className).toContain('opacity-100'));
      expect(mount.className).not.toContain('transition-opacity');
      expect(mount.className).not.toContain('duration-');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('baut die Szene eingebettet mit dezentem Rotationstempo (embedded: true)', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    expect(sceneMock.mock.lastCall?.[3]).toMatchObject({ embedded: true });
    // Zwei Kreise: Staff-Zone wird an die Szene gereicht (innerer Kreis).
    const staff = sceneMock.mock.lastCall?.[3]?.staff;
    expect(staff).toBeDefined();
    expect(staff!.id).toEqual('staff');
    expect(staff!.tools.length).toBeGreaterThan(0);
  });

  it('überreicht lokalisierte Werkzeugnamen (services.<id>.name statt roher Id)', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    const zonesArg = sceneMock.mock.lastCall?.[1] as { id: string; tools: { id: string; name: string }[] }[] | undefined;
    expect(zonesArg).toBeDefined();
    const identityTools = zonesArg!.find((z) => z.id === 'identity')?.tools ?? [];
    // Keycloak hat einen services.keycloak.name-Eintrag („Keycloak SSO“) — die
    // Szene bekommt den lokalisierten Namen, nicht die rohe Id.
    const kc = identityTools.find((t) => t.id === 'keycloak');
    expect(kc).toBeDefined();
    expect(kc!.name).not.toBe('🔐 keycloak');
    expect(kc!.name).toContain('Keycloak SSO');
  });

  it('lokalisiert Staff-Tool-Namen beim Sprachwechsel (services.<id>.name)', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    const staffFirst = (() => {
      const { staff } = sceneMock.mock.lastCall?.[3] as { staff: { tools: { name: string }[] } | null };
      return staff?.tools[0]?.name;
    })();
    expect(staffFirst).toBeDefined();
    await i18n.changeLanguage('de');
    await waitFor(() => expect(sceneMock.mock.calls.length).toBeGreaterThan(1));
    const staffSecond = (() => {
      const { staff } = sceneMock.mock.lastCall?.[3] as { staff: { tools: { name: string }[] } | null };
      return staff?.tools[0]?.name;
    })();
    expect(staffSecond).toBeDefined();
    await i18n.changeLanguage('en'); // Test-Suite bleibt auf en.
  });

  it('wechselt im Vollbild das Rotationstempo OHNE die Szene neu zu bauen (Optimierung)', async () => {
    renderScene();
    await waitFor(() => expect(sceneMock).toHaveBeenCalled());
    expect(sceneMock.mock.calls.length).toBe(1);
    const handle = sceneInstances[sceneInstances.length - 1];
    expect(handle).toBeDefined();
    // Sync ab hier: nur noch setEmbedded-Rufe auf dem bereits gebauten Handle.
    handle.setEmbedded.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Enlarge' }));
    // Kein Neuaufbau: weiterhin genau EIN createWorkplaceScene-Aufruf.
    expect(sceneMock.mock.calls.length).toBe(1);
    // Stattdessen: Rotationstempo-Wechsel auf das Vollbild-Profil (embedded: false).
    expect(handle.setEmbedded).toHaveBeenCalledWith(false);

    // Zurück in die Einbettung — wieder nur Tempo-Wechsel, kein Rebuild.
    fireEvent.click(screen.getByRole('button', { name: 'Shrink' }));
    expect(sceneMock.mock.calls.length).toBe(1);
    expect(handle.setEmbedded).toHaveBeenCalledWith(true);
    // Kein Lade-Flash: Indikator blieb die ganze Zeit verschwunden.
    expect(screen.queryByTestId('workplace-loading')).toBeNull();
    expect(screen.getByTestId('workplace-canvas')).toBeInTheDocument();
  });
});
