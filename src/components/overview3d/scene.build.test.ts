// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// scene.build.test.ts — Laufzeit-Smoke-Test des echten Szenen-Builds (nicht
// gemockte drei.js-Geometrie, nur Renderer/Controls/RAF/ResizeObserver sind
// Stubs):
//  * createWorkplaceScene baut mit den echten (gefilterten) Katalogdaten
//    durch (Staff-Kreis + Themen-Räume), ohne zur Laufzeit zu werfen.
//  * Der Staff-Kreis ist vorhanden: Staff-Group auf dem inneren Ring (0,-4.6),
//    Staff-Bodenring (RingGeometry-Außenradius STAFF_R+0.5), Staff-Sockel
//    (Cylinder radiusTop 0.36) und Staff-Tools im Fächer (Radius STAFF_TOOL_R).
//  * Die Themen-Räume sind vorhanden: je Zone eine Trennwand (BoxGeometry
//    Höhe ROOM_H) und ein Boden-Teppich (RingGeometry Innenradius CARPET_INNER).
//  * Überarbeitung: Die Szene baut nur die nutzerorientierten Zonen (Keycloak/
//    Argo CD/interne Instanzen fehlen), und jede Trennwand steht an der
//    proportionalen Sektorgrenze (kein gleichmäßiges 1/N mehr).
//
// jsdom hat kein WebGL/2D-Canvas — die Szenen-Helfer sind für genau diesen
// Fall abgesichert (Guards), daher baut die Szene auch ohne Canvas.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { RingGeometry } from 'three';

// Renderer/Controls sind die einzigen echten WebGL/Event-Abhängigkeiten:
// WebGLRenderer -> Fake, OrbitControls -> Fake. Alle drei.js-Geometrie bleibt
// echt, damit der komplette Objektaufbau geprüft wird.
vi.mock('three', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('three');
  class FakeWebGLRenderer {
    outputColorSpace = '';
    toneMapping = 0;
    toneMappingExposure = 1;
    shadowMap = { enabled: false, type: 0 };
    capabilities = { getMaxAnisotropy: () => 8 };
    domElement = document.createElement('canvas');
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class FakeOrbitControls {
    target = new THREE.Vector3();
    minDistance = 0;
    maxDistance = 0;
    maxPolarAngle = 0;
    autoRotate = false;
    autoRotateSpeed = 0;
    update = vi.fn();
    dispose = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
  },
}));

import {
  createWorkplaceScene,
  staffStationPosition,
  staffToolPosition,
  roomWallTransform,
  roomBoundaryAngle,
  stationAngle,
  zoneWeight,
  zoneStartAngles,
  zoneSectorAngle,
  filterUserFacingZones,
  SCENE_METRICS,
} from './scene';
import type { SceneZone } from './scene';
import { getConfig } from '../../config';
import { buildUserZones, buildStaffZone } from '../../lib/catalog';

interface ZoneLike {
  id: string;
  labelKey: string;
  icon: string;
  color: string;
  services: { id: string; icon: string; launchUrl: string }[];
}

function toZone(z: ZoneLike): SceneZone {
  return {
    id: z.id,
    label: z.labelKey, // LabelKey reicht für den Geometrie-Test
    icon: z.icon,
    color: z.color,
    tools: z.services.map((s) => ({ id: s.id, name: s.id, zoneId: z.id, zoneColor: z.color, launchUrl: s.launchUrl })),
  };
}

/** Wie die echte Szene: User-Zonen NUR nutzerorientiert, Staff unverändert. */
function catalogZones(): { zones: SceneZone[]; staff: SceneZone | null } {
  const cfg = getConfig();
  const zones = filterUserFacingZones(buildUserZones(cfg).map(toZone));
  const staffSrc = buildStaffZone(cfg);
  const staff = staffSrc ? toZone(staffSrc) : null;
  return { zones, staff };
}

// jsdom hat weder rAF noch ResizeObserver — für den Build reichen stubs.
// requestAnimationFrame wird NICHT ausgelöst (kein Frameloop im Test).
function stubBrowserGlobals() {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
  const mm = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('matchMedia', mm);
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
  // WebGL/2D-Canvas nicht verfügbar: keine echten Texturen — Szenen-Fallback greift.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
}

describe('scene — Laufzeit-Build (echte drei.js-Geometrie)', () => {
  let container: HTMLDivElement;
  let spy: ReturnType<typeof vi.spyOn>;
  let buildScene: () => ReturnType<typeof createWorkplaceScene>;

  beforeEach(() => {
    stubBrowserGlobals();
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 900, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
    document.body.appendChild(container);
    spy = vi.spyOn(THREE.Object3D.prototype, 'add');
    buildScene = () => {
      const { zones, staff } = catalogZones();
      return createWorkplaceScene(container, zones, {}, { embedded: false, staff });
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    container.remove();
  });

  /** Alle seit Teststart in die Szene gehängten Objekte (frisch gelesen). */
  function sceneObjects(): THREE.Object3D[] {
    return spy.mock.calls.map((c: unknown[]) => c[0] as THREE.Object3D);
  }

  it('baut die Szene mit Staff-Kreis und Themen-Räumen fehlerfrei auf', () => {
    const handle = buildScene();
    expect(handle).not.toBeNull();
    // Dispose löst alle Ressourcen (kein Wurf = sauberer Teardown).
    expect(() => handle!.dispose()).not.toThrow();
  });

  it('platziert den Staff-Kreis auf dem inneren Ring hinter dem Desk', () => {
    buildScene();
    const adds = sceneObjects();
    const sp = staffStationPosition();
    // Staff-Group liegt exakt auf der Staff-Position (0, -STAFF_R).
    const staffGroup = adds.find(
      (o) => o instanceof THREE.Group && Math.abs(o.position.x - sp.x) < 1e-6 && Math.abs(o.position.z - sp.z) < 1e-6,
    );
    expect(staffGroup).toBeDefined();
    // Staff-Bodenring (RingGeometry auf STAFF_R+0.5) ist in der Szene.
    const ring = adds.find(
      (o) =>
        o instanceof THREE.Mesh &&
        (o.geometry as THREE.RingGeometry).type === 'RingGeometry' &&
        (o.geometry as THREE.RingGeometry).parameters.outerRadius === 4.6 + 0.5,
    );
    expect(ring).toBeDefined();
    // Staff-Sockel (Cylinder radiusTop 0.36) markiert die Station selbst.
    const plinth = adds.find(
      (o) =>
        o instanceof THREE.Mesh &&
        (o.geometry as THREE.CylinderGeometry).type === 'CylinderGeometry' &&
        (o.geometry as THREE.CylinderGeometry).parameters.radiusTop === 0.36,
    );
    expect(plinth).toBeDefined();
  });

  it('baut zu jeder nutzerorientierten Zone eine Trennwand und einen Boden-Teppich', () => {
    const { zones } = catalogZones();
    const n = zones.length;
    expect(n).toBeGreaterThan(1);
    buildScene();
    const meshes = sceneObjects().filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    // Trennwände: BoxGeometry mit Wandhöhe ROOM_H (niedrig, unterhalb der
    // Stations-Icon-Unterkante — Icons ragen nie in die Pillars) — genau N Stück.
    const wallH = SCENE_METRICS.rooms.wallHeight;
    const walls = meshes.filter(
      (m) => (m.geometry as THREE.BoxGeometry).type === 'BoxGeometry' && (m.geometry as THREE.BoxGeometry).parameters.height === wallH,
    );
    expect(walls.length).toBe(n);
    // Boden-Teppiche: RingGeometry mit CARPET_INNER als Innenradius — N Stück.
    const carpetInner = SCENE_METRICS.rooms.carpetInnerRadius;
    const carpets = meshes.filter(
      (m) =>
        (m.geometry as THREE.RingGeometry).type === 'RingGeometry' &&
        (m.geometry as THREE.RingGeometry).parameters.innerRadius === carpetInner,
    );
    expect(carpets.length).toBe(n);
    // Jede Trennwand steht an einer Sektorgrenze (Position = Wandmitte).
    const angles = zoneStartAngles(zones.map((z) => zoneWeight(z.tools.length)));
    const w = roomWallTransform(angles, 0);
    const firstWall = walls.find(
      (m) => Math.abs(m.position.x - (w.inner.x + w.outer.x) / 2) < 1e-6 && Math.abs(m.position.z - (w.inner.z + w.outer.z) / 2) < 1e-6,
    );
    expect(firstWall).toBeDefined();
  });

  it('deckt jeder Teppich die eigene proportionale Sektor-Bucht ab', () => {
    createWorkplaceScene(container, catalogZones().zones, {}, { embedded: true, staff: catalogZones().staff });
    const { zones } = catalogZones();
    const angles = zoneStartAngles(zones.map((z) => zoneWeight(z.tools.length)));
    const meshes = sceneObjects().filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    const carpetInner = SCENE_METRICS.rooms.carpetInnerRadius;
    const carpets = meshes.filter(
      (m) =>
        (m.geometry as THREE.RingGeometry).type === 'RingGeometry' &&
        (m.geometry as THREE.RingGeometry).parameters.innerRadius === carpetInner,
    );
    expect(carpets.length).toBe(zones.length);
    const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    for (let i = 0; i < carpets.length; i++) {
      const g = carpets[i].geometry as RingGeometry;
      const p = g.parameters;
      // RingGeometry zeichnet Theta CCW ab +X; die Szene kippt den Ring um -90°
      // (Welt-Z = -sin θ). Der Teppich der Station i deckt exakt ihren Sektor:
      // thetaStart = -Grenze(i), Länge = proportionaler Sektorwinkel.
      expect(norm(p.thetaStart)).toBeCloseTo(norm(-roomBoundaryAngle(angles, i)), 8);
      expect(p.thetaLength).toBeCloseTo(zoneSectorAngle(angles, i), 8);
      // Die Teppich-Mitte zeigt exakt auf die Station des Sektors (Sektormitte).
      const midTheta = p.thetaStart + p.thetaLength / 2;
      expect(norm(midTheta)).toBeCloseTo(norm(-stationAngle(angles, i)), 8);
    }
  });

  it('baut keine Pillar für ausgeblendete Zonen (nur nutzerorientierte Räume)', () => {
    buildScene();
    const { zones } = catalogZones();
    const n = zones.length;
    // Identität als reine Keycloak-Zone und infrastructure (argocd) fallen weg —
    // es gibt nur noch n echte Nutzer-Räume (n < Gesamtzonen des Katalogs).
    const allZones = buildUserZones(getConfig()).length;
    expect(allZones).toBeGreaterThan(n);
    const meshes = sceneObjects().filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    const wallH = SCENE_METRICS.rooms.wallHeight;
    const walls = meshes.filter(
      (m) => (m.geometry as THREE.BoxGeometry).type === 'BoxGeometry' && (m.geometry as THREE.BoxGeometry).parameters.height === wallH,
    );
    expect(walls.length).toBe(n);
  });

  it('Staff-Tools erscheinen im Fächer vor der Staff-Station', () => {
    const { staff } = catalogZones();
    const count = staff?.tools.length ?? 0;
    expect(count).toBeGreaterThan(0);
    buildScene();
    const groups = sceneObjects().filter((o): o is THREE.Group => o instanceof THREE.Group);
    const staffTools = groups.filter((g) => {
      const dist = Math.hypot(g.position.x, g.position.z);
      if (Math.abs(dist - 2.6) >= 1e-6) return false; // Staff-Tool-Ring
      return g.position.z < 0; // hinter dem Desk
    });
    expect(staffTools.length).toBe(count);
    // Positionen folgen der Staff-Fächer-Formel.
    for (let i = 0; i < count; i++) {
      const p = staffToolPosition(i, count);
      expect(
        staffTools.some((g) => Math.abs(g.position.x - p.x) < 1e-6 && Math.abs(g.position.z - p.z) < 1e-6),
      ).toBe(true);
    }
  });

  it('entfernt die schwarze Raum-Hülle (keine Wände, keine Decke — offener Blick)', () => {
    const { room } = SCENE_METRICS;
    buildScene();
    const meshes = sceneObjects().filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    const planes = meshes.filter(
      (m) => (m.geometry as THREE.PlaneGeometry).type === 'PlaneGeometry',
    );
    // Nur noch der Boden ist eine Plane (keine Rück-/Front-/Seitenwände, keine Decke).
    expect(planes.length).toBe(1);
    expect((planes[0].geometry as THREE.PlaneGeometry).parameters.height).toBeCloseTo(room.depth, 6);
    // Nichts mehr schwebt auf Deckenhöhe (ansonsten: Leinwand/Fenster übrig).
    expect(
      meshes.some((m) => Math.abs(m.position.y - room.height) < 1e-6),
    ).toBe(false);
    // Wände wären PlaneGeometry mit Wandhöhe H — keine davon existiert mehr.
    expect(
      planes.some((m) => (m.geometry as THREE.PlaneGeometry).parameters.height === room.height),
    ).toBe(false);
  });

  it('exponiert Kamera-Interaktionen (resetView/focusZone) — kein Wurf im Ruhezustand', () => {
    const handle = buildScene();
    expect(handle).not.toBeNull();
    expect(typeof handle!.resetView).toBe('function');
    expect(typeof handle!.focusZone).toBe('function');
    // Im Stub-Modus (kein Frame-Loop) muessen beide ohne Wurf aufrufbar sein.
    expect(() => handle!.resetView()).not.toThrow();
    expect(() => handle!.focusZone(catalogZones().zones[0].id)).not.toThrow();
  });
});
