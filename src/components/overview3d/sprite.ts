// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// sprite.ts — Canvas-basierte Sprite-Labels (Name, Zonen-Icon) ohne
// Schrift-Assets. Zeichnet Text/Emoji auf eine 2D-Canvas und nutzt sie als
// THREE.Sprite-Textur — identisch zur Label-Technik der chemie-Lernlabore.
//
// T-PRS-08: Labels schärfer zeichnen — die Canvas wird mit SUPERSAMPLE-facher
// Auflösung gerendert (Weltgröße bleibt gleich), der Text bekommt einen
// weichen Halo (Schatten + Kontur), damit er vor hellen wie dunklen Flächen
// lesbar bleibt. Kein Aliasing: Linear-Filter + optional Anisotropie.

import * as THREE from 'three';

interface LabelOpts {
  color?: string;
  bg?: string;
  fontSize?: number;
  pad?: number;
  /** Weltgrößen-Skalierung (Pixel -> Weltkoordinaten). */
  scale?: number;
  opacity?: number;
  /** Nebel ausschalten (z. B. für Beschriftungen, die immer lesbar bleiben). */
  fog?: boolean;
  /** Halo/Kontur um den Text (bessere Lesbarkeit, dezenter Glow). */
  halo?: boolean;
}

/** Überabtastung der Label-Canvas: 3x zeichnen, gleiche Weltgröße = scharf. */
export const LABEL_SUPERSAMPLE = 3;

// --- Textur-Cache für Sprite-Labels (Optimierung) -------------------------
// Gleiche Textur (gleicher Text/Emoji + Opts) wird nur EINMAL gerendert und
// über alle Szenen-Instanzen geteilt: beim Sprachnwechsel/Neuaufbau entsteht
// keine neue Canvas-Textur mehr für unveränderte Labels/Icons. Die Einträge
// leben modulweit (bounded: eine Textur pro eindeutigem Label/Icon), das
// Szenen-Dispose überspringt sie über den CACHED_TEXTURE-Marker.
const textTextureCache = new Map<string, { tex: THREE.CanvasTexture; w: number; h: number }>();
const iconTextureCache = new Map<string, { tex: THREE.CanvasTexture; size: number }>();

/** Marker (string): geteilte Texturen im Szenen-Dispose NICHT freigeben. */
export const CACHED_TEXTURE = '__tprsCachedTexture';

/** Für HMR/Tests: alle geteilten Label-/Icon-Texturen freigeben. */
export function clearSpriteTextureCache(): void {
  for (const { tex } of textTextureCache.values()) tex.dispose();
  for (const { tex } of iconTextureCache.values()) tex.dispose();
  textTextureCache.clear();
  iconTextureCache.clear();
}

function applyTextStyle(ctx: CanvasRenderingContext2D, fontSize: number) {
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
}

function makeCanvas(
  text: string,
  o: Required<Pick<LabelOpts, 'color' | 'bg' | 'fontSize' | 'pad'>> & { halo: boolean },
): [HTMLCanvasElement, number, number] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const sup = LABEL_SUPERSAMPLE;
    const px = o.fontSize * sup;
    const pad = o.pad * sup;
    applyTextStyle(ctx, px);
    const w = Math.ceil(ctx.measureText(text).width + pad * 2);
    const h = Math.ceil(o.fontSize * 1.6 * sup);
    canvas.width = w;
    canvas.height = h;
    applyTextStyle(ctx, px);
    if (o.bg) {
      ctx.fillStyle = o.bg;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, h / 2.6);
      ctx.fill();
    }
    ctx.textBaseline = 'middle';
    if (o.halo) {
      // Weicher Halo: Schatten-Bloom + dunkle Kontur — Lesbarkeit auf jedem
      // Hintergrund, ohne zusätzliches Asset.
      ctx.shadowColor = 'rgba(3,7,18,0.9)';
      ctx.shadowBlur = o.fontSize * sup * 0.35;
      ctx.lineWidth = Math.max(2, o.fontSize * sup * 0.08);
      ctx.strokeStyle = 'rgba(4,8,20,0.85)';
      ctx.strokeText(text, pad, h / 2 + sup);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = o.color;
    ctx.fillText(text, pad, h / 2 + sup);
  } else {
    canvas.width = 2;
    canvas.height = 2;
  }
  return [canvas, canvas.width, canvas.height];
}

function makeSpriteTexture(canvas: HTMLCanvasElement, anisotropy = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Scharf bis in die Distanz: lineare Filter + Anisotropie (Renderer-Maximum).
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (anisotropy > 1) tex.anisotropy = anisotropy;
  return tex;
}

/** Text-Sprite (Name/Galerie-Beschriftung) mit optionalem Pill-Hintergrund.
 *  Kanvas-Textur wird modulweit gecacht (CACHED_TEXTURE) — gleiche Labels
 *  werden über Szenen-/Sprachnwechsel hinweg geteilt, nur das (billige)
 *  SpriteMaterial ist pro Aufruf frisch. */
export function makeTextSprite(text: string, opts: LabelOpts & { anisotropy?: number } = {}): THREE.Sprite {
  const o = {
    color: opts.color ?? '#dfe8ff',
    bg: opts.bg ?? 'rgba(10,15,30,0.78)',
    fontSize: opts.fontSize ?? 28,
    pad: opts.pad ?? 10,
    halo: opts.halo ?? true,
  };
  // Fingerabdruck nur aus Kanvas-relevanten OpTs (nicht scale/opacity/fog —
  // die ändern Material/Render, aber nicht die Textur).
  const key = JSON.stringify([text, o.color, o.bg, o.fontSize, o.pad, o.halo, opts.anisotropy ?? 1]);
  let entry = textTextureCache.get(key);
  if (!entry) {
    const [canvas, w, h] = makeCanvas(text, o);
    const tex = makeSpriteTexture(canvas, opts.anisotropy ?? 1);
    tex.userData[CACHED_TEXTURE] = true;
    entry = { tex, w, h };
    textTextureCache.set(key, entry);
  }
  const { tex, w, h } = entry;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: opts.opacity ?? 1,
    fog: opts.fog ?? true,
  });
  const sprite = new THREE.Sprite(mat);
  // Weltgröße unverändert: Canvas-Pixel durch Überabtastung teilen.
  const scale = (opts.scale ?? 0.011) / LABEL_SUPERSAMPLE;
  sprite.scale.set(w * scale, h * scale, 1);
  return sprite;
}

/** Emoji-Icon-Sprite (Zone/Tool) — Emojis rendern in Canvas nativ. Nach der
 *  Lösch-Sache: Textur modulweit gecacht (CACHED_TEXTURE). */
export function makeIconSprite(
  emoji: string,
  opts: { size?: number; scale?: number; opacity?: number; anisotropy?: number } = {},
): THREE.Sprite {
  const size = opts.size ?? 64;
  const key = JSON.stringify([emoji, size, opts.anisotropy ?? 1]);
  let entry = iconTextureCache.get(key);
  if (!entry) {
    const fontSize = size * LABEL_SUPERSAMPLE;
    const canvas = document.createElement('canvas');
    canvas.width = fontSize;
    canvas.height = fontSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, fontSize / 2, fontSize / 2 + 2 * LABEL_SUPERSAMPLE);
    }
    const tex = makeSpriteTexture(canvas, opts.anisotropy ?? 1);
    tex.userData[CACHED_TEXTURE] = true;
    entry = { tex, size: fontSize };
    iconTextureCache.set(key, entry);
  }
  const { tex, size: fontSize } = entry;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: opts.opacity ?? 1 });
  const sprite = new THREE.Sprite(mat);
  const s = (opts.scale ?? 0.016) / LABEL_SUPERSAMPLE;
  sprite.scale.set(fontSize * s, fontSize * s, 1);
  return sprite;
}
