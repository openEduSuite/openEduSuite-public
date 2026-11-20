// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// WorkplaceScene3D.tsx — lazy-geladener 3D-«Arbeitsplatz» (drei.js).
// Baut die Szene aus der Portal-Config (Katalog) und verdrahtet die
// Interaktion: Hover-Tooltip, Klick öffnet den Dienst bzw. selektiert die
// Zone (Deeplink-Filter). Enthält den Vollbild-/Vergrößerungsmodus, damit
// die Übersicht wie gewünscht «angeklickt und vergrößert» werden kann.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../../config';
import { buildUserZones, buildStaffZone } from '../../lib/catalog';
import { prefersReducedMotion } from './tuning';
import type { createWorkplaceScene } from './scene';
import type { SceneTool, SceneZone } from './scene';

interface Props {
  onZoneSelect?: (zoneId: string) => void;
}

interface HoverBox {
  kind: 'tool' | 'zone' | 'monument';
  text: string;
  color: string;
}

/**
 * Titel der Szene («Der digitale Arbeitsplatz»). Die Headline lebt als stabiles
 * DOM-Element über dem Canvas und kann deshalb von keinem 3D-Objekt verdeckt
 * werden. Der Text nutzt den i18n-Key `ui.overview.title`, sobald er in den
 * Locale-Dateien gepflegt ist, und fällt ansonsten auf diese harmonischen
 * Übersetzungen (de/en/fr/zh) zurück.
 */
const SCENE_TITLE_KEY = 'ui.overview.title';
const SCENE_TITLE: Record<string, string> = {
  de: 'Der digitale Arbeitsplatz',
  en: 'The digital workplace',
  fr: 'Le poste de travail numérique',
  zh: '数字化工作台',
};

function sceneTitle(t: (k: string) => string, lang: string | undefined): string {
  const translated = t(SCENE_TITLE_KEY);
  if (translated && translated !== SCENE_TITLE_KEY) return translated;
  return SCENE_TITLE[lang ?? 'de'] ?? SCENE_TITLE.de;
}

/**
 * Titel des Staff-Kreises («Verwaltung & Support»). Gleiches Muster wie die
 * Szenen-Headline: i18n-Key mit Sprach-Fallback (de/en/fr/zh).
 */
const STAFF_TITLE_KEY = 'category.staff';
const STAFF_TITLE: Record<string, string> = {
  de: 'Verwaltung & Support',
  en: 'Administration & Support',
  fr: 'Administration et support',
  zh: '管理与支持',
};

export default function WorkplaceScene3D({ onZoneSelect }: Props) {
  const { t, i18n } = useTranslation();
  const title = sceneTitle(t, i18n.resolvedLanguage ?? i18n.language);
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<{
    dispose(): void;
    setAutoRotate(v: boolean): void;
    setEmbedded(embedded: boolean): void;
    resize(): void;
    resetView(): void;
    focusZone(zoneId: string): void;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState<HoverBox | null>(null);
  // T-PRS-08 #6: Ladezustand — der lazy-Chunk braucht einen Moment; statt einer
  // leeren Fläche erscheint ein dezenter Spinner, die Szene blendet sich danach
  // sanft ein (Fade aus, sobald reduced motion bevorzugt wird).
  const [sceneReady, setSceneReady] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'de';
  // Zonen/Staff werden bei Sprachwechsel NEU lokalisiert (Katalog-Labels + die
  // In-Szene-Labels sind Texturen aus dem Szenen-Build) — Schlüssel ist nur die
  // Sprache; `t` ist je Sprache stabil und dient nur der Übersetzung.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { zones, staff } = useMemo(() => {
    const cfg = getConfig();
    const toSceneZone = (z: { id: string; labelKey: string; icon: string; color: string; services: { id: string; icon: string; launchUrl: string }[] }): SceneZone => ({
      id: z.id,
      label: t(z.labelKey),
      icon: z.icon,
      color: z.color,
      tools: z.services.map((s) => {
        // Lokalisierter Werkzeugname (`services.<id>.name`) mit Fallback auf die
        // rohe Id — In-Szene-Label und Hover-Tooltip zeigen so „🔐 Keycloak
        // SSO“ statt „🔐 keycloak“. Fallback-Muster: t() liefert bei fehlendem
        // Key den Key selbst zurück (=== Prüfung).
        const serviceKey = `services.${s.id}.name`;
        const localized = t(serviceKey);
        const title = localized !== serviceKey ? localized : s.id;
        return {
          id: s.id,
          name: s.icon ? `${s.icon} ${title}` : title,
          zoneId: z.id,
          zoneColor: z.color,
          launchUrl: s.launchUrl,
        };
      }),
    });
    // Zwei Kreise: User-Apps (Themen-Kreise außen) + Staff-Apps (eigener innerer
    // Kreis «Verwaltung & Support»).
    const zones: SceneZone[] = buildUserZones(cfg).map(toSceneZone);
    const staffSrc = buildStaffZone(cfg);
    const staff: SceneZone | null = staffSrc ? toSceneZone(staffSrc) : null;
    if (staff) staff.label = t(STAFF_TITLE_KEY) !== STAFF_TITLE_KEY ? t(STAFF_TITLE_KEY) : (STAFF_TITLE[lang] ?? STAFF_TITLE.de);
    return { zones, staff };
  }, [lang]);
  const monumentLabel = t('ui.overview.monument');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let handle: Awaited<ReturnType<typeof createWorkplaceScene>> | null = null;
    let cancelled = false;

    (async () => {
      const { createWorkplaceScene } = await import('./scene');
      if (cancelled) return;
      handle = createWorkplaceScene(
        mount,
        zones,
        {
          onHover: (frag) => setHover(frag ? { kind: frag.kind, text: frag.text, color: frag.color } : null),
          onSelectTool: (tool: SceneTool) => {
            window.open(tool.launchUrl, '_blank', 'noopener,noreferrer');
          },
          onSelectZone: (zone: SceneZone) => {
            // Staff-Station hat keinen Katalog-Filter (id 'staff'); Klick gibt nur
            // visuelles Feedback — kein Deeplink, der den Filter leert.
            if (zone.id === 'staff') return;
            onZoneSelect?.(zone.id);
          },
        },
        // Eingebettete Vorschau rotiert dezenter als das Vollbild (T-PRS-08 #4).
        // `expanded` bewusst NICHT in den Deps: der Vollbild-Toggle baut die
        // Szene nicht neu (teuer: alle Label-Canvases + Texturen, Lade-Flash),
        // sondern wechselt das Rotationstempo per setEmbedded — zweiter Effekt.
        {
          embedded: !expanded,
          staff,
          monumentLabel,
        },
      );
      handleRef.current = handle;
      setSceneReady(true);
    })();

    return () => {
      cancelled = true;
      handle?.dispose();
      handleRef.current = null;
      setSceneReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, staff, monumentLabel]); // bei Sprach-/Katalog-Änderung neu aufbauen

  // Vollbild/Einbettung wechseln NUR das Rotationsprofil — kein Szenen-Neubau.
  useEffect(() => {
    handleRef.current?.setEmbedded(!expanded);
  }, [expanded]);

  // WICHTIG (Regressionsklasse): im Vollbild darf NIEMALS `relative` + `fixed`
  // gleichzeitig aktiv sein — im erzeugten CSS steht `.relative` NACHT `.fixed`
  // (gleiche Spezifität), also würde `position: relative` gewinnen, die Höhe auf
  // 0 kollabieren und die Szene verschwinden. Darum trennen wir die Klassen:
  // eingebettet = relative + feste Höhe, Vollbild = fixed + inset-0.
  const rootClass = expanded
    ? 'fixed inset-0 z-50 overflow-hidden rounded-none border-0'
    : 'relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg h-[420px] md:h-[560px]';

  return (
    <div className={rootClass}>
      {/* Stabile Headline über dem Canvas (T-PRS-04): DOM-Text statt In-Szene-
          Sprite, damit der Titel nie von 3D-Objekten verdeckt wird und auch im
          Vollbild lesbar bleibt. Im DOM vor dem Canvas-Mount (Lesereihenfolge),
          z-10 hebt sie über das absolute Canvas-Element. pointer-events-none
          => kein Orbit-Block. */}
      <h2
        data-testid="workplace-headline"
        className="pointer-events-none absolute left-4 top-3 z-10 max-w-[70%] rounded-lg bg-slate-900/55 px-3 py-1.5 text-sm sm:text-base font-semibold tracking-wide text-slate-100 backdrop-blur"
      >
        {title}
      </h2>

      <div
        ref={mountRef}
        data-testid="workplace-canvas"
        className={`absolute inset-0 ${
          reducedMotion ? '' : 'transition-opacity duration-700 ease-out'
        } ${sceneReady ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Ladezustand über dem Mount (T-PRS-08 #6): kein ruckartiges Erscheinen,
          kein leeres Panel während der lazy-Chunk laedt. */}
      {!sceneReady && (
        <div
          data-testid="workplace-loading"
          role="status"
          className="absolute inset-0 z-[5] flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px]"
        >
          <span
            aria-hidden="true"
            className={`h-9 w-9 rounded-full border-2 border-slate-600 border-t-sky-400 ${
              reducedMotion ? '' : 'animate-spin'
            }`}
          />
        </div>
      )}

      {/* Hover-Tooltip (oben mittig, wie Infoleisten der chemie-Lernlabore) */}
      {hover && !expanded && (
        <div
          className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-medium shadow-md"
          style={{ backgroundColor: 'rgba(8,13,28,0.85)', color: hover.color, border: `1px solid ${hover.color}55` }}
        >
          {hover.text}
        </div>
      )}

      {/* Bedienhinweis + Vergrößern-Knopf */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleRef.current?.resetView()}
          aria-label={t('ui.overview.reset')}
          title={t('ui.overview.reset')}
          data-testid="workplace-reset"
          className="rounded-lg bg-slate-900/70 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-slate-900/90"
        >
          {/* Zurück zur Übersicht (⟲): fährt die Kamera sanft zur Startposition. */}
          <span aria-hidden="true">⟲</span>
          <span className="ml-1 hidden sm:inline">{t('ui.overview.reset')}</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t('ui.overview.collapse') : t('ui.overview.expand')}
          aria-pressed={expanded}
          title={expanded ? t('ui.overview.collapse') : t('ui.overview.expand')}
          data-testid="workplace-toggle"
          className="rounded-lg bg-slate-900/70 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-slate-900/90"
        >
          {/* Expand (⤢) und Collapse (⤡) unterscheiden sich in Glyph UND Label. */}
          <span aria-hidden="true">{expanded ? '⤡' : '⤢'}</span>
          <span className="ml-1 hidden sm:inline">{expanded ? t('ui.overview.collapse') : t('ui.overview.expand')}</span>
        </button>
      </div>
      {!expanded && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/55 px-3 py-1 text-xs text-slate-200 backdrop-blur">
          {t('ui.overview.hint')}
        </div>
      )}
    </div>
  );
}

// Lazy-chunk-Import der Szene (oben als Typ; Instanz wird useEffect dynamisch geladen).
