// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// webgl.ts — robuste WebGL-Verfügbarkeitsprüfung.
// Fehlt WebGL (alte Geräte, jsdom-Tests), fällt die Szene auf das statische
// Landing-Bild zurück (progressive enhancement).

let cached: boolean | null = null;

export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    cached = !!gl;
  } catch {
    cached = false;
  }
  return cached;
}

/** Nur für Tests: Cache zurücksetzen. */
export function __resetWebglCache(): void {
  cached = null;
}
