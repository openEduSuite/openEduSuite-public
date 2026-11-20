// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// scene.test.ts — Geometrie-Vertrag des 3D-Raums (T-PRS-04 + Überarbeitung):
//  * Abstände: Zonen-Ring (11.5), Tool-Ring (7.0) und Fächer sind großzügig;
//    die Standardkamera rahmt den erweiterten Raum vollständig ein.
//  * Nur nutzerorientierte Dienste: filterUserFacingZones entfernt Admin-/IdP-/
//    GitOps-/interne Instanzen (keycloak, argocd, bbb-internal, infrastructure)
//    und leere Zonen — die Szene zeigt nur echte Benutzer-Werkzeuge.
//  * Proportionale Sektoren: volle Zonen (z. B. «Produktivität») bekommen mehr
//    Winkel-Raum (zoneStartAngles/zoneWeight) — Tools + Labels bleiben getrennt.
//  * Pillars hinter dem Stationsring: ROOM_INNER liegt außerhalb aller
//    Stations-Symbole — Kategorie-Icons/Labels können die Trennwände („Pillars")
//    strukturell nicht mehr schneiden.
//  * Stationen und Tools überlappen sich nicht (mit den realen, gefilterten
//    Katalogdaten).

import { describe, expect, it } from 'vitest';
import { ACESFilmicToneMapping, PerspectiveCamera, Vector3 } from 'three';
import {
  SCENE_METRICS,
  SCENE_QUALITY,
  TOOL_MATERIAL_PRESETS,
  stationPosition,
  stationAngle,
  zoneWeight,
  zoneStartAngles,
  toolPosition,
  toolFanSpan,
  toolRingRadius,
  zoneSectorAngle,
  roomBoundaryAngle,
  roomWallTransform,
  roomOuterRadius,
  hullRadiusAt,
  staffStationPosition,
  staffToolPosition,
  staffFanSpan,
  filterUserFacingZones,
  NON_USER_FACING_SERVICE_IDS,
  NON_USER_FACING_CATEGORIES,
  academiaRowAlpha,
  ACADEMIA_OPACITY,
  type SceneZone,
} from './scene';
import { LABEL_SUPERSAMPLE } from './sprite';
import { buildUserZones, buildStaffZone } from '../../lib/catalog';
import { getConfig } from '../../config';

/** Scene-Zonen wie WorkplaceScene3D: Katalog -> SceneZone -> NUR nutzerorientiert. */
function sceneZones(): SceneZone[] {
  const zones = buildUserZones(getConfig());
  const toScene = (z: { id: string; labelKey: string; icon: string; color: string; services: { id: string }[] }): SceneZone => ({
    id: z.id,
    label: z.labelKey,
    icon: z.icon,
    color: z.color,
    tools: z.services.map((s) => ({
      id: s.id,
      name: s.id,
      zoneId: z.id,
      zoneColor: z.color,
      launchUrl: '',
    })),
  });
  return filterUserFacingZones(zones.map(toScene));
}

/** Zone-Layout-Winkel für die übergebenen Zonen (proportionale Sektoren). */
function anglesFor(zones: SceneZone[]): number[] {
  return zoneStartAngles(zones.map((z) => zoneWeight(z.tools.length)));
}

/** Alle Stationen/Tools aus dem (gefilterten) Katalog als (x|z)-Positionen. */
function catalogPositions() {
  const zones = sceneZones();
  const angles = anglesFor(zones);
  const stations = zones.map((_, i) => stationPosition(angles, i));
  const tools: Array<{ id: string; x: number; z: number }> = [];
  zones.forEach((zone, i) => {
    zone.tools.forEach((svc, j) => {
      const p = toolPosition(angles, i, j, zone.tools.length);
      tools.push({ id: `${zone.id}:${svc.id}`, ...p });
    });
  });
  return { zones, angles, stations, tools };
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

// --- Nur nutzerorientierte Dienste (Überarbeitung) --------------------------
describe('scene — nur nutzerorientierte Dienste', () => {
  it('entfernt Admin-/GitOps-/interne Instanzen, behält die Account-Konsole', () => {
    for (const id of NON_USER_FACING_SERVICE_IDS) expect(id.length).toBeGreaterThan(0);
    expect(NON_USER_FACING_CATEGORIES.has('infrastructure')).toBe(true);

    const zones = sceneZones();
    const ids = new Set(zones.flatMap((z) => z.tools).map((t) => t.id));
    for (const id of NON_USER_FACING_SERVICE_IDS) expect(ids.has(id)).toBe(false);
    // Kein Tool einer ausgeblendeten Kategorie bleibt übrig.
    for (const z of zones) expect(NON_USER_FACING_CATEGORIES.has(z.id)).toBe(false);
  });

  it('behält die Keycloak-Account-Konsole als nutzerorientierten Dienst', () => {
    const zones = sceneZones();
    const tools = zones.flatMap((z) => z.tools);
    const kc = tools.find((t) => t.id === 'keycloak');
    expect(kc).toBeDefined();
    // Sie bewohnt die Zone «Identity» (nutzerorientierte Abbildung der Konsole).
    expect(kc!.zoneId).toBe('identity');
    // Die gesamte Identity-Zone ist wieder sichtbar (Station + Account-Tool).
    expect(zones.map((z) => z.id)).toContain('identity');
  });

  it('wirft Zonen ohne verbleibende Tools weg (z. B. reine Infrastructure-Zone)', () => {
    const zones = sceneZones();
    for (const z of zones) expect(z.tools.length).toBeGreaterThan(0);
    // Mit den Real-Daten: infrastructure (nur argocd) verschwindet; die
    // nutzerorientierten Zonen bleiben (inkl. identity mit der Account-Konsole).
    const zoneIds = zones.map((z) => z.id);
    expect(zoneIds).toContain('identity');
    expect(zoneIds).not.toContain('infrastructure');
    expect(zoneIds).toContain('communication');
    expect(zoneIds).toContain('productivity');
  });

  it('behält Staff unangetastet (Staff-Kreis ist separat und nutzerorientiert)', () => {
    // Der Filter arbeitet auf dem User-Kreis; Staff-Services sind echte
    // Benutzer-Dienste (Mail für Staff/Studierende) und dürfen nicht wegfallen.
    const staff = buildStaffZone(getConfig());
    expect(staff).toBeDefined();
    expect(staff!.services.length).toBeGreaterThan(0);
  });

  it('verlässt sich nicht auf die config-Reihenfolge (bleibt robust)', () => {
    const zones = sceneZones();
    const angles = anglesFor(zones);
    // Zweimal dieselbe Geometrie -> deterministisch (kein Zufall, keine Ms).
    expect(anglesFor(zones)).toEqual(angles);
  });
});

// --- Proportionale Sektoren (Überarbeitung) ---------------------------------
describe('scene — proportionale Sektoren (Tool-Zahl je Zone)', () => {
  it('teilt den Ring proportional zur Tool-Zahl (volle Zonen breiter)', () => {
    const zones = sceneZones();
    const angles = anglesFor(zones);
    const total = 2 * Math.PI;
    // Sektoren summieren sich zum vollen Kreis.
    const sum = zones.reduce((acc, _, i) => acc + zoneSectorAngle(angles, i), 0);
    expect(sum).toBeCloseTo(total, 8);
    // Eine volle Zone (z. B. Produktivität, 4 Tools) ist breiter als jede
    // Ein-Tool-Zone.
    const prod = zones.find((z) => z.id === 'productivity');
    const single = zones.find((z) => z.tools.length === 1);
    expect(prod).toBeDefined();
    expect(single).toBeDefined();
    const sector = (id: string) =>
      zoneSectorAngle(angles, zones.findIndex((z) => z.id === id));
    expect(sector('productivity')).toBeGreaterThan(sector(single!.id));
    // Gewichte sind deterministisch und monoton in der Tool-Zahl.
    expect(zoneWeight(4)).toBeGreaterThan(zoneWeight(1));
    expect(zoneWeight(0)).toBe(1);
  });

  it('hält gefüllte Zonen luftig: Tool-Zentren und -Labels überlappen nicht', () => {
    const { zones, angles, tools } = catalogPositions();
    const minToolDist = minPairDistance(tools);
    // Jedes Tool-Zentrum hält den dokumentierten Mindestabstand TOOL_GAP.
    expect(minToolDist).toBeGreaterThanOrEqual(SCENE_METRICS.layout.toolGap - 1e-6);
    // Der reale mäßige Fall «Produktivität» (4 Tools) hält die Fächer luftig:
    // Zentren-Abstand deutlich größer als die Label-Breite (~1.3-1.6 Welt-Einheiten).
    const prod = zones.find((z) => z.id === 'productivity')!;
    const pi = zones.indexOf(prod);
    const prodTools = prod.tools.map((_, j) => toolPosition(angles, pi, j, prod.tools.length));
    expect(minPairDistance(prodTools)).toBeGreaterThanOrEqual(2.0);
  });
});

// --- Themen-Räume & Pillars hinter dem Stationsring (Überarbeitung) ---------
describe('scene — Pillars hinter dem Stationsring (kein Symbol-Glitch)', () => {
  it('beginnt das Wandband JENSEITS aller Stations-Symbole', () => {
    const { rooms, layout } = SCENE_METRICS;
    // Stations-Sockel-Außenkante = ZONE_R + Bodenring-Außenradius; das Band
    // startet deutlich dahinter — Kategorie-Symbole können die Pillars nicht
    // mehr schneiden (strukturelle Trennung, nicht nur Wandhöhe).
    expect(rooms.innerRadius).toBeGreaterThanOrEqual(layout.zoneRadius + layout.stationRingRadius + 0.5);
    // Wandband bleibt innerhalb der Raumhülle (kein Überstand in die Tiefe).
    const { zones, angles } = catalogPositions();
    for (let i = 0; i < zones.length; i++) {
      const w = roomWallTransform(angles, i);
      expect(w.outerRadius).toBeLessThanOrEqual(hullRadiusAt(w.angle) + 1e-6);
      expect(w.innerRadius).toBeCloseTo(rooms.innerRadius, 5);
      expect(w.outerRadius).toBeGreaterThanOrEqual(w.innerRadius + 0.5);
    }
  });

  it('hält jede Station weit genug von beiden Pillars ihres Raums entfernt', () => {
    const { zones, angles } = catalogPositions();
    const { layout } = SCENE_METRICS;
    for (let i = 0; i < zones.length; i++) {
      const st = stationPosition(angles, i);
      const wPrev = roomWallTransform(angles, (i - 1 + zones.length) % zones.length);
      const wCur = roomWallTransform(angles, i);
      // Nähester Punkt beider Pillars (Innen-Endpunkte) zur Station.
      for (const w of [wPrev, wCur]) {
        const d = Math.hypot(st.x - w.inner.x, st.z - w.inner.z);
        expect(d).toBeGreaterThanOrEqual(layout.stationRingRadius + 2);
      }
    }
  });

  it('Wandhöhe bleibt niedrig und unter der Stations-Icon-Unterkante', () => {
    const { rooms } = SCENE_METRICS;
    expect(rooms.wallHeight).toBeGreaterThanOrEqual(0.8);
    expect(rooms.wallHeight).toBeLessThanOrEqual(1.3);
    expect(rooms.wallHeight).toBeLessThan(2.15 - (84 * 0.02) / 2); // Icon-Unterkante
    expect(rooms.wallThickness).toBeLessThanOrEqual(0.3);
  });
});

// --- Abstände (T-PRS-04, aktualisiert) ---------------------------------------
describe('scene — Abstände (T-PRS-04)', () => {
  it('hält Zonen-/Tool-Ring und Tool-Fächer großzügig', () => {
    const { layout } = SCENE_METRICS;
    expect(layout.zoneRadius).toBeGreaterThanOrEqual(9.2 * 1.15);
    expect(layout.zoneRadius).toBeLessThanOrEqual(9.2 * 1.35);
    expect(layout.toolRadius).toBeGreaterThanOrEqual(5.6 * 1.15);
    expect(layout.toolRadius).toBeLessThanOrEqual(5.6 * 1.3);
    expect(layout.toolSpan).toBeGreaterThanOrEqual(0.8);
    // Tool-Ring bleibt deutlich innerhalb des Zonen-Rings (kein Übergreifen).
    expect(layout.zoneRadius - layout.toolRadius).toBeGreaterThanOrEqual(4);
  });

  it('hält Stationen und Tools mit den realen (gefilterten) Katalogdaten auseinander', () => {
    const { zones, stations, tools } = catalogPositions();
    const { room, layout } = SCENE_METRICS;
    expect(stations.length).toBeGreaterThan(1);
    expect(tools.length).toBeGreaterThan(4);
    // Stationen: Bodenring-Außenradius -> Zentren brauchen > 3.5 Abstand.
    expect(minPairDistance(stations)).toBeGreaterThanOrEqual(3.5);
    // Tools halten den dokumentierten Mindestabstand TOOL_GAP.
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
    }
    // Tool-Fächer bleiben im eigenen Sektor und damit außer Reichweite der
    // Nachbar-Fächer; der Radius bleibt zwischen Tool-Ring und Station.
    for (let i = 0; i < zones.length; i++) {
      expect(toolFanSpan(anglesFor(zones), i)).toBeLessThanOrEqual(zoneSectorAngle(anglesFor(zones), i) / 2);
      expect(toolRingRadius(zones[i].tools.length, anglesFor(zones), i)).toBeGreaterThanOrEqual(layout.toolRadius);
    }
    const outerToolR = layout.zoneRadius - layout.stationRingRadius - layout.toolGap / 2;
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

  it('bewahrt die Raumverträge (Basis der Szene)', () => {
    expect(SCENE_METRICS.layout.zoneRadius).toBe(11.5);
    expect(SCENE_METRICS.layout.toolRadius).toBe(7.0);
    expect(SCENE_METRICS.layout.toolSpan).toBe(0.8);
    expect(SCENE_METRICS.camera.fov).toBe(55);
    expect(SCENE_METRICS.title.y).toBeCloseTo(SCENE_METRICS.room.height - 2.1, 9);
  });
});

// --- Staff-Kreis (Admin/Staff-Apps im inneren Ring) --------------------------
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
    const { zones, angles } = catalogPositions();
    const staffCount = buildStaffZone(getConfig())?.services.length ?? 0;
    const { layout } = SCENE_METRICS;
    const userStations = zones.map((_, i) => stationPosition(angles, i));
    const userTools: Array<{ x: number; z: number }> = [];
    zones.forEach((zone, i) => {
      zone.tools.forEach((_, j) => {
        userTools.push(toolPosition(angles, i, j, zone.tools.length));
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
    const { zones, angles } = catalogPositions();
    const n = zones.length;
    for (let i = 0; i < n; i++) {
      const boundary = roomBoundaryAngle(angles, i);
      const stCur = stationAngle(angles, i);
      const stNext = stationAngle(angles, (i + 1) % n);
      // Winkel in (-π, π] normalisieren.
      const norm = (a: number) => {
        let x = a;
        while (x > Math.PI) x -= 2 * Math.PI;
        while (x <= -Math.PI) x += 2 * Math.PI;
        return x;
      };
      const b = norm(boundary);
      const c = norm(stCur);
      const nn = norm(stNext);
      // Vom Zentrum der Zone im Uhrzeigersinn (zu größerem Winkel) zum Nachbarn.
      let dCur = b - c;
      if (dCur < 0) dCur += 2 * Math.PI;
      let dNext = nn - b;
      if (dNext < 0) dNext += 2 * Math.PI;
      expect(dCur).toBeGreaterThan(1e-6);
      expect(dNext).toBeGreaterThan(1e-6);
      // Die Grenze nimmt ihren Platz proportional ein: sie teilt die Sektoren
      // i und i+1 an ihren Grenzen (jeweils die halbe Sektorbreite vom Zentrum
      // der Nachbar-Stationen aus).
      const sCur = zoneSectorAngle(angles, i);
      const sNext = zoneSectorAngle(angles, (i + 1) % n);
      expect(dCur).toBeCloseTo(sCur / 2, 6);
      expect(dNext).toBeCloseTo(sNext / 2, 6);
    }
  });

  it('Wände beginnen außerhalb aller Tools und reichen bis zur Raumhülle', () => {
    const { zones, angles } = catalogPositions();
    const { rooms, room } = SCENE_METRICS;
    // Maximaler Tool-Radius (alle Fächer) — Wände starten dahinter.
    let maxToolR = 0;
    zones.forEach((zone, i) => {
      const r = toolRingRadius(zone.tools.length, angles, i);
      if (r > maxToolR) maxToolR = r;
    });
    expect(rooms.innerRadius).toBeGreaterThanOrEqual(maxToolR + 0.5);
    // Wände liegen im Raum (zwischen Innenradius und Außenhülle) und ragen
    // nie über die Hülle hinaus.
    for (let i = 0; i < zones.length; i++) {
      const w = roomWallTransform(angles, i);
      expect(w.innerRadius).toBeCloseTo(rooms.innerRadius, 5);
      expect(w.outerRadius).toBeLessThanOrEqual(Math.hypot(room.width, room.depth) / 2 + 0.5);
      expect(w.outerRadius).toBeLessThanOrEqual(hullRadiusAt(w.angle) + 1e-6);
    }
  });

  it('jede Station liegt im Inneren ihres eigenen Raums (zwischen zwei Wänden)', () => {
    const { zones, angles } = catalogPositions();
    for (let i = 0; i < zones.length; i++) {
      const st = stationPosition(angles, i);
      const a = Math.atan2(st.z, st.x);
      const bCur = roomBoundaryAngle(angles, i);
      const bPrev = roomBoundaryAngle(angles, (i - 1 + zones.length) % zones.length);
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
      expect(roomOuterRadius(angles, i)).toBeGreaterThan(SCENE_METRICS.layout.zoneRadius);
    }
  });

  it('Staff-Kreis liegt innerhalb des ersten Raumbereichs (zentraler Innenhof)', () => {
    const { staff, rooms } = SCENE_METRICS;
    expect(rooms.innerRadius).toBeGreaterThan(staff.radius + 0.5);
    // Der zentrale Innenhof (Desk + Staff-Kreis) ist frei von Trennwänden.
    const { zones, angles } = catalogPositions();
    for (let i = 0; i < zones.length; i++) {
      const w = roomWallTransform(angles, i);
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

  it('bewahrt die Raumverträge (Zonen-Ring unverändert)', () => {
    expect(SCENE_METRICS.layout.zoneRadius).toBe(11.5);
    expect(SCENE_METRICS.layout.toolRadius).toBe(7.0);
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
