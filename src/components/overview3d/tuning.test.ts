// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// tuning.test.ts — Performance-/Motion-Vertrag der 3D-Szene (T-PRS-08):
//  * Pixel-Ratio: Cap 1.5 (statt 2), Degradierung bis Floor 0.75, Rücksicht
//    auf schwache Hardware (wenige Cores).
//  * Render-Loop: stoppt bei verstecktem Tab (visibilitychange) und wenn die
//    Szene den Viewport verlässt (IntersectionObserver) — hier als reine
//    Funktion prüfbar, weil jsdom kein WebGL rendert.
//  * prefers-reduced-motion: KEINE Auto-Rotation, KEIN Pulsieren/Schweben,
//    KEINE sanften Übergänge (Lerp/Fade = 0 bzw. instant).

import { describe, expect, it } from 'vitest';
import {
  PIXEL_RATIO_CAP,
  PIXEL_RATIO_FLOOR,
  DEGRADE_MIN_SAMPLES,
  MOTION_FULL,
  MOTION_REDUCED,
  autoRotateSpeed,
  averageFrameMs,
  degradePixelRatio,
  motionPrefs,
  prefersReducedMotion,
  resolvePixelRatio,
  shouldDegradeFrame,
  shouldRenderLoop,
} from './tuning';

describe('tuning — Pixel-Ratio (T-PRS-08 #7)', () => {
  it('cappt die Device-Pixel-Ratio bei 1.5 (nicht 2)', () => {
    expect(PIXEL_RATIO_CAP).toBe(1.5);
    expect(resolvePixelRatio(2)).toBe(1.5);
    expect(resolvePixelRatio(3)).toBe(1.5);
  });

  it('nimmt native DPR unter dem Cap unverändert und fällt bei 0/NaN auf 1 zurück', () => {
    expect(resolvePixelRatio(1)).toBe(1);
    expect(resolvePixelRatio(1.25)).toBe(1.25);
    expect(resolvePixelRatio(0)).toBe(1);
    expect(resolvePixelRatio(Number.NaN)).toBe(1);
  });

  it('degradiert auf schwacher Hardware (<= 4 Cores) auf max. 1.25', () => {
    expect(resolvePixelRatio(2, { cores: 4 })).toBe(1.25);
    expect(resolvePixelRatio(2, { cores: 2 })).toBe(1.25);
    expect(resolvePixelRatio(2, { cores: 8 })).toBe(1.5);
    expect(resolvePixelRatio(2, { cores: 0 })).toBe(1.5); // unbekannt -> kein Abzug
  });

  it('baelt Auto-Degradierung in 0.25-Schritten und nie unter das Floor', () => {
    expect(PIXEL_RATIO_FLOOR).toBe(0.75);
    expect(degradePixelRatio(1.5)).toBe(1.25);
    expect(degradePixelRatio(1.25)).toBe(1);
    expect(degradePixelRatio(1)).toBe(0.75);
    expect(degradePixelRatio(0.75)).toBe(0.75);
    expect(degradePixelRatio(0.5)).toBe(0.75); // nie unter Floor
  });
});

describe('tuning — Frame-Budget / Auto-Degradierung (T-PRS-08 #7/#9)', () => {
  it('degradiert erst nach genug Samples UND ueberschrittenem Budget (~20.8 ms)', () => {
    expect(shouldDegradeFrame(30, DEGRADE_MIN_SAMPLES)).toBe(true);
    expect(shouldDegradeFrame(30, DEGRADE_MIN_SAMPLES - 1)).toBe(false);
    expect(shouldDegradeFrame(16.7, 60)).toBe(false);
    expect(shouldDegradeFrame(21, 60)).toBe(true);
  });

  it('mittelt Frame-Zeiten ohne Allokation (Array-like)', () => {
    expect(averageFrameMs([10, 20, 30])).toBeCloseTo(20, 5);
    expect(averageFrameMs(new Float32Array([16, 18]))).toBeCloseTo(17, 5);
    expect(averageFrameMs([])).toBe(0);
  });
});

describe('tuning — Render-Loop-Steuerung (T-PRS-08 #8)', () => {
  it('stoppt den Loop bei verstecktem Tab (visibilitychange)', () => {
    expect(shouldRenderLoop({ pageHidden: true, inViewport: true })).toBe(false);
  });

  it('stoppt den Loop ausserhalb des Viewports (IntersectionObserver)', () => {
    expect(shouldRenderLoop({ pageHidden: false, inViewport: false })).toBe(false);
  });

  it('rendert bei sichtbarem Tab im Viewport und solange der Observer noch nichts meldete', () => {
    expect(shouldRenderLoop({ pageHidden: false, inViewport: true })).toBe(true);
    expect(shouldRenderLoop({ pageHidden: false, inViewport: null })).toBe(true);
    expect(shouldRenderLoop({})).toBe(true);
  });
});

describe('tuning — prefers-reduced-motion (T-PRS-08 #5)', () => {
  it('liest die Media Query ueber matchMedia', () => {
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false);
  });

  it('ist robust ohne matchMedia oder bei werfender Query', () => {
    expect(prefersReducedMotion({})).toBe(false);
    expect(prefersReducedMotion({ matchMedia: null })).toBe(false);
    expect(
      prefersReducedMotion({
        matchMedia: () => {
          throw new Error('no query support');
        },
      }),
    ).toBe(false);
  });

  it('schaltet bei reduzierter Bewegung ALLE sanften Effekte ab', () => {
    const reduced = motionPrefs(true);
    expect(reduced).toEqual(MOTION_REDUCED);
    expect(reduced.autoRotate).toBe(false);
    expect(reduced.floatBob).toBe(false); // kein Pulsieren/Schweben
    expect(reduced.clickRipple).toBe(false);
    expect(reduced.fadeInMs).toBe(0); // kein Fade
    expect(reduced.hoverLerp).toBe(1); // Hover-Scale instant, kein Uebergang
    expect(reduced.cameraFlight).toBe(false); // Kamerafahrt instant, kein Uebergang
    expect(reduced.cameraFlightMs).toBe(0);
    expect(autoRotateSpeed(reduced, true)).toBe(0);
    expect(autoRotateSpeed(reduced, false)).toBe(0);
  });

  it('laeuft mit voller Motion dezent rotierend — eingebettet langsamer als Vollbild', () => {
    const full = motionPrefs(false);
    expect(full).toEqual(MOTION_FULL);
    expect(full.autoRotate).toBe(true);
    expect(full.fadeInMs).toBeGreaterThan(0);
    expect(full.cameraFlight).toBe(true);
    expect(full.cameraFlightMs).toBeGreaterThan(0);
    expect(autoRotateSpeed(full, true)).toBeLessThan(autoRotateSpeed(full, false));
    expect(autoRotateSpeed(full, true)).toBeGreaterThan(0);
  });
});
