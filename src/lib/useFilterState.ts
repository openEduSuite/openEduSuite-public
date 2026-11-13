// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// useFilterState.ts — React-Adapter für den generischen URL-Filter-Contract
// (Strom F + T-PRS-06). Reagiert auf popstate/hashchange (Zurück/Vorwärts,
// manuelle URL) und stellt push/replace/reset bereit. Der Hook ist für
// BELIEBIGE Seiten wiederverwendbar (keine Home-Spezifika): eine Seite
// meldet eigene Schlüssel deklarativ an (`keys`), ohne filter.ts-Interna
// zu kennen. Framework-frei im Kern (filter.ts), dieser Hook ist nur der
// dünne React-Aufsatz — portierbar auf jede andere Oberfläche (z. B.
// Landscape) mit demselben URL-Vertrag.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFilterContract, type FilterContract, type FilterKeyRule, type FilterState } from './filter';

const EMPTY_KEYS: readonly FilterKeyRule[] = [];

/** Optionen: zusätzliche Schlüssel, die diese Seite am Contract anmeldet. */
export interface UseFilterStateOptions {
  keys?: readonly FilterKeyRule[];
}

export interface FilterControls {
  /** Aktueller, normierter Filter-Zustand (aus der URL). */
  filter: FilterState;
  /** Der von dieser Seite genutzte Contract (Kern-Whitelist + eigene Schlüssel). */
  contract: FilterContract;
  /** Filter als neuen History-Eintrag schreiben (pushState) und state aktualisieren. */
  push: (f: FilterState) => void;
  /** Filter ohne History-Eintrag schreiben (replaceState) und state aktualisieren. */
  replace: (f: FilterState) => void;
  /** Filter auf den leeren Zustand zurücksetzen (replace; fremde Parameter bleiben). */
  reset: () => void;
  /** Filter aus der aktuellen window.location erneut einlesen. */
  refresh: () => void;
}

export function useFilterState(options: UseFilterStateOptions = {}): FilterControls {
  const extraKeys = options.keys ?? EMPTY_KEYS;
  // Stabile Signatur statt Array-Identität: Inline-Deklarationen bleiben
  // über Re-Renders derselbe Contract.
  const keySignature = extraKeys.map((r) => r.key).join('\u0000');
  const contract = useMemo(
    () => createFilterContract(extraKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keySignature],
  );

  const [filter, setFilter] = useState<FilterState>(() => contract.read());

  const write = useCallback(
    (f: FilterState, mode: 'push' | 'replace') => {
      contract.apply(f, { mode });
      // Zustand über den gemeinsamen Codepfad normieren (parse∘serialize),
      // damit state und URL nie auseinanderlaufen.
      setFilter(contract.normalize(f));
    },
    [contract],
  );

  const push = useCallback((f: FilterState) => write(f, 'push'), [write]);
  const replace = useCallback((f: FilterState) => write(f, 'replace'), [write]);
  const reset = useCallback(() => write({}, 'replace'), [write]);

  const refresh = useCallback(() => {
    setFilter(contract.read());
  }, [contract]);

  // Ändert die Seite ihre Schlüssel-Deklaration zur Laufzeit (neuer Contract),
  // wird der Zustand neu aus der URL gelesen — Deklaration und Zustand laufen
  // nie auseinander (Erweiterbarkeits-Anforderung des Contracts).
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onPop = () => refresh();
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, [refresh]);

  return { filter, contract, push, replace, reset, refresh };
}
