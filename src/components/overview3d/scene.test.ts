// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// scene.test.ts — Geometrie-Vertrag des 3D-Raums (T-PRS-04):
//  * Abstände: Zonen-Ring, Tool-Ring und Tool-Fächer sind ~15–25 % gewachsen
//    (ZONE_R 9.2 -> ~11, TOOL_R 5.6 -> ~6.6, TOOL_SPAN 0.62 -> ~0.8).
//  * Stationen und Tools überlappen sich nicht (mit den echten Katalogdaten).
//  * Die Standardkamera rahmt den erweiterten Raum vollständig ein — nichts
//    wird abgeschnitten, auch nicht der In-Szene-Titel an der Rückwand; Fog
//    beginnt erst hinter dem Titel.

import { describe, expect, it } from 'vitest';
import { ACESFilmicToneMapping, PerspectiveCamera, Vector3 } from 'three';
import {
  SCENE_METRICS,
  SCENE_QUALITY,
  TOOL_MATERIAL_PRESETS,
  stationPosition,
  zoneAngle,
  toolPosition,
  toolFanSpan,
  toolRingRadius,
  zoneSectorAngle,
  staffStationPosition,
  staffToolPosition,
  staffFanSpan,
  roomBoundaryAngle,
  roomWallTransform,
  roomOuterRadius,
  academiaRowAlpha,
  ACADEMIA_OPACITY,
} from './scene';
import { LABEL_SUPERSAMPLE } from './sprite';
import { buildZones, buildUserZones, buildStaffZone } from '../../lib/catalog';
import { getConfig } from '../../config';

/** Alle Stationen/Tools aus dem echten Katalog als (x|z)-Positionen. */
function catalogPositions() {
  const zones = buildZones(getConfig());
  const stations = zones.map((_, i) => stationPosition(i, zones.length));
  const tools: Array<{ id: string; x: number; z: number }> = [];
  zones.forEach((zone, i) => {
    zone.services.forEach((svc, j) => {
      const p = toolPosition(i, zones.length, j, zone.services.length);
      tools.push({ id: `${zone.id}:${svc.id}`, ...p });
    });
  });
  return { zones, stations, tools };
}

/** Mindest-Abstand aller Punkte-Paare (2D auf dem Boden). */
function minPairDistance(points: Array<{ x: number; z: number }>): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z);
      if (d < min) min = d;
    }
  }
  return min;
}

function buildCamera(aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(
    SCENE_METRICS.camera.fov,
    aspect,
    0.1,
    SCENE_METRICS.camera.far,
  );
  cam.position.set(...SCENE_METRICS.camera.position);
  cam.lookAt(...SCENE_METRICS.camera.lookAt);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

describe('scene — Abstände (T-PRS-04)', () => {
  it('vergrößert Zonen-/Tool-Ring und Tool-Fächer um ~15–25 %', () => {
    const { layout } = SCENE_METRICS;
    expect(layout.zoneRadius).toBeGreaterThanOrEqual(9.2 * 1.15);
    expect(layout.zoneRadius).toBeLessThanOrEqual(9.2 * 1.25);
    expect(layout.toolRadius).toBeGreaterThanOrEqual(5.6 * 1.15);
    expect(layout.toolRadius).toBeLessThanOrEqual(5.6 * 1.25);
    expect(layout.toolSpan).toBeGreaterThanOrEqual(0.8);
    expect(layout.toolSpan).toBeLessThanOrEqual(0.62 * 1.5);
    // Tool-Ring bleibt deutlich innerhalb des Zonen-Rings (kein Übergreifen).
    expect(layout.zoneRadius - layout.toolRadius).toBeGreaterThanOrEqual(4);
  });

  it('hält Stationen und Tools mit den echten Katalogdaten auseinander', () => {
    const { zones, stations, tools } = catalogPositions();
    const { room, layout } = SCENE_METRICS;
    expect(stations.length).toBeGreaterThan(1);
    expect(tools.length).toBeGreaterThan(4);
    // Stationen: Bodenring-Außenradius -> Zentren brauchen > 3.5 Abstand.
    expect(minPairDistance(stations)).toBeGreaterThanOrEqual(3.5);
    // Tools halten den dokumentierten Mindestabstand TOOL_GAP (Sockelradius
    // 0.34 + Schweben/Hover-Skalierung brauchen Luft).
    expect(minPairDistance(tools)).toBeGreaterThanOrEqual(layout.toolGap - 1e-6);
    // Kein Tool ragt in eine Zonen-Station (Bodenring + Objekt-Freiraum).
    const stationClearance = layout.stationRingRadius + layout.toolGap / 2;
    for (const tool of tools) {
      for (const st of stations) {
        expect(Math.hypot(tool.x - st.x, tool.z - st.z)).toBeGreaterThanOrEqual(stationClearance);
      }
    }
    // Stationen bleiben innerhalb der Raum-Hülle (Wandfreiheit).
    for (const st of stations) {
      expect(Math.abs(st.x)).toBeLessThanOrEqual(room.width / 2 - 2);
      expect(Math.abs(st.z)).toBeLessThanOrEqual(room.depth / 2 - 2);
      expect(Math.hypot(st.x, st.z)).toBeCloseTo(layout.zoneRadius, 5);
    }
    // Tool-Fächer bleiben im eigenen Sektor und damit außer Reichweite der
    // Nachbar-Fächer; der Radius bleibt zwischen Tool-Ring und Station.
    expect(toolFanSpan(zones.length)).toBeLessThanOrEqual(zoneSectorAngle(zones.length) / 2);
    const outerToolR = layout.zoneRadius - layout.stationRingRadius - layout.toolGap / 2;
    for (const zone of zones) {
      expect(toolRingRadius(zone.services.length, zones.length)).toBeGreaterThanOrEqual(layout.toolRadius);
      expect(toolRingRadius(zone.services.length, zones.length)).toBeLessThanOrEqual(outerToolR);
    }
    for (const tool of tools) {
      expect(Math.hypot(tool.x, tool.z)).toBeLessThanOrEqual(outerToolR + 1e-6);
      expect(Math.hypot(tool.x, tool.z)).toBeGreaterThanOrEqual(layout.toolRadius - 1e-6);
    }
  });
});

describe('scene — Standardkamera rahmt den Raum ein (T-PRS-04)', () => {
  // Eingebettet (z. B. 360x340 Handy) bis Vollbild (16:9) und breite Desktop-
  // Container — in allen Aspect-Ratios muss nichts abgeschnitten werden.
  const aspects = [1.0, 1.3, 1.78, 2.9];

  it('projiziert jede Zonen-Station (inkl. Labelhöhe) in den Kameraframe', () => {
    const { stations } = catalogPositions();
    for (const aspect of aspects) {
      const cam = buildCamera(aspect);
      for (const st of stations) {
        for (const y of [0, SCENE_METRICS.labelTopY]) {
          const ndc = new Vector3(st.x, y, st.z).project(cam);
          expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.95);
          expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.95);
        }
      }
    }
  });

  it('hält den In-Szene-Titel im Frame und außerhalb des Fog-Bereichs', () => {
    const { title, room, fog } = SCENE_METRICS;
    const titlePos = new Vector3(0, title.y, title.z);
    for (const aspect of aspects) {
      const cam = buildCamera(aspect);
      const ndc = titlePos.clone().project(cam);
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.9);
      expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.9);
    }
    // Fog beginnt erst hinter dem Titel (Nebel würde ihn sonst auslöschen).
    const camPos = new Vector3(...SCENE_METRICS.camera.position);
    expect(titlePos.distanceTo(camPos)).toBeLessThan(fog.near);
    // Der Titel hängt an der Rückwand, nicht im Raum.
    expect(title.z).toBeLessThanOrEqual(-room.depth / 2 + 0.5);
  });

  it('erlaubt Orbit-Zoom-Out weit genug, um den Raum zu rahmen', () => {
    const camPos = new Vector3(...SCENE_METRICS.camera.position);
    const target = new Vector3(...SCENE_METRICS.camera.lookAt);
    expect(SCENE_METRICS.camera.maxDistance).toBeGreaterThan(camPos.distanceTo(target));
  });
});

// --- T-PRS-08: Qualität/Performance-Vertrag (Assertions statt Augenmaß) -----
describe('scene — Grafik-/Performance-Qualität (T-PRS-08)', () => {
  it('nutzt ACESFilmic-Tonemapping und einen definierten Pixel-Ratio-Cap', () => {
    expect(SCENE_QUALITY.toneMapping).toBe(ACESFilmicToneMapping);
    expect(SCENE_QUALITY.toneMappingExposure).toBeGreaterThan(0);
    expect(SCENE_QUALITY.pixelRatioCap).toBe(1.5); // statt 2
    expect(SCENE_QUALITY.pixelRatioFloor).toBeLessThan(SCENE_QUALITY.pixelRatioCap);
  });

  it('begrenzt Schatten auf ein Budget und wenige Caster (nicht alles)', () => {
    expect(SCENE_QUALITY.shadowMapSize).toBeLessThanOrEqual(1024);
    expect(SCENE_QUALITY.shadowCasters).not.toContain('all');
    expect(SCENE_QUALITY.shadowCasters).toContain('plinths');
  });

  it('zeichnet Labels überabgetastet (schärfere Textur, kein Aliasing)', () => {
    expect(LABEL_SUPERSAMPLE).toBeGreaterThanOrEqual(2);
    expect(SCENE_QUALITY.labelSupersample).toBe(LABEL_SUPERSAMPLE);
  });

  it('variiert PBR-Werte je Tool-Kind (Materialien wirken unterschiedlich)', () => {
    expect(TOOL_MATERIAL_PRESETS.length).toBeGreaterThanOrEqual(7);
    const metalnesses = new Set(TOOL_MATERIAL_PRESETS.map((p) => p.metalness));
    const roughnesses = new Set(TOOL_MATERIAL_PRESETS.map((p) => p.roughness));
    expect(metalnesses.size).toBeGreaterThanOrEqual(3); // matt bis edelsteinartig
    expect(roughnesses.size).toBeGreaterThanOrEqual(3);
    for (const p of TOOL_MATERIAL_PRESETS) {
      expect(p.metalness).toBeGreaterThanOrEqual(0);
      expect(p.metalness).toBeLessThanOrEqual(1);
      expect(p.roughness).toBeGreaterThan(0);
      expect(p.roughness).toBeLessThan(1);
      expect(p.emissiveIntensity).toBeGreaterThan(0);
      expect(p.emissiveIntensity).toBeLessThanOrEqual(0.4); // dezent
    }
  });

  it('bewahrt die T-PRS-04-Raumverträge (kein Zurückbauen)', () => {
    // Die Abstands-/Kamera-Metriken bleiben unverändert Basis der Szene.
    expect(SCENE_METRICS.layout.zoneRadius).toBe(11);
    expect(SCENE_METRICS.camera.fov).toBe(55);
    expect(SCENE_METRICS.title.y).toBeCloseTo(SCENE_METRICS.room.height - 2.1, 9);
  });
});

// --- Neuer Auftrag: zwei Kreise (User vs. Staff) + Themen-Räume -------------
describe('scene — Staff-Kreis (Admin/Staff-Apps im inneren Ring)', () => {
  it('Staff-Ring-Metrik ist konsistent: innen, kleiner, hinter dem Desk', () => {
    const { staff, layout } = SCENE_METRICS;
    expect(staff.radius).toBeGreaterThan(0);
    expect(staff.radius).toBeLessThan(layout.zoneRadius); // klar getrennte Ringe
    expect(staff.toolRadius).toBeLessThan(staff.radius); // Tools innen um die Station
    expect(staff.toolRadius).toBeGreaterThanOrEqual(2); // aber nicht auf dem Desk
    // Staff-Station liegt hinter dem Zentralmonument (angle -90° = Rückseite).
    expect(staff.angle).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('Staff-Positionen: Station auf dem Ring, Tools im Fächer davor', () => {
    const { staff } = SCENE_METRICS;
    for (let count = 1; count <= 4; count++) {
      const st = staffStationPosition();
      expect(Math.hypot(st.x, st.z)).toBeCloseTo(staff.radius, 5);
      for (let i = 0; i < count; i++) {
        const p = staffToolPosition(i, count);
        expect(Math.hypot(p.x, p.z)).toBeCloseTo(staff.toolRadius, 5);
        expect(Math.abs(Math.atan2(p.z, p.x) - staff.angle)).toBeLessThanOrEqual(staffFanSpan() + 1e-9);
      }
    }
  });

  it('Staff-Tools kollidieren weder mit dem Desk noch mit User-Objekten', () => {
    const zones = buildUserZones(getConfig());
    const staffCount = buildStaffZone(getConfig())?.services.length ?? 0;
    const { layout } = SCENE_METRICS;
    const userStations = zones.map((_, i) => stationPosition(i, zones.length));
    const userTools: Array<{ x: number; z: number }> = [];
    zones.forEach((zone, i) => {
      zone.services.forEach((_, j) => {
        userTools.push(toolPosition(i, zones.length, j, zone.services.length));
      });
    });
    const staffTools = Array.from({ length: staffCount }, (_, i) => staffToolPosition(i, staffCount));
    const staffStation = staffStationPosition();

    // Staff-Station hält Abstand zu allen User-Tools/Stationen.
    for (const t of userTools) {
      expect(Math.hypot(staffStation.x - t.x, staffStation.z - t.z)).toBeGreaterThanOrEqual(layout.toolGap + 0.5);
    }
    for (const s of userStations) {
      expect(Math.hypot(staffStation.x - s.x, staffStation.z - s.z)).toBeGreaterThanOrEqual(layout.stationRingRadius + 2);
    }
    // Staff-Tools halten den Mindestabstand zu allen User-Tools.
    for (const t of staffTools) {
      for (const u of userTools) {
        expect(Math.hypot(t.x - u.x, t.z - u.z)).toBeGreaterThanOrEqual(layout.toolGap - 1e-6);
      }
      expect(Math.hypot(t.x - staffStation.x, t.z - staffStation.z)).toBeGreaterThanOrEqual(layout.toolGap - 1e-6);
    }
    // Staff-Kreis bleibt vor dem Desk (Desk-Halbbreite 2.8/2 = 1.25 in z).
    for (const t of staffTools) expect(Math.abs(t.z)).toBeGreaterThanOrEqual(1.4);
    expect(Math.abs(staffStation.z)).toBeGreaterThanOrEqual(2);
    // Staff-Station sitzt auf der -z-Seite (hinter dem Desk).
    expect(staffStation.z).toBeLessThan(0);
  });
});

describe('scene — Themen-Räume (Sektor-Buchten mit Trennwänden)', () => {
  it('jede Raumbegrenzung liegt genau zwischen zwei Nachbar-Stationen', () => {
    const zones = buildUserZones(getConfig());
    const n = zones.length;
    for (let i = 0; i < n; i++) {
      const boundary = roomBoundaryAngle(i, n);
      const aCur = zoneAngle(i, n);
      const aNext = zoneAngle((i + 1) % n, n);
      // Winkel in (-π, π] normalisieren und zwischen Kurve und Nachbar prüfen.
      const norm = (a: number) => {
        let x = a;
        while (x > Math.PI) x -= 2 * Math.PI;
        while (x <= -Math.PI) x += 2 * Math.PI;
        return x;
      };
      const b = norm(boundary);
      const c = norm(aCur);
      const nn = norm(aNext);
      // Vom Zentrum der Zone im Uhrzeigersinn (zu größerem Winkel) zum Nachbarn.
      let dCur = b - c;
      if (dCur < 0) dCur += 2 * Math.PI;
      let dNext = nn - b;
      if (dNext < 0) dNext += 2 * Math.PI;
      expect(dCur).toBeGreaterThan(1e-6);
      expect(dNext).toBeGreaterThan(1e-6);
      expect(dCur + dNext).toBeCloseTo(zoneSectorAngle(n), 8);
    }
  });

  it('Wände beginnen außerhalb aller Tools und reichen bis zur Raumhülle', () => {
    const zones = buildUserZones(getConfig());
    const n = zones.length;
    const { rooms, room } = SCENE_METRICS;
    // Maximaler Tool-Radius (alle Fächer) — Wände starten dahinter.
    let maxToolR = 0;
    zones.forEach((zone) => {
      const r = toolRingRadius(zone.services.length, n);
      if (r > maxToolR) maxToolR = r;
    });
    expect(rooms.innerRadius).toBeGreaterThanOrEqual(maxToolR + 0.5);
    // Wände liegen im Raum (zwischen Innenradius und Außenhülle).
    for (let i = 0; i < n; i++) {
      const w = roomWallTransform(i, n);
      expect(w.innerRadius).toBeCloseTo(rooms.innerRadius, 5);
      expect(w.outerRadius).toBeGreaterThanOrEqual(w.innerRadius + 3);
      // Endpunkt liegt innerhalb der Hülle (leicht vor der Wand).
      expect(Math.hypot(w.outer.x, w.outer.z)).toBeLessThanOrEqual(Math.hypot(room.width, room.depth) / 2 + 0.5);
    }
    // Wandmetriken: Höhe niedrig (Sicht bleibt offen) UND klar unterhalb der
    // Stations-Icon-Unterkante (Zentrum 2.15, Halbhöhe 0.84 => 1.31) — nur so
    // können die schwebenden Icons/Labels nie in die Trennwände ragen.
    // (Regression: 3.2-hohe Wände verschluckten die untere Icon-Hälfte.)
    expect(rooms.wallHeight).toBeGreaterThanOrEqual(0.8);
    expect(rooms.wallHeight).toBeLessThanOrEqual(1.3);
    expect(rooms.wallHeight).toBeLessThan(2.15 - (84 * 0.02) / 2);
    expect(rooms.wallThickness).toBeLessThanOrEqual(0.3);
  });

  it('jede Station liegt im Inneren ihres eigenen Raums (zwischen zwei Wänden)', () => {
    const zones = buildUserZones(getConfig());
    const n = zones.length;
    for (let i = 0; i < n; i++) {
      const st = stationPosition(i, n);
      const a = Math.atan2(st.z, st.x);
      const bCur = roomBoundaryAngle(i, n);
      const bPrev = roomBoundaryAngle(i - 1 + n, n);
      const norm = (x: number) => {
        while (x > Math.PI) x -= 2 * Math.PI;
        while (x <= -Math.PI) x += 2 * Math.PI;
        return x;
      };
      const aN = norm(a);
      const lo = norm(bPrev);
      const hi = norm(bCur);
      // a liegt im offenen Intervall (lo, hi) auf dem Kreis.
      let dLo = aN - lo;
      if (dLo < 0) dLo += 2 * Math.PI;
      let dHi = hi - aN;
      if (dHi < 0) dHi += 2 * Math.PI;
      expect(dLo).toBeGreaterThan(1e-6);
      expect(dHi).toBeGreaterThan(1e-6);
      // Der Raum reicht bis zur Rückwand: Außenradius > Stationsradius.
      expect(roomOuterRadius(i, n)).toBeGreaterThan(SCENE_METRICS.layout.zoneRadius);
    }
  });

  it('Staff-Kreis liegt innerhalb des ersten Raumbereichs (zentraler Innenhof)', () => {
    const { staff, rooms } = SCENE_METRICS;
    expect(rooms.innerRadius).toBeGreaterThan(staff.radius + 0.5);
    // Der zentrale Innenhof (Desk + Staff-Kreis) ist frei von Trennwänden.
    for (let i = 0; i < 6; i++) {
      const w = roomWallTransform(i, 6);
      expect(w.innerRadius).toBeGreaterThanOrEqual(staff.radius + 0.4);
    }
  });

  it('Staff-Kreis bleibt in der Standardkamera vollständig im Frame', () => {
    const st = staffStationPosition();
    const stLabel = staffToolPosition(0, 1); // ein Tool als Vertreter
    for (const aspect of [1.0, 1.3, 1.78, 2.9]) {
      const cam = buildCamera(aspect);
      for (const p of [st, stLabel]) {
        for (const y of [0, 2.4]) {
          const ndc = new Vector3(p.x, y, p.z).project(cam);
          expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.95);
          expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.95);
        }
      }
    }
  });

  it('bewahrt die T-PRS-04-Raumverträge (Zonen-Ring unverändert)', () => {
    expect(SCENE_METRICS.layout.zoneRadius).toBe(11);
    expect(SCENE_METRICS.layout.toolRadius).toBe(6.6);
  });

  // Akademie-Symbolik im Hintergrund (Website-Teaser-SVG als dezente Textur).
  describe('Academia-Hintergrund', () => {
    it('nutzt eine sichtbare aber zurückhaltende Deckkraft (~0.22, dunkler Grund)', () => {
      expect(ACADEMIA_OPACITY).toBe(0.22);
    });

    it('blendet vertikal aus: Mitte am sichtbarsten, oben/unten dezenter', () => {
      const mid = academiaRowAlpha(1);
      expect(mid).toBe(ACADEMIA_OPACITY); // Profilwert 1.0 = voller Wert
      // Ferne (Reihe 0) ist blasser als die Mitte — das Motiv verschwindet
      // sanft Richtung Horizont statt hart abzuschneiden.
      expect(academiaRowAlpha(0)).toBeLessThan(mid);
      expect(academiaRowAlpha(2)).toBeLessThan(mid);
      // Niemals negativ oder über der Basis-Deckkraft.
      for (let r = 0; r < 3; r++) {
        expect(academiaRowAlpha(r)).toBeGreaterThan(0);
        expect(academiaRowAlpha(r)).toBeLessThanOrEqual(ACADEMIA_OPACITY);
      }
    });
  });
});
