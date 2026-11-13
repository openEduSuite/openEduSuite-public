// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// scene.ts — der interaktive 3D-Raum «Der digitale Arbeitsplatz».
//
// Bau-Muster nach den chemie-Lernlaboren (chemie-lernen.org periodic-table-
// rooms): Halle mit goldenem Schnitt, Gitterboden, zentrales Monument auf dem
// Fokuspunkt, Kategorie-«Stationen» auf einem Ring, Galerie-Beschriftung an
// der Rückwand, freie Orbit-Kamera mit Raycasting. Statt Atomen stehen hier
// die Werkzeuge der openEduSuite: jedes Tool ist ein 3D-Primitiv auf einem
// Sockel in der Farbe seiner Zone. Klick auf ein Tool öffnet den Dienst,
// Klick auf eine Zonen-Station setzt den Deeplink-Filter (Strom F).
//
// Die Szene ist komplett aus config-Daten aufgebaut — ein neues Tool braucht
// nur einen Eintrag in config.json, kein neues 3D-Asset (Primitive + Labels).
//
// Neuer Auftrag — zwei Kreise + Themen-Räume:
//  * User-Kreis (äußerer Ring, ZONE_R): die Katalog-Kategorien (Themen) mit
//    ihren Stationen/Tools — jede Kategorie bewohnt ihren eigenen «Raum»
//    (Sektor-Bucht): zwei radiale Trennwände an den Sektorgrenzen (Beginn
//    ROOM_INNER außerhalb aller Tool-Fächer bis zur Raumhülle) plus ein
//    dezenter Boden-Teppich in Zonenfarbe (Ring-Segment, ROOM_CARPET).
//  * Staff-Kreis (innerer Ring, STAFF_R): die Verwaltungs-/Staff-Apps stehen
//    separat hinter dem Zentralmonument (STAFF_ANGLE = -90°) — eine Station
//    («Verwaltung & Support») mit Tools im Fächer bei STAFF_TOOL_R davor,
//    abgesetzt durch einen Bodenring in Staff-Farbe (STAFF_META #f59e0b).
//    Klick auf ein Staff-Tool öffnet den Dienst; die Station selbst liefert
//    nur Feedback (kein Deeplink-Filter, id 'staff' existiert im Katalog
//    nicht als Zone).
//
// T-PRS-08 — Grafik + Performance (ohne das Bau-Muster zu brechen):
//  * Licht: Hemisphärenlicht + gerichtetes Keylight mit weichen Schatten auf
//    wenigen Objekten (Monument, Stations-Sockel), ACESFilmic-Tonemapping und
//    ein prozeduraler Hintergrund-Verlauf (Canvas-Gradient statt hartem Schnitt).
//  * Materialien: PBR-Werte je Tool-Kind, Stations-Glowring + Grundplatte,
//    Labels via makeTextSprite überabtastet (schärfer, Halo, Anisotropie).
//  * Bewegung: sanfter Hover-Scale (Lerp), Klick-Ripple, Fade-in beim Start,
//    dezente Auto-Rotation (eingebettet langsamer) — alles AUS bei
//    prefers-reduced-motion.
//  * Performance: Pixel-Ratio-Cap 1.5 mit Auto-Degradierung bei Last,
//    Render-Loop stoppt bei verstecktem Tab (visibilitychange) und außerhalb
//    des Viewports (IntersectionObserver), Rendern nur bei Änderung,
//    Raycasting gedrosselt und nur über Pickables, Frustum-Culling bleibt
//    aktiv (three-Standard), shared Geometrien/Materialien, keine Allokationen
//    im Frame-Hot-Path, vollständiges dispose.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LABEL_SUPERSAMPLE, makeIconSprite, makeTextSprite } from './sprite';
import {
  PIXEL_RATIO_CAP,
  PIXEL_RATIO_FLOOR,
  autoRotateSpeed,
  averageFrameMs,
  degradePixelRatio,
  motionPrefs,
  prefersReducedMotion,
  resolvePixelRatio,
  shouldDegradeFrame,
  shouldRenderLoop,
  type MotionPrefs,
} from './tuning';

export interface SceneTool {
  id: string;
  name: string;
  zoneId: string;
  zoneColor: string;
  launchUrl: string;
}

export interface SceneZone {
  id: string;
  label: string;
  icon: string;
  color: string;
  tools: SceneTool[];
}

export interface SceneCallbacks {
  onSelectTool?: (tool: SceneTool) => void;
  onSelectZone?: (zone: SceneZone) => void;
  onHover?: (fragment: { kind: 'tool' | 'zone' | 'monument'; text: string; color: string } | null) => void;
}

export interface WorkplaceSceneHandle {
  dispose(): void;
  setAutoRotate(v: boolean): void;
  resize(): void;
  /** Sanfte Kamerafahrt zurück zur Gesamtübersicht (reduced motion: sofort). */
  resetView(): void;
  /** Sanfte Kamerafahrt zur Station der Zone `zoneId` (Katalog-Id). */
  focusZone(zoneId: string): void;
}

/** Optionen für den Ansichtsmodus (T-PRS-08): eingebettet rotiert dezenter. */
export interface CreateSceneOptions {
  /** true = kleine eingebettete Vorschau (schwächere Auto-Rotation). */
  embedded?: boolean;
  /**
   * Staff-/Admin-Kreis (innerer Ring): die Staff-Apps stehen in ihrem eigenen
   * Kreis hinter dem Zentralmonument, getrennt vom User-Kreis (Themen-Räume).
   */
  staff?: SceneZone | null;
  /** Label des pickbaren Zentralmonuments (reduziert für Hover-Tooltip). */
  monumentLabel?: string;
}

// --- Raum-Maße (goldener Schnitt, gedämpft für Einbettung) ------------------
const PHI = 1.6180339887;
const W = 34;
const D = 30;
const H = PHI * 7; // ~11.3 — menschlicher Maßstab
// Hintergrund-Verlauf (prozedural, kein Asset): oben leicht aufgehelltes
// Blau, unten bodennah dunkel. Der Fog trägt die Mitte-Farbe, damit der Nebel
// weich in den Verlauf läuft statt einer harten Kante.
const BG_TOP = '#101d3a';
const BG_MID = 0x0a1120;
const BG_BOTTOM = '#05080f';

// Akademie-Symbolik als dezenter Hintergrund (identisch zur Website-Hero,
// public/brand/academia.svg: Buch, Doktorhut, Feder, Lorbeer). Die SVG wird
// als Kachel über den Verlauf gelegt — ähnlich dem Website-Teaser (~0.07
// Deckkraft), vertikal ausgedünnt (oben/unten zurückhaltender, Mitte am
// sichtbarsten). Laden ist asynchron; scheitert es, bleibt der Verlauf.
const ACADEMIA_PATH = '/brand/academia.svg';
const ACADEMIA_TILE = 233; // Kantenlänge des SVG-Kachel-Motivs (Website-Format)
export const ACADEMIA_OPACITY = 0.22;
// Vertikales Ausblend-Profil: oben (Ferne) am dezentesten, Mitte am
// sichtbarsten, unten bodennah leicht gedämpft — wie der Fade der Website.
const ACADEMIA_PROFILE = [0.3, 1, 0.6];

/** Deckkraft pro Kachel-Reihe (vertikales Ausblend-Profil der Akademie-Textur). */
export function academiaRowAlpha(rowIndex: number): number {
  return ACADEMIA_OPACITY * (ACADEMIA_PROFILE[rowIndex] ?? 0.5);
}

// T-PRS-04: großzügigere Abstände — Stationen und Tools dürfen sich nicht
// ineinander schieben (ZONE_R 9.2 -> 11, TOOL_R 5.6 -> 6.6, TOOL_SPAN
// 0.62 -> 0.8), der Raum wächst mit, damit die Stationen Wandfreiheit behalten.
const ZONE_R = 11; // Ring-Radius der Zonen-Stationen
const TOOL_R = 6.6; // Ring-Radius der Tool-Objekte (zwischen Zentrum u. Station)
const TOOL_SPAN = 0.8; // Winkel-Halbbreite des Tool-Fächers je Zone
const TOOL_GAP = 1.5; // Mindest-Abstand zwischen zwei Tool-Zentren
const FAN_MARGIN = 0.08; // Winkel-Freiraum zwischen Nachbar-Fächern
const TOOL_CLEAR = 0.7; // Freiraum zwischen Tool-Fächer und Stations-Bodenring
const STATION_RING_R = 1.65; // Außenradius des Stationen-Bodenrings
const STATION_LABEL_Y = 3.15;
const STATION_LABEL_TOP_Y = 3.4; // Label-Oberkante (für Kamera-Framing)

// Standardkamera: rahmt den erweiterten Ring (inkl. Labels) auch in schmalen
// Aspect-Ratios vollständig ein (Beweis: scene.test.ts projiziert den Ring).
const CAM_FOV = 55;
const CAM_POS: [number, number, number] = [0, 13, 29];
const CAM_LOOK: [number, number, number] = [0, 2, 0];
const CAM_MAX_DIST = 60;
const CAM_FAR = 200;
// Nebel beginnt erst hinter der Rückwand-Beschriftung, damit der In-Szene-Titel
// nicht ausgelöscht wird (Distanz Kamera -> Titel ≈ 44).
const FOG_NEAR = 52;
const FOG_FAR = 130;
// Galerie-Beschriftung an der Rückwand (leicht vor der Wand, keine Verdeckung).
const TITLE_Y = H - 2.1;
const TITLE_Z = -D / 2 + 0.25;

// --- Staff-/Admin-Kreis (innerer Ring) -------------------------------------
// Die Verwaltungs-Apps stehen hinter dem Zentralmonument (Winkel -90° =
// Rückseite) auf einem eigenen, kleineren Ring: Station bei STAFF_R, Tools im
// Fächer bei STAFF_TOOL_R davor Richtung Desk. STAFF_ANGLE liegt auf der
// Achse der Identity-Zone (hinten); da Staff-Objekte viel näher am Zentrum
// liegen als jeder User-Tool (>= TOOL_R), kollidieren die Kreise nie.
const STAFF_R = 4.6; // Ring-Radius der Staff-Station
const STAFF_TOOL_R = 2.6; // Ring-Radius der Staff-Tools (zwischen Desk u. Station)
const STAFF_ANGLE = -Math.PI / 2; // Rückseite (hinter dem Desk)
const STAFF_SPAN = 0.45; // Winkel-Halbbreite des Staff-Tool-Fächers
const STAFF_LABEL_Y = 2.6; // Label-Höhe der Staff-Station

// --- Themen-Räume (Sektor-Buchten entlang der Außenwand) -------------------
// Jedes Themen-Zimmer (Kategorie) ist eine Bucht: zwei radiale Trennwände an
// den Sektorgrenzen (Beginn ROOM_INNER, reichen bis zur Raumhülle) schließen
// die Station samt Tools ein; ein dezenter Boden-Teppich in Zonenfarbe markiert
// den Raum. ROOM_INNER liegt AUßERHALB jedes Tool-Fächers (max TOOL_R-8.65),
// damit keine Wand ein Tool berührt — der Staff-Kreis (radius 4.6) bleibt im
// freien Innenhof vor den Wänden.
const ROOM_INNER = 9.6; // innerer Start der Trennwände
// Wandhöhe: absichtlich niedrig — UNTERHALB der Stations-Icon-Unterkante
// (Icon-Zentrum 2.15, Halbhöhe 84*0.02/2=0.84 => Unterkante 1.31). Damit
// kämmen sich die schwebenden Icons/Labels nie mit den Trennwänden („Pillars") —
// vorher (3.2) verschluckte die Wand die untere Icon-Hälfte, sobald eine
// Station nahe einer Sektorgrenze stand. Tools stehen bei TOOL_R=6.6 und damit
// ohnehin innerhalb von ROOM_INNER, also außerhalb des Wandbands.
const ROOM_H = 1.25; // Wandhöhe (niedrig, Sicht bleibt offen)
const ROOM_T = 0.14; // Wandstärke
const ROOM_CARPET_OPACITY = 0.06; // Boden-Teppich-Deckkraft (dezente Akzente)

/**
 * Reine Raum-Geometrie (T-PRS-04) — exportiert für Tests: die Abstände und die
 * Kamera-Framing-Annahmen lassen sich so ohne WebGL deterministisch prüfen.
 */
export const SCENE_METRICS = {
  room: { width: W, depth: D, height: H },
  layout: {
    zoneRadius: ZONE_R,
    toolRadius: TOOL_R,
    toolSpan: TOOL_SPAN,
    toolGap: TOOL_GAP,
    stationRingRadius: STATION_RING_R,
  },
  staff: {
    radius: STAFF_R,
    toolRadius: STAFF_TOOL_R,
    angle: STAFF_ANGLE,
    toolSpan: STAFF_SPAN,
  },
  rooms: {
    innerRadius: ROOM_INNER,
    wallHeight: ROOM_H,
    wallThickness: ROOM_T,
  },
  camera: {
    fov: CAM_FOV,
    position: CAM_POS,
    lookAt: CAM_LOOK,
    maxDistance: CAM_MAX_DIST,
    far: CAM_FAR,
  },
  fog: { near: FOG_NEAR, far: FOG_FAR },
  title: { y: TITLE_Y, z: TITLE_Z },
  labelTopY: STATION_LABEL_TOP_Y,
} as const;

/**
 * Qualität-/Performance-Vertrag (T-PRS-08) — exportiert für Assertions:
 * Tonemapping, Pixel-Ratio-Cap und Schatten-Budget sind hier greifbar, auch
 * wenn das Rendering selbst nur manuell verifizierbar ist.
 */
export const SCENE_QUALITY = {
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.08,
  pixelRatioCap: PIXEL_RATIO_CAP,
  pixelRatioFloor: PIXEL_RATIO_FLOOR,
  shadowMapSize: 1024,
  /** Schatten werfen nur Monument + Stations-Sockel (nicht alle Meshes). */
  shadowCasters: 'monument+plinths',
  labelSupersample: LABEL_SUPERSAMPLE,
} as const;

/**
 * PBR-Presets je Tool-Kind (Index wie buildToolShape): gleiche Zone-Farbe,
 * aber unterschiedliche Materialwirkung — matt (Box), kristallin (Oktaeder),
 * edelsteinartig (Ikosaeder), metallisch (Torus/Zylinder) usw.
 */
export const TOOL_MATERIAL_PRESETS = [
  { metalness: 0.2, roughness: 0.42, emissiveIntensity: 0.3 }, // Box
  { metalness: 0.55, roughness: 0.22, emissiveIntensity: 0.22 }, // Oktaeder
  { metalness: 0.78, roughness: 0.16, emissiveIntensity: 0.18 }, // Ikosaeder
  { metalness: 0.42, roughness: 0.28, emissiveIntensity: 0.26 }, // Torus
  { metalness: 0.15, roughness: 0.5, emissiveIntensity: 0.34 }, // Kegel
  { metalness: 0.5, roughness: 0.38, emissiveIntensity: 0.2 }, // Zylinder
  { metalness: 0.12, roughness: 0.45, emissiveIntensity: 0.32 }, // Kugel
] as const;

/** Winkel der Zonen-Station `index` auf dem Zonen-Ring (Start «hinten»). */
export function zoneAngle(index: number, count: number): number {
  const n = Math.max(count, 1);
  return (index / n) * Math.PI * 2 - Math.PI / 2;
}

/** Boden-Position (x|z) der Zonen-Station `index`. */
export function stationPosition(index: number, count: number): { x: number; z: number } {
  const a = zoneAngle(index, count);
  return { x: Math.cos(a) * ZONE_R, z: Math.sin(a) * ZONE_R };
}

/** Winkel-Bogen (Sektor), der einer Zone auf dem Ring zusteht. */
export function zoneSectorAngle(zoneCount: number): number {
  return (Math.PI * 2) / Math.max(zoneCount, 1);
}

/**
 * Winkel-Halbbreite des Tool-Fächers: so breit wie möglich (TOOL_SPAN), aber
 * nie über den eigenen Sektor hinaus — nur so kollidieren Nachbar-Fächer nie.
 */
export function toolFanSpan(zoneCount: number): number {
  return Math.min(TOOL_SPAN, zoneSectorAngle(zoneCount) / 2 - FAN_MARGIN);
}

/**
 * Ring-Radius der Tools einer Zone: mindestens TOOL_R, bei vielen Tools so
 * weit außen, dass die Tools im Fächer den Mindestabstand TOOL_GAP halten
 * (dokumentiert/überprüft in scene.test.ts), aber immer mit Freiraum zur
 * eigenen Station.
 */
export function toolRingRadius(toolCount: number, zoneCount: number): number {
  const span = toolFanSpan(zoneCount);
  const step = toolCount > 1 ? (2 * span) / (toolCount - 1) : 0;
  const needed = step > 0 ? TOOL_GAP / (2 * Math.sin(step / 2)) : TOOL_R;
  const max = ZONE_R - STATION_RING_R - TOOL_CLEAR;
  return Math.min(Math.max(TOOL_R, needed), max);
}

/** Boden-Position (x|z) eines Tools im Fächer seiner Zone. */
export function toolPosition(
  zoneIndex: number,
  zoneCount: number,
  toolIndex: number,
  toolCount: number,
): { x: number; z: number } {
  const span = toolFanSpan(zoneCount);
  const radius = toolRingRadius(toolCount, zoneCount);
  const t = toolCount > 1 ? -span + (2 * span * toolIndex) / (toolCount - 1) : 0;
  const a = zoneAngle(zoneIndex, zoneCount) + t;
  return { x: Math.cos(a) * radius, z: Math.sin(a) * radius };
}

// --- Staff-Kreis ------------------------------------------------------------

/** Winkel-Halbbreite des Staff-Tool-Fächers (fester Wert; eigener innerer Ring). */
export function staffFanSpan(): number {
  return STAFF_SPAN;
}

/** Boden-Position (x|z) der Staff-Station (hinter dem Zentralmonument). */
export function staffStationPosition(): { x: number; z: number } {
  return { x: Math.cos(STAFF_ANGLE) * STAFF_R, z: Math.sin(STAFF_ANGLE) * STAFF_R };
}

/** Boden-Position (x|z) des `index`-ten Staff-Tools im Fächer davor. */
export function staffToolPosition(index: number, count: number): { x: number; z: number } {
  const t = count > 1 ? -STAFF_SPAN + (2 * STAFF_SPAN * index) / (Math.max(count, 1) - 1) : 0;
  const a = STAFF_ANGLE + t;
  return { x: Math.cos(a) * STAFF_TOOL_R, z: Math.sin(a) * STAFF_TOOL_R };
}

// --- Themen-Räume (Sektor-Buchten) ------------------------------------------

/** Distanz vom Zentrum zur Raumhülle (Rechteckwand) entlang des Winkels `a`. */
export function hullRadiusAt(a: number): number {
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const rw = c > 1e-9 ? W / 2 / c : Infinity;
  const rd = s > 1e-9 ? D / 2 / s : Infinity;
  return Math.min(rw, rd);
}

/**
 * Winkel der Sektorgrenze NACH Station `index` (Mitte zwischen Station i und
 * ihrem Nachbarn) — dort steht die Trennwand zwischen den Themen-Räumen.
 */
export function roomBoundaryAngle(index: number, zoneCount: number): number {
  return zoneAngle(index, zoneCount) + zoneSectorAngle(zoneCount) / 2;
}

/**
 * Transform einer Trennwand: radial von ROOM_INNER bis zur Hülle entlang der
 * Grenze. Liefert Innen-/Außen-Endpunkt, Radius-Werte und den Wand-Winkel
 * (für rotation.y = -angle, damit die Wandlänge radial verläuft).
 */
export function roomWallTransform(
  index: number,
  zoneCount: number,
): {
  angle: number;
  innerRadius: number;
  outerRadius: number;
  inner: { x: number; z: number };
  outer: { x: number; z: number };
} {
  const a = roomBoundaryAngle(index, zoneCount);
  const innerR = ROOM_INNER;
  const outerR = Math.max(innerR + 3, hullRadiusAt(a) - 0.35);
  return {
    angle: a,
    innerRadius: innerR,
    outerRadius: outerR,
    inner: { x: Math.cos(a) * innerR, z: Math.sin(a) * innerR },
    outer: { x: Math.cos(a) * outerR, z: Math.sin(a) * outerR },
  };
}

/**
 * Äußerer Radius des Raums `index` (Teppich reicht bis zur Hülle entlang der
 * Raum-Mitte, gemessen auf halber Sektorhöhe).
 */
export function roomOuterRadius(index: number, zoneCount: number): number {
  const mid = zoneAngle(index, zoneCount);
  return Math.max(ROOM_INNER + 3, hullRadiusAt(mid) - 0.35);
}

/** Prozeduraler Hintergrund-Verlauf (Canvas-Gradient) — kein Asset nötig. */
function makeBackgroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(0.55, `#${new THREE.Color(BG_MID).getHexString()}`);
    grad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

let academiaImage: HTMLImageElement | null | 'loading' = null;
const academiaWaiters: Array<(img: HTMLImageElement | null) => void> = [];

/** Lädt die Akademie-SVG einmalig (modulweit gecacht) und informiert Wartende. */
function loadAcademiaImage(): Promise<HTMLImageElement | null> {
  if (academiaImage !== 'loading') return Promise.resolve(academiaImage);
  return new Promise((resolve) => academiaWaiters.push(resolve));
}

/**
 * Legt die Akademie-Symbolik über den Verlauf: 8×3 Kacheln (damit die Motive
 * auf breiten Ansichten annähernd quadratisch bleiben), subtil und nach oben/
 * unten hin ausgedünnt. Tauscht scene.background; scheitert das Laden, bleibt
 * der reine Verlauf (progressive enhancement).
 */
function decorateBackgroundWithAcademia(scene: THREE.Scene, base: THREE.CanvasTexture): void {
  if (academiaImage === null) {
    // Erstkontakt: Bild-Load anstoßen und danach nachziehen.
    academiaImage = 'loading';
    const img = new Image();
    img.onload = () => {
      academiaImage = img;
      academiaWaiters.splice(0).forEach((w) => w(img));
    };
    img.onerror = () => {
      // Fehler ist kein Drama: Verlauf bleibt; späterer Aufruf versucht neu.
      academiaImage = null;
      academiaWaiters.splice(0).forEach((w) => w(null));
    };
    img.src = ACADEMIA_PATH;
  }
  void loadAcademiaImage().then((img) => {
    if (!img) return;
    const cols = 8;
    const rows = ACADEMIA_PROFILE.length;
    const w = ACADEMIA_TILE * cols;
    const h = ACADEMIA_TILE * rows;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 1) Verlauf wie bisher (identische Stopps wie makeBackgroundTexture).
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(0.55, `#${new THREE.Color(BG_MID).getHexString()}`);
    grad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // 2) Akademie-Kacheln mit vertikalem Ausblend-Profil.
    for (let r = 0; r < rows; r++) {
      ctx.globalAlpha = academiaRowAlpha(r);
      for (let c = 0; c < cols; c++) {
        ctx.drawImage(img, c * ACADEMIA_TILE, r * ACADEMIA_TILE, ACADEMIA_TILE, ACADEMIA_TILE);
      }
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    scene.background = tex;
    base.dispose();
  });
}

export function createWorkplaceScene(
  container: HTMLElement,
  zones: SceneZone[],
  callbacks: SceneCallbacks = {},
  options: CreateSceneOptions = {},
): WorkplaceSceneHandle | null {
  const embedded = options.embedded ?? false;

  // --- Motion-Profil: prefers-reduced-motion respektieren (#5) -------------
  let prefs: MotionPrefs = motionPrefs(prefersReducedMotion());

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = SCENE_QUALITY.toneMapping;
  renderer.toneMappingExposure = SCENE_QUALITY.toneMappingExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Pixel-Ratio: Cap 1.5, schwache Hardware startet tiefer, Auto-Degradierung
  // bei Last folgt im Frame-Budget-Check unten (#7).
  let pixelRatio = resolvePixelRatio(window.devicePixelRatio ?? 1, {
    cores: navigator.hardwareConcurrency,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 480);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const scene = new THREE.Scene();
  const bgTex = makeBackgroundTexture();
  scene.background = bgTex;
  // Akademie-Symbolik subtil in den Hintergrund einweben (Website-Teaser-SVG);
  // asynchron — der reine Verlauf bleibt bis zum Laden (progressive enhancement).
  decorateBackgroundWithAcademia(scene, bgTex);
  scene.fog = new THREE.Fog(BG_MID, FOG_NEAR, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(
    CAM_FOV,
    (container.clientWidth || 800) / (container.clientHeight || 480),
    0.1,
    CAM_FAR,
  );
  camera.position.set(...CAM_POS);
  camera.lookAt(...CAM_LOOK);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 5;
  controls.maxDistance = CAM_MAX_DIST;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(CAM_LOOK[0], CAM_LOOK[1] - 0.6, CAM_LOOK[2]);

  // --- Kamera-Fahrt (Zone/Übersicht) ----------------------------------------
  // Sanfte Animation von Kamera-Position + Orbit-Target (easeInOutCubic) im
  // normalen Frame-Loop. Bei prefers-reduced-motion sofortiger Snapshot (kein
  // Übergang) — gesteuert über tuning.MotionPrefs.cameraFlight.
  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const CAMERA_HOME_POS = new THREE.Vector3(...CAM_POS);
  const CAMERA_HOME_LOOK = new THREE.Vector3(...CAM_LOOK);
  let flight: {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
    dur: number;
  } | null = null;

  const flyTo = (toPos: THREE.Vector3, toTarget: THREE.Vector3) => {
    stopAutoRotate();
    const target = {
      fromPos: camera.position.clone(),
      toPos: toPos.clone(),
      fromTarget: controls.target.clone(),
      toTarget: toTarget.clone(),
      t: 0,
      dur: Math.max(prefs.cameraFlightMs, 1) / 1000,
    };
    if (!prefs.cameraFlight) {
      // Reduced motion: sofort positioniert, kein Übergang.
      camera.position.copy(target.toPos);
      controls.target.copy(target.toTarget);
      controls.update();
      return;
    }
    flight = target;
    wake();
  };

  /** Zurück zur Startübersicht (auch am Zentralmonument gebunden). */
  const resetView = () => flyTo(CAMERA_HOME_POS, CAMERA_HOME_LOOK);

  /** Kamerafahrt zur Station einer Zone (id aus dem Katalog, inkl. Staff). */
  const focusZone = (zoneId: string) => {
    const z = pickEntries.find((e) => e.kind === 'zone' && e.zone?.id === zoneId);
    if (!z) return;
    const look = new THREE.Vector3(z.group.position.x, 1.0, z.group.position.z);
    // Kamera bleibt auf demselben Azimuth wie die Station, rückt aber näher
    // heran (rahmt Station + Tool-Fächer) und hebt etwas an.
    const pos = look.clone().multiplyScalar(0.45);
    pos.y = 6;
    flyTo(pos, look);
  };

  // --- dispose-Verwaltung: shared Ressourcen zentral freigeben (#11) -------
  const disposables = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  const track = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => {
    disposables.add(x);
    return x;
  };

  // --- Licht: Hemisphäre + Key mit weichen Schatten auf wenigen Meshes (#1)
  scene.add(new THREE.HemisphereLight(0x9fc2ff, 0x0a0d14, 0.55));
  scene.add(new THREE.AmbientLight(0x33405e, 0.4));
  const key = new THREE.DirectionalLight(0xfff2df, 1.5);
  key.position.set(10, 18, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(SCENE_QUALITY.shadowMapSize, SCENE_QUALITY.shadowMapSize);
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 60;
  const shadowExtent = ZONE_R + 5;
  key.shadow.camera.left = -shadowExtent;
  key.shadow.camera.right = shadowExtent;
  key.shadow.camera.top = shadowExtent;
  key.shadow.camera.bottom = -shadowExtent;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x86a5ff, 0.4);
  fill.position.set(-9, 8, -7);
  scene.add(fill);
  const glow = new THREE.PointLight(0x3fe0ff, 60, 60, 2);
  glow.position.set(0, 5.4, 0);
  scene.add(glow);

  // --- Boden (offene Halle — keine schwarze Raum-Hülle mehr) ---------------
  // Die frühere Umfassung aus vier Wand-Planes + Decke wurde entfernt: die
  // Szene öffnet sich zum Hintergrund-Verlauf. Räumliche Gliederung tragen jetzt
  // nur noch Gitterboden + die niedrigen Themen-Raum-Trennwände (Sektor-Buchten).
  const floorMat = track(new THREE.MeshStandardMaterial({ color: 0x0a101f, roughness: 0.92 }));

  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(W, D)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true; // einziger Schatten-Empfänger (wenige Caster)
  scene.add(floor);

  const grid = new THREE.GridHelper(D, 20, 0x1c2a4a, 0x15203c);
  grid.position.y = 0.004;
  scene.add(grid);

  // Galerie-Beschriftung im Hintergrund — ohne Wand schwebt sie frei über dem
  // Raum, hoch genug um von keinem Objekt verdeckt zu werden, und mit `fog:`
  // `false`, damit der Nebel sie nicht auslöscht (T-PRS-04: Headline muss mit
  // der Standardkamera lesbar bleiben).
  const title = makeTextSprite('DER DIGITALE ARBEITSPLATZ', {
    color: '#cfe0ff',
    bg: 'rgba(8,13,28,0.0)',
    fontSize: 44,
    scale: 0.016,
    fog: false,
    anisotropy: maxAniso,
  });
  title.position.set(0, TITLE_Y, TITLE_Z);
  scene.add(title);
  const subtitle = makeTextSprite('openEduSuite — ein Login für alles', {
    color: '#7f95c9',
    bg: 'rgba(8,13,28,0.0)',
    fontSize: 22,
    scale: 0.012,
    fog: false,
    anisotropy: maxAniso,
  });
  subtitle.position.set(0, TITLE_Y - 1, TITLE_Z);
  scene.add(subtitle);

  // --- Zentrales Monument: der Arbeitsplatz-Desk mit Identitäts-Schlüssel ---
  // Alle Teile in einer Gruppe — der Desk samt Schlüssel ist ein pickbares
  // Element: Klick fährt sanft zurück zur Gesamtübersicht („Heimweg“).
  const monumentLabel = options.monumentLabel ?? 'openEduSuite — Übersicht';
  const monumentGroup = new THREE.Group();
  const deskMat = track(new THREE.MeshStandardMaterial({ color: 0x1a2742, roughness: 0.6, metalness: 0.25 }));
  const top = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.18, 2.5)), deskMat);
  top.position.set(0, 1.05, 0);
  top.castShadow = true;
  monumentGroup.add(top);
  const legGeo = track(new THREE.BoxGeometry(0.18, 1.0, 0.18));
  for (const [lx, lz] of [[-2.6, -1.1], [2.6, -1.1], [-2.6, 1.1], [2.6, 1.1]] as const) {
    const leg = new THREE.Mesh(legGeo, deskMat);
    leg.position.set(lx, 0.5, lz);
    monumentGroup.add(leg);
  }
  // Identitäts-Schlüssel (Monument auf dem Desk) — Torusring + Bart.
  const keyMat = track(new THREE.MeshStandardMaterial({ color: 0xe0a82e, emissive: 0x8a5a00, emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.25 }));
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.5, 0.16, 16, 32)), keyMat);
  ring.position.set(0, 1.75, 0);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  monumentGroup.add(ring);
  const shaft = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.9, 0.22)), keyMat);
  shaft.position.set(0, 1.28, 0);
  monumentGroup.add(shaft);
  const tooth = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.34, 0.5)), keyMat);
  tooth.position.set(0, 1.08, -0.32);
  monumentGroup.add(tooth);
  const deskLabel = makeTextSprite('Ein Login für alle Werkzeuge', {
    color: '#e0a82e',
    bg: 'rgba(8,13,28,0.62)',
    fontSize: 22,
    scale: 0.011,
    anisotropy: maxAniso,
  });
  deskLabel.position.set(0, 2.55, 0);
  monumentGroup.add(deskLabel);
  scene.add(monumentGroup);

  // --- Shared Geometrien/Materialien für Stationen + Tools (#9) ------------
  // Alle Stationen/Tools teilen sich ihre Primitive (ein InstancedMesh wäre bei
  // ~40 pickbaren, einzeln eingefärbten Objekten kein Gewinn — shared Buffers
  // schon). Materialien mit Zonenfarbe bleiben pro Zone, Hover-Emissive
  // benötigt ein Material pro Tool.
  const stationPlateGeo = track(new THREE.CylinderGeometry(1.7, 1.78, 0.1, 36));
  const stationPlateMat = track(new THREE.MeshStandardMaterial({ color: 0x0d1526, roughness: 0.85, metalness: 0.1 }));
  const stationPlinthGeo = track(new THREE.CylinderGeometry(0.5, 0.62, 1.6, 20));
  const stationPlinthMat = track(new THREE.MeshStandardMaterial({ color: 0x182442, roughness: 0.55, metalness: 0.2 }));
  const glowRingGeo = track(new THREE.RingGeometry(1.3, 1.65, 48));
  const toolPlinthGeo = track(new THREE.CylinderGeometry(0.28, 0.34, 0.7, 12));
  const toolPlinthMat = track(new THREE.MeshStandardMaterial({ color: 0x141f38, roughness: 0.7 }));
  const toolGeos: THREE.BufferGeometry[] = [
    track(new THREE.BoxGeometry(0.9, 0.9, 0.9)),
    track(new THREE.OctahedronGeometry(0.72)),
    track(new THREE.IcosahedronGeometry(0.72, 0)),
    track(new THREE.TorusGeometry(0.42, 0.2, 12, 24)),
    track(new THREE.ConeGeometry(0.55, 1.1, 6)),
    track(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10)),
    track(new THREE.SphereGeometry(0.55, 20, 14)),
  ];

  /** Tool-Primitiv: shared Geometrie + PBR-Preset je Kind in Zonenfarbe (#2). */
  const buildToolShape = (kind: number, color: number): THREE.Mesh => {
    const p = TOOL_MATERIAL_PRESETS[kind % TOOL_MATERIAL_PRESETS.length];
    const mat = track(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: p.emissiveIntensity,
        roughness: p.roughness,
        metalness: p.metalness,
      }),
    );
    return new THREE.Mesh(toolGeos[kind % toolGeos.length], mat);
  };

  // --- Zonen-Stationen + Tool-Objekte ---------------------------------------
  interface PickEntry {
    kind: 'tool' | 'zone' | 'monument';
    zone?: SceneZone;
    tool?: SceneTool;
    /** Label nur für das Monument (kein Katalog-Eintrag). */
    label?: string;
    group: THREE.Group;
    /** Basis-Y für das sanfte Schweben (reduced motion: ungenutzt). */
    baseY: number;
    /** Ziel-Scale für den sanften Hover (Lerp im Frame-Loop). */
    targetScale: number;
    /** Meshes, deren Emissive beim Hover hochgezogen wird (+ Basiswerte). */
    glowMeshes: THREE.Mesh[];
    baseEmissive: number[];
  }
  const pickEntries: PickEntry[] = [];
  const rayMeshes: THREE.Mesh[] = [];

  // Monument (Desk + Identitäts-Schlüssel) als pickbares Element: Hover zeigt
  // den Hinweis, Klick fährt sanft zurück zur Gesamtübersicht („Heimweg“).
  const monumentEntry: PickEntry = {
    kind: 'monument',
    label: monumentLabel,
    group: monumentGroup,
    baseY: 0,
    targetScale: 1,
    glowMeshes: [ring],
    baseEmissive: [keyMat.emissiveIntensity],
  };
  top.userData.pickable = true;
  top.userData.entry = monumentEntry;
  ring.userData.pickable = true;
  ring.userData.entry = monumentEntry;
  rayMeshes.push(top, ring);
  pickEntries.push(monumentEntry);

  const N = zones.length || 1;
  zones.forEach((zone, i) => {
    const { x: sx, z: sz } = stationPosition(i, N);
    const color = new THREE.Color(zone.color);

    // Station: Grundplatte + Glow-Ring + Sockel + Icon + Label (#2).
    const station = new THREE.Group();

    const plate = new THREE.Mesh(stationPlateGeo, stationPlateMat);
    plate.position.y = 0.05;
    plate.receiveShadow = true;
    station.add(plate);

    const ringMat = track(
      new THREE.MeshStandardMaterial({
        color: zone.color,
        emissive: zone.color,
        emissiveIntensity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    const disc = new THREE.Mesh(glowRingGeo, ringMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.11;
    station.add(disc);

    const plinth = new THREE.Mesh(stationPlinthGeo, stationPlinthMat);
    plinth.position.y = 0.8;
    plinth.castShadow = true; // Schatten nur auf wenigen Meshes (#9)
    station.add(plinth);

    const icon = makeIconSprite(zone.icon, { size: 84, scale: 0.02, anisotropy: maxAniso });
    icon.position.y = 2.15;
    station.add(icon);

    const label = makeTextSprite(zone.label, {
      color: zone.color,
      bg: 'rgba(8,13,28,0.55)',
      fontSize: 24,
      scale: 0.011,
      anisotropy: maxAniso,
    });
    label.position.y = STATION_LABEL_Y;
    station.add(label);

    station.position.set(sx, 0, sz);
    scene.add(station);
    const stationEntry: PickEntry = {
      kind: 'zone',
      zone,
      group: station,
      baseY: 0,
      targetScale: 1,
      glowMeshes: [disc],
      baseEmissive: [ringMat.emissiveIntensity],
    };
    disc.userData.pickable = true;
    disc.userData.entry = stationEntry;
    plinth.userData.pickable = true;
    plinth.userData.entry = stationEntry;
    rayMeshes.push(disc, plinth);
    pickEntries.push(stationEntry);

    // Tools der Zone: Fächer um die Stations-Achse auf innerem Ring.
    const tools = zone.tools;
    tools.forEach((tool, j) => {
      const { x: tx, z: tz } = toolPosition(i, N, j, tools.length);
      const toolGroup = new THREE.Group();

      const plinth2 = new THREE.Mesh(toolPlinthGeo, toolPlinthMat);
      plinth2.position.y = 0.35;
      toolGroup.add(plinth2);

      const shape = buildToolShape(j, color.getHex());
      shape.position.y = 1.0;
      shape.castShadow = false; // Tools bleiben schattenfrei (Frame-Budget)
      toolGroup.add(shape);

      const name = makeTextSprite(tool.name, {
        color: '#e6eeff',
        bg: 'rgba(8,13,28,0.72)',
        fontSize: 20,
        scale: 0.0095,
        anisotropy: maxAniso,
      });
      name.position.y = 1.75;
      toolGroup.add(name);

      toolGroup.position.set(tx, 0, tz);
      scene.add(toolGroup);
      const toolEntry: PickEntry = {
        kind: 'tool',
        zone,
        tool,
        group: toolGroup,
        baseY: 0,
        targetScale: 1,
        glowMeshes: [shape],
        baseEmissive: [(shape.material as THREE.MeshStandardMaterial).emissiveIntensity],
      };
      shape.userData.pickable = true;
      shape.userData.entry = toolEntry;
      plinth2.userData.pickable = true;
      plinth2.userData.entry = toolEntry;
      rayMeshes.push(shape, plinth2);
      pickEntries.push(toolEntry);
    });
  });

  // --- Staff-/Admin-Kreis (innerer Ring hinter dem Zentralmonument) --------
  // Verwaltungs-Apps in ihrem eigenen Kreis: Station + Tools im Fächer davor,
  // dezenter Bodenring in Staff-Farbe. Klick auf ein Staff-Tool öffnet den
  // Dienst; die Station selbst liefert nur Feedback (kein Deeplink-Filter).
  if (options.staff && options.staff.tools.length > 0) {
    const staff = options.staff;
    const sc = new THREE.Color(staff.color);
    const sp = staffStationPosition();

    const staffRingGeo = track(new THREE.RingGeometry(STAFF_TOOL_R - 0.4, STAFF_R + 0.5, 48));
    const staffRingMat = track(
      new THREE.MeshStandardMaterial({
        color: staff.color,
        emissive: staff.color,
        emissiveIntensity: 0.09,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const staffRing = new THREE.Mesh(staffRingGeo, staffRingMat);
    staffRing.rotation.x = -Math.PI / 2;
    staffRing.position.y = 0.03;
    scene.add(staffRing);

    const staffGroup = new THREE.Group();
    const stPlate = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.16, 0.08, 28)), stationPlateMat);
    stPlate.position.y = 0.04;
    stPlate.receiveShadow = true;
    staffGroup.add(stPlate);
    const stRingMat = track(
      new THREE.MeshStandardMaterial({
        color: staff.color,
        emissive: staff.color,
        emissiveIntensity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    const stDisc = new THREE.Mesh(track(new THREE.RingGeometry(0.85, 1.06, 40)), stRingMat);
    stDisc.rotation.x = -Math.PI / 2;
    stDisc.position.y = 0.1;
    staffGroup.add(stDisc);
    const stPlinth = new THREE.Mesh(track(new THREE.CylinderGeometry(0.36, 0.44, 1.2, 16)), stationPlinthMat);
    stPlinth.position.y = 0.6;
    stPlinth.castShadow = true;
    staffGroup.add(stPlinth);
    const stIcon = makeIconSprite(staff.icon, { size: 64, scale: 0.017, anisotropy: maxAniso });
    stIcon.position.y = 1.6;
    staffGroup.add(stIcon);
    const stLabel = makeTextSprite(staff.label, {
      color: staff.color,
      bg: 'rgba(8,13,28,0.55)',
      fontSize: 20,
      scale: 0.0095,
      anisotropy: maxAniso,
    });
    stLabel.position.y = STAFF_LABEL_Y;
    staffGroup.add(stLabel);
    staffGroup.position.set(sp.x, 0, sp.z);
    scene.add(staffGroup);
    const staffEntry: PickEntry = {
      kind: 'zone',
      zone: staff,
      group: staffGroup,
      baseY: 0,
      targetScale: 1,
      glowMeshes: [stDisc],
      baseEmissive: [stRingMat.emissiveIntensity],
    };
    stDisc.userData.pickable = true;
    stDisc.userData.entry = staffEntry;
    stPlinth.userData.pickable = true;
    stPlinth.userData.entry = staffEntry;
    rayMeshes.push(stDisc, stPlinth);
    pickEntries.push(staffEntry);

    const staffTools = staff.tools;
    staffTools.forEach((tool, j) => {
      const { x, z } = staffToolPosition(j, staffTools.length);
      const sg = new THREE.Group();
      const sp2 = new THREE.Mesh(toolPlinthGeo, toolPlinthMat);
      sp2.position.y = 0.35;
      sg.add(sp2);
      const sshape = buildToolShape(j, sc.getHex());
      sshape.position.y = 1.0;
      sg.add(sshape);
      const snm = makeTextSprite(tool.name, {
        color: '#e6eeff',
        bg: 'rgba(8,13,28,0.72)',
        fontSize: 18,
        scale: 0.0085,
        anisotropy: maxAniso,
      });
      snm.position.y = 1.65;
      sg.add(snm);
      sg.position.set(x, 0, z);
      scene.add(sg);
      const ste: PickEntry = {
        kind: 'tool',
        zone: staff,
        tool,
        group: sg,
        baseY: 0,
        targetScale: 1,
        glowMeshes: [sshape],
        baseEmissive: [(sshape.material as THREE.MeshStandardMaterial).emissiveIntensity],
      };
      sshape.userData.pickable = true;
      sshape.userData.entry = ste;
      sp2.userData.pickable = true;
      sp2.userData.entry = ste;
      rayMeshes.push(sshape, sp2);
      pickEntries.push(ste);
    });
  }

  // --- Themen-Räume: Boden-Teppiche + Trennwände an den Sektorgrenzen ------
  // Jede Kategorie bekommt ihren eigenen «Raum» als Sektor-Bucht entlang der
  // Außenwand: ein dezenter Teppich in Zonenfarbe (Ring-Segment) plus radiale
  // Trennwände an beiden Sektorgrenzen. Die Wände beginnen AUßERHALB aller
  // Tool-Fächer (ROOM_INNER > max. Tool-Radius) und erreichen die Hülle.
  zones.forEach((zone, i) => {
    const carpetOuter = roomOuterRadius(i, N);
    const carpetGeo = track(
      new THREE.RingGeometry(
        ROOM_INNER - 0.35,
        carpetOuter,
        56,
        1,
        // RingGeometry zeichnet Theta CCW ab +X (unsere Welt: z = -sin θ),
        // deshalb thetaStart = -Grenze der Räume (decken exakt die Sektor-Bucht).
        -roomBoundaryAngle(i, N),
        zoneSectorAngle(N),
      ),
    );
    const carpetMat = track(
      new THREE.MeshStandardMaterial({
        color: zone.color,
        emissive: zone.color,
        emissiveIntensity: 0.05,
        transparent: true,
        opacity: ROOM_CARPET_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const carpet = new THREE.Mesh(carpetGeo, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.02;
    scene.add(carpet);
  });
  for (let i = 0; i < N; i++) {
    const w = roomWallTransform(i, N);
    const len = w.outerRadius - w.innerRadius;
    const wallGeo = track(new THREE.BoxGeometry(len, ROOM_H, ROOM_T));
    const wallMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x0f1a33,
        transparent: true,
        opacity: 0.55,
        roughness: 0.85,
        metalness: 0.08,
        side: THREE.DoubleSide,
      }),
    );
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set((w.inner.x + w.outer.x) / 2, ROOM_H / 2, (w.inner.z + w.outer.z) / 2);
    wall.rotation.y = -w.angle;
    wall.receiveShadow = true;
    scene.add(wall);

    // Schmale Glühkante am Wandkopf in der Farbe des Raums links der Grenze.
    const edgeColor = new THREE.Color(
      zones.length ? zones[i % zones.length].color : '#7fb0ff',
    );
    const edgeMat = track(
      new THREE.MeshStandardMaterial({
        color: edgeColor,
        emissive: edgeColor,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9,
      }),
    );
    const edge = new THREE.Mesh(track(new THREE.BoxGeometry(len, 0.07, ROOM_T + 0.12)), edgeMat);
    edge.position.set((w.inner.x + w.outer.x) / 2, ROOM_H + 0.03, (w.inner.z + w.outer.z) / 2);
    edge.rotation.y = -w.angle;
    scene.add(edge);
  }

  // --- Klick-Highlight: ein wiederverwendeter Ripple/Glow-Ring (#3) --------
  const rippleGeo = track(new THREE.RingGeometry(0.25, 0.34, 40));
  const rippleMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const ripple = new THREE.Mesh(rippleGeo, rippleMat);
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.04;
  ripple.visible = false;
  scene.add(ripple);
  const RIPPLE_S = 0.65;
  let rippleT = -1; // -1 = inaktiv, sonst 0..1

  // --- Interaktion: Hover + Klick via Raycaster (#3, #10) ------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredEntry: PickEntry | null = null;
  const dom = renderer.domElement;
  dom.style.cursor = 'grab';

  const setPointer = (e: { clientX: number; clientY: number }) => {
    const rect = dom.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  let needsRender = true;

  const clearHover = () => {
    if (hoveredEntry) {
      hoveredEntry.targetScale = 1;
      const { glowMeshes, baseEmissive } = hoveredEntry;
      for (let i = 0; i < glowMeshes.length; i++) {
        const m = glowMeshes[i].material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = baseEmissive[i];
      }
      hoveredEntry = null;
      wake();
    }
    callbacks.onHover?.(null);
    dom.style.cursor = 'grab';
  };

  const applyHover = (entry: PickEntry) => {
    clearHover();
    hoveredEntry = entry;
    entry.targetScale = 1.12;
    for (const m of entry.glowMeshes) {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.85;
    }
    dom.style.cursor = 'pointer'; // Pointer nur über pickbaren Elementen
    wake();
  };

  /** Raycast nur über Pickables, gedrosselt (#10) — kein Kontinuums-Raycast. */
  const intersect = (): { entry: PickEntry; point: THREE.Vector3 } | null => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(rayMeshes, false);
    for (const h of hits) {
      const entry = h.object.userData.entry as PickEntry | undefined;
      if (entry) return { entry, point: h.point };
    }
    return null;
  };

  const RAYCAST_MIN_PX = 3;
  const RAYCAST_MIN_MS = 100;
  let lastRayX = 0;
  let lastRayY = 0;
  let lastRayT = 0;

  const onPointerMove = (e: PointerEvent) => {
    setPointer(e);
    // Nicht jeden pointermove raycasten: erst ab ~3 px Bewegung oder 100 ms.
    const now = performance.now();
    const moved = Math.hypot(e.clientX - lastRayX, e.clientY - lastRayY);
    if (moved < RAYCAST_MIN_PX && now - lastRayT < RAYCAST_MIN_MS) return;
    lastRayX = e.clientX;
    lastRayY = e.clientY;
    lastRayT = now;

    const hit = intersect();
    if (!hit) {
      if (hoveredEntry) clearHover();
      return;
    }
    if (hit.entry !== hoveredEntry) applyHover(hit.entry);
    const p = hit.entry;
    if (p.kind === 'monument') {
      callbacks.onHover?.({ kind: 'monument', text: monumentLabel, color: '#e0a82e' });
    } else if (p.kind === 'tool' && p.tool) {
      callbacks.onHover?.({ kind: 'tool', text: p.tool.name, color: p.zone?.color ?? '#e6eeff' });
    } else if (p.kind === 'zone' && p.zone) {
      // Tooltip der Station trägt die Werkzeug-Anzahl mit („Label (N)“).
      callbacks.onHover?.({ kind: 'zone', text: `${p.zone.label} (${p.zone.tools.length})`, color: p.zone.color });
    }
  };

  const stopAutoRotate = () => {
    controls.autoRotate = false; // Interaktion beendet die Start-Rotation
  };

  const onPointerDown = (e: PointerEvent) => {
    stopAutoRotate();
    setPointer(e);
  };

  const onClick = (e: MouseEvent) => {
    // Klick nicht als Orbit-Drag werten.
    if (e.detail < 1) return;
    setPointer(e);
    const hit = intersect();
    if (!hit) return;
    const p = hit.entry;
    // Kurzes Klick-Highlight: Ripple/Glow am Trefferpunkt (#3).
    if (prefs.clickRipple) {
      ripple.position.set(hit.point.x, 0.04, hit.point.z);
      rippleMat.color.set(p.zone?.color ?? '#e0a82e');
      rippleT = 0;
      ripple.visible = true;
      wake();
    }
    if (p.kind === 'tool' && p.tool) {
      callbacks.onSelectTool?.(p.tool);
    } else if (p.kind === 'zone' && p.zone) {
      // Klick in eine Zone setzt den Deeplink-Filter UND fährt die Kamera hin.
      focusZone(p.zone.id);
      callbacks.onSelectZone?.(p.zone);
    } else if (p.kind === 'monument') {
      // Zentrales Monument = „Heimweg“: sanft zurück zur Gesamtübersicht.
      resetView();
    }
  };

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerleave', clearHover);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('wheel', stopAutoRotate, { passive: true });
  dom.addEventListener('click', onClick);

  // --- Motion live anwenden (inkl. reduced-motion-Wechsel zur Laufzeit) ----
  let motionQuery: MediaQueryList | null = null;
  const onMotionChange = () => {
    prefs = motionPrefs(prefersReducedMotion());
    applyMotion();
    wake();
  };
  const applyMotion = () => {
    controls.enableDamping = prefs.damping < 1; // reduced: kein sanfter Übergang
    controls.dampingFactor = prefs.damping;
    controls.autoRotate = prefs.autoRotate;
    controls.autoRotateSpeed = autoRotateSpeed(prefs, embedded);
  };
  applyMotion();
  if (typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener?.('change', onMotionChange);
  }
  const onControlsChange = () => {
    // Camera/Zoom-Änderung -> einmalig neu rendern (Damping settled).
    needsRender = true;
    syncLoop();
  };
  controls.addEventListener('change', onControlsChange);

  // --- Render-Loop: nur wenn nötig (#8) -------------------------------------
  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;
  let pageHidden = document.visibilityState === 'hidden';
  let inViewport: boolean | null = null; // null = Observer meldete noch nichts

  // Frame-Budget (#7/#9): Ringpuffer ohne Allokation, Degradierung in Schritten.
  const FRAME_WINDOW = 60;
  const frameMs = new Float32Array(FRAME_WINDOW);
  let frameIdx = 0;
  let frameCount = 0;
  let lastFrameTs = 0;

  const stopLoop = () => {
    if (running) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrameTs = 0; // Pause nicht als Frame-Zeit werten
    }
  };

  /** Loop starten/stoppen gemäß Tab-Sichtbarkeit + Viewport-Sichtbarkeit. */
  const syncLoop = () => {
    const should = shouldRenderLoop({ pageHidden, inViewport });
    if (should && !running) {
      running = true;
      clock.getDelta(); // dt-Sprung nach Pause verwerfen
      lastFrameTs = 0;
      raf = requestAnimationFrame(loop);
    } else if (!should) {
      stopLoop();
    }
  };

  /** Jede Zustandsänderung weckt den Loop (ein Frame) wieder auf. */
  const wake = () => {
    needsRender = true;
    syncLoop();
  };

  const tick = () => {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Frame-Zeit messen (nur solange der Loop wirklich läuft).
    const now = performance.now();
    if (lastFrameTs > 0) {
      frameMs[frameIdx] = now - lastFrameTs;
      frameIdx = (frameIdx + 1) % FRAME_WINDOW;
      frameCount++;
      if (
        frameCount % FRAME_WINDOW === 0 &&
        pixelRatio > PIXEL_RATIO_FLOOR &&
        !pageHidden &&
        shouldDegradeFrame(averageFrameMs(frameMs), Math.min(frameCount, FRAME_WINDOW))
      ) {
        pixelRatio = degradePixelRatio(pixelRatio);
        renderer.setPixelRatio(pixelRatio);
      }
    }
    lastFrameTs = now;

    let animating = false;

    // Sanftes Schweben der Tools (lebendig, aber dezent) — aus bei reduced.
    if (prefs.floatBob) {
      for (const entry of pickEntries) {
        if (entry.kind === 'tool') {
          entry.group.position.y = entry.baseY + Math.sin(t * 0.9 + entry.group.position.x) * 0.06;
        }
      }
      animating = true;
    }

    // Sanfter Hover-Scale (Lerp) — instant bei reduced motion.
    for (const entry of pickEntries) {
      const cur = entry.group.scale.x;
      const target = entry.targetScale;
      if (cur !== target) {
        entry.group.scale.setScalar(cur + (target - cur) * prefs.hoverLerp);
        if (Math.abs(entry.group.scale.x - target) < 0.005) entry.group.scale.setScalar(target);
        animating = true;
      }
    }

    // Klick-Ripple ausblenden.
    if (rippleT >= 0) {
      rippleT += dt / RIPPLE_S;
      if (rippleT >= 1) {
        rippleT = -1;
        ripple.visible = false;
      } else {
        ripple.scale.setScalar(1 + rippleT * 5);
        rippleMat.opacity = 0.55 * (1 - rippleT);
      }
      animating = true;
    }

    if (controls.autoRotate && controls.autoRotateSpeed > 0) animating = true;

    // Kamerafahrt (Zone/Übersicht) — easeInOutCubic über Position + Target.
    if (flight) {
      flight.t += dt / flight.dur;
      const k = easeInOutCubic(Math.min(flight.t, 1));
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (flight.t >= 1) flight = null;
      animating = true;
    }
    controls.update();

    // Rendern nur, wenn sich etwas bewegt oder geändert hat (#8) — danach
    // hält der Loop im Ruhezustand komplett an (0 % GPU) und wird per wake()
    // bei der nächsten Interaktion/Änderung wieder aufgeweckt.
    if (animating || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
    if (!animating) stopLoop();
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    tick();
  };

  const onVisibilityChange = () => {
    pageHidden = document.visibilityState === 'hidden';
    syncLoop();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  let viewportObserver: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    viewportObserver = new IntersectionObserver(
      (entries) => {
        inViewport = entries[0]?.isIntersecting ?? true;
        syncLoop();
      },
      { rootMargin: '96px' },
    );
    viewportObserver.observe(container);
  }
  wake(); // Start-Render anstossen

  // --- Resize ----------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 480;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wake();
  });
  ro.observe(container);

  return {
    dispose() {
      // Loop + Observer + Listener vollständig lösen (#11).
      stopLoop();
      ro.disconnect();
      viewportObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery?.removeEventListener?.('change', onMotionChange);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerleave', clearHover);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('wheel', stopAutoRotate);
      dom.removeEventListener('click', onClick);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      // Geometrien/Materialien/Texturen der Szene + getrackte shared Assets.
      scene.traverse((o) => {
        const obj = o as THREE.Mesh;
        if (obj.geometry) obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
        const disposeMat = (m: THREE.Material) => {
          const map = (m as THREE.MeshStandardMaterial).map ?? (m as THREE.SpriteMaterial).map;
          map?.dispose();
          m.dispose();
        };
        if (Array.isArray(mat)) mat.forEach(disposeMat);
        else if (mat) disposeMat(mat);
      });
      disposables.forEach((d) => d.dispose());
      bgTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    },
    setAutoRotate(v: boolean) {
      controls.autoRotate = v;
      wake();
    },
    resize() {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 480;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      wake();
    },
    resetView,
    focusZone,
  };
}
