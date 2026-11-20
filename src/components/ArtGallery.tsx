// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// ArtGallery.tsx — Kunstgalerie der öffentlichen Landing-Seite.
//
// Statt des einzelnen Posters zeigt die öffentliche Landing eine Galerie
// leichtgewichtiger SVG-Poster im Stil großer Künstler:innen. Sie rotiert
// automatisch (Crossfade), pausiert bei Hover/Fokus und ist per Pfeilen +
// Punkten manuell navigierbar — vollständig ohne three.js/WebGL.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ArtPiece {
  /** Pfad zur SVG-Ressource unter /brand/… */
  src: string;
  /** Künstler:in bzw. Stil (für aria-label/Alt-Text). */
  artist: string;
  /** Alt-Text (Screenreader). */
  alt: string;
}

/** Galerie-Reihenfolge: Picasso zuerst (bleibt das «Projektübersicht»-Poster). */
export const ART_PIECES: ArtPiece[] = [
  {
    src: '/brand/landing-overview.svg',
    artist: 'Pablo Picasso',
    alt: 'openEduSuite — Projektübersicht (Kubismus nach Pablo Picasso): ein Login für Mail, Chat, Cloud, Video, Dokumente, Kalender, Identität und KI',
  },
  {
    src: '/brand/art/mondrian.svg',
    artist: 'Piet Mondrian',
    alt: 'openEduSuite — digitale Arbeitsplätze als Neoplastizismus nach Piet Mondrian',
  },
  {
    src: '/brand/art/kandinsky.svg',
    artist: 'Wassily Kandinsky',
    alt: 'openEduSuite — digitale Arbeitsplätze als konkrete Kunst nach Wassily Kandinsky',
  },
  {
    src: '/brand/art/matisse.svg',
    artist: 'Henri Matisse',
    alt: 'openEduSuite — digitale Arbeitsplätze als Fauvismus und Scherenschnitte nach Henri Matisse',
  },
  {
    src: '/brand/art/vangogh.svg',
    artist: 'Vincent van Gogh',
    alt: 'openEduSuite — digitale Arbeitsplätze als Post-Impressionismus nach Vincent van Gogh',
  },
];

export const SLIDE_MS = 7000;

interface ArtGalleryProps {
  /** Auto-Rotations-Intervall in Millisekunden (Tests kürzen es nicht — Fake-Timer). */
  intervalMs?: number;
}

export default function ArtGallery({ intervalMs = SLIDE_MS }: ArtGalleryProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-Rotation: `active` in den Deps setzt den Timer nach jeder manuellen
  // Navigation zurück (voller Takt bis zum nächsten automatischen Wechsel).
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () => setActive((a) => (a + 1) % ART_PIECES.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [paused, intervalMs, active]);

  const show = (i: number) => setActive((i + ART_PIECES.length) % ART_PIECES.length);

  return (
    <div
      data-testid="art-gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label={t('art.galleryLabel')}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative mx-auto w-full max-w-[840px]" style={{ aspectRatio: '1680 / 1040' }}>
        {ART_PIECES.map((piece, i) => {
          const isActive = i === active;
          return (
            <img
              key={piece.src}
              src={piece.src}
              alt={piece.alt}
              aria-hidden={!isActive}
              data-testid={`art-slide-${i}`}
              className={`absolute inset-0 h-full w-full rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            />
          );
        })}
      </div>
      <div className="mx-auto mt-3 flex max-w-[840px] items-center justify-center gap-3">
        <button
          type="button"
          data-testid="art-prev"
          aria-label={t('art.prev')}
          onClick={() => show(active - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white/70 text-lg leading-none text-gray-700 hover:bg-white dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ‹
        </button>
        <div className="flex items-center gap-2" role="group" aria-label={t('art.galleryLabel')}>
          {ART_PIECES.map((piece, i) => (
            <button
              key={piece.src}
              type="button"
              data-testid={`art-dot-${i}`}
              aria-label={t('art.slide', { n: i + 1, total: ART_PIECES.length })}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => show(i)}
              title={piece.artist}
              className={`h-2.5 rounded-full transition-all ${
                i === active
                  ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                  : 'w-2.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          data-testid="art-next"
          aria-label={t('art.next')}
          onClick={() => show(active + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white/70 text-lg leading-none text-gray-700 hover:bg-white dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ›
        </button>
      </div>
    </div>
  );
}
