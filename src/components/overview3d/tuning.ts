// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// tuning.ts — pure, WebGL-freie Steuerungslogik der 3D-Szene (T-PRS-08).
//
// Alles, was Performance (Pixel-Ratio, Frame-Budget, Render-Loop-Pause) und
// Bewegung (reduced-motion, Auto-Rotation, Fade) betrifft, ist hier als
// reine Funktion definiert: so bleibt es in jsdom (ohne WebGL) deterministisch
// testbar — scene.ts zieht die Werte nur noch in Renderer/Loop/Controls ein.

// --- Performance: Pixel-Ratio (#7) ------------------------------------------
/** Cap für die Device-Pixel-Ratio: 1.5 statt 2 — 4K-Retina-Rendern bringt auf
 *  dieser Szene kaum Sichtgewinn, kostet aber ~78 % mehr Fragmente. */
export const PIXEL_RATIO_CAP = 1.5;
/** Untergrenze nach Auto-Degradierung — darunter wird die Schrift unlesbar. */
export const PIXEL_RATIO_FLOOR = 0.75;
/** Schwache Hardware (<= 4 Cores) startet gleich einen Schritt tiefer. */
export const WEAK_CORES_MAX = 4;
export const WEAK_CORES_RATIO = 1.25;

/**
 * Start-Pixel-Ratio: native DPR, gedeckelt auf PIXEL_RATIO_CAP; auf Geräten
 * mit wenigen Cores zusätzlich auf WEAK_CORES_RATIO reduziert.
 */
export function resolvePixelRatio(devicePixelRatio: number, opts: { cores?: number } = {}): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  let ratio = Math.min(Math.max(dpr, 1), PIXEL_RATIO_CAP);
  const cores = opts.cores;
  if (typeof cores === 'number' && Number.isFinite(cores) && cores > 0 && cores <= WEAK_CORES_MAX) {
    ratio = Math.min(ratio, WEAK_CORES_RATIO);
  }
  return ratio;
}

/** Auto-Degradierung in 0.25-Schritten, nie unter das Floor. */
export function degradePixelRatio(current: number, step = 0.25): number {
  const next = Math.round((current - step) * 100) / 100;
  return Math.max(PIXEL_RATIO_FLOOR, Math.min(next, PIXEL_RATIO_CAP));
}

// --- Performance: Frame-Budget (#9) -----------------------------------------
export const FRAME_BUDGET_MS = 1000 / 60; // ~16.7 ms Ziel-Frametime
/** Degradieren erst ab ~25 % über Budget (Puffer für einzelne Ausreißer). */
export const DEGRADE_THRESHOLD_MS = FRAME_BUDGET_MS * 1.25; // ~20.8 ms
/** Mindest-Samples, bevor über Degradierung entschieden wird. */
export const DEGRADE_MIN_SAMPLES = 30;

/** Mittelwert über Array-likes (Float32Array-Ringpuffer) — ohne Allokation. */
export function averageFrameMs(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i];
  return sum / n;
}

/** true, wenn genug Frames gemessen wurden UND das Budget überschritten ist. */
export function shouldDegradeFrame(avgFrameMs: number, sampleCount: number): boolean {
  return sampleCount >= DEGRADE_MIN_SAMPLES && avgFrameMs > DEGRADE_THRESHOLD_MS;
}

// --- Performance: Render-Loop nur wenn nötig (#8) ---------------------------
export interface RenderSchedulingState {
  /** Tab versteckt (document.visibilityState === 'hidden'). */
  pageHidden?: boolean;
  /** IntersectionObserver: Szene im Viewport? null/undefined = noch unbekannt. */
  inViewport?: boolean | null;
}

/**
 * Läuft der Loop?false bei verstecktem Tab oder außerhalb des Viewports —
 * der rAF wird dann komplett gestoppt (0 % GPU im Hintergrund).
 */
export function shouldRenderLoop(state: RenderSchedulingState): boolean {
  if (state.pageHidden === true) return false;
  if (state.inViewport === false) return false;
  return true;
}

// --- Bewegung: prefers-reduced-motion (#5) ----------------------------------
type MatchMediaLike = { matchMedia?: ((query: string) => { matches: boolean }) | null };

/** true, wenn die Nutzer:in reduzierte Bewegung bevorzugt (robust ohne API). */
export function prefersReducedMotion(win?: MatchMediaLike): boolean {
  const w: MatchMediaLike | undefined = win ?? (typeof window !== 'undefined' ? window : undefined);
  const mm = w?.matchMedia;
  if (typeof mm !== 'function') return false;
  try {
    return !!mm('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface MotionPrefs {
  /** Dezente Auto-Rotation beim Start (abschaltbar per Interaktion). */
  autoRotate: boolean;
  /** Auto-Rotations-Tempo im Vollbild. */
  autoRotateSpeedFullscreen: number;
  /** Eingebettete Ansicht rotiert dezenter als das Vollbild. */
  autoRotateSpeedEmbedded: number;
  /** OrbitControls-Damping (1 = instant, kein sanfter Übergang). */
  damping: number;
  /** Hover-Scale-Lerp pro Frame (1 = instant, kein sanfter Übergang). */
  hoverLerp: number;
  /** Sanftes Schweben/Pulsieren der Tool-Objekte. */
  floatBob: boolean;
  /** Kurzer Ripple/Glow nach Klick auf ein pickbares Element. */
  clickRipple: boolean;
  /** Fade-in der Szene in ms (0 = sofort, kein Übergang). */
  fadeInMs: number;
  /** Sanfte Kamerafahrt bei Zone/Übersicht (reduced: instant snap). */
  cameraFlight: boolean;
  /** Dauer der Kamerafahrt in ms (0 = kein Übergang). */
  cameraFlightMs: number;
}

/** Volle Motion — dezent, lebendig, aber ruhig. */
export const MOTION_FULL: MotionPrefs = {
  autoRotate: true,
  autoRotateSpeedFullscreen: 0.45,
  autoRotateSpeedEmbedded: 0.22,
  damping: 0.08,
  hoverLerp: 0.18,
  floatBob: true,
  clickRipple: true,
  fadeInMs: 650,
  cameraFlight: true,
  cameraFlightMs: 750,
};

/** Reduced motion: KEINE Auto-Rotation, KEIN Pulsieren, KEINE Übergänge. */
export const MOTION_REDUCED: MotionPrefs = {
  autoRotate: false,
  autoRotateSpeedFullscreen: 0,
  autoRotateSpeedEmbedded: 0,
  damping: 1,
  hoverLerp: 1,
  floatBob: false,
  clickRipple: false,
  fadeInMs: 0,
  cameraFlight: false,
  cameraFlightMs: 0,
};

export function motionPrefs(reduced: boolean): MotionPrefs {
  return reduced ? MOTION_REDUCED : MOTION_FULL;
}

/** Effektives Auto-Rotations-Tempo je Ansichtsmodus (0 = aus). */
export function autoRotateSpeed(prefs: MotionPrefs, embedded: boolean): number {
  if (!prefs.autoRotate) return 0;
  return embedded ? prefs.autoRotateSpeedEmbedded : prefs.autoRotateSpeedFullscreen;
}
