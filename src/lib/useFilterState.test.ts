// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// useFilterState.test.ts — Vertragstests für den wiederverwendbaren
// Deeplink-/Filter-Hook (T-PRS-06). Der Hook ist seitenagnostisch: jede
// Seite (Home, Vergleich, Register, Landscape, Writer) kann ihn übernehmen
// und eigene Schlüssel deklarativ anmelden — ohne filter.ts-Interna zu kennen.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FILTER_KEYS, type FilterState } from './filter';
import { useFilterState } from './useFilterState';

const ORIG_URL = window.location.href;

function setUrl(path: string) {
  window.history.replaceState(null, '', path);
}

afterEach(() => {
  window.history.replaceState(null, '', ORIG_URL);
  vi.restoreAllMocks();
});

describe('useFilterState — wiederverwendbarer Hook (Contract T-PRS-06)', () => {
  it('liefert filter, push, replace und reset (Mindest-API für beliebige Seiten)', () => {
    setUrl('/');
    const { result } = renderHook(() => useFilterState());
    expect(result.current.filter).toEqual({});
    expect(typeof result.current.push).toBe('function');
    expect(typeof result.current.replace).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('liest den Filterzustand (inkl. service) beim Mount aus der URL', () => {
    setUrl('/?view=services&zone=communication&service=xwiki&theme=dark');
    const { result } = renderHook(() => useFilterState());
    expect(result.current.filter).toEqual({ view: 'services', zone: 'communication', service: 'xwiki' });
  });

  it('push schreibt pushState, aktualisiert URL und Zustand', () => {
    setUrl('/');
    const { result } = renderHook(() => useFilterState());
    const spy = vi.spyOn(window.history, 'pushState');
    act(() => result.current.push({ view: 'services', zone: 'knowledge', service: 'xwiki' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?view=services&zone=knowledge&service=xwiki');
    expect(result.current.filter).toEqual({ view: 'services', zone: 'knowledge', service: 'xwiki' });
  });

  it('replace schreibt replaceState (kein neuer History-Eintrag) und bleibt non-destructive', () => {
    setUrl('/?theme=dark');
    const { result } = renderHook(() => useFilterState());
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    act(() => result.current.replace({ q: 'mail', service: 'sogo' }));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?theme=dark&q=mail&service=sogo');
    expect(result.current.filter).toEqual({ q: 'mail', service: 'sogo' });
  });

  it('reset entfernt nur Contract-Parameter, fremde Parameter (theme) bleiben', () => {
    setUrl('/?view=services&zone=communication&service=xwiki&theme=dark');
    const { result } = renderHook(() => useFilterState());
    act(() => result.current.reset());
    expect(result.current.filter).toEqual({});
    expect(window.location.search).toBe('?theme=dark');
  });

  it('normiert unbekannte Werte beim Schreiben (service/view) — URL bleibt sauber', () => {
    setUrl('/');
    const { result } = renderHook(() => useFilterState());
    act(() => result.current.push({ service: 'not-in-catalog', view: 'bogus' } as unknown as FilterState));
    expect(window.location.search).toBe('');
    expect(result.current.filter).toEqual({});
  });

  it('reagiert auf popstate (Zurück/Vorwärts) und liest die URL erneut', () => {
    setUrl('/?zone=knowledge');
    const { result } = renderHook(() => useFilterState());
    expect(result.current.filter).toEqual({ zone: 'knowledge' });
    act(() => {
      window.history.replaceState(null, '', '/?zone=identity&service=bbb');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.filter).toEqual({ zone: 'identity', service: 'bbb' });
  });

  it('meldet seitenspezifische Schlüssel deklarativ an — ohne Modulumbau (persona, Writer P-05)', () => {
    setUrl('/?persona=cio');
    const { result } = renderHook(() => useFilterState({ keys: [{ key: 'persona' }] }));
    expect(result.current.filter).toEqual({ persona: 'cio' });
    act(() => result.current.push({ persona: 'cio', q: 'mail' }));
    // Bereits vorhandene Parameter behalten ihre Position (URLSearchParams-
    // Konvention), neue werden ergänzt — Inhalt und Teilbarkeit zählen.
    expect(window.location.search).toBe('?persona=cio&q=mail');
    // Kern-Schlüssel funktionieren im selben Contract weiter
    expect(result.current.contract.keys).toEqual(expect.arrayContaining([...FILTER_KEYS, 'persona']));
    expect(result.current.contract.parse('?persona=cio&service=xwiki')).toEqual({
      persona: 'cio',
      service: 'xwiki',
    });
  });

  it('Kontrakt-Instanz bleibt über Re-Renders stabil (gleiche key-Deklaration)', () => {
    setUrl('/');
    const keys = [{ key: 'persona' }];
    const { result, rerender } = renderHook(() => useFilterState({ keys }));
    const first = result.current.contract;
    rerender();
    expect(result.current.contract).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// T-PRS-06 (Erweiterung) — Erweiterbarkeit zur Laufzeit und Deeplink-Stabilität
// ---------------------------------------------------------------------------

describe('useFilterState — Erweiterbarkeit & Deeplink-Stabilität (T-PRS-06 Erweiterung)', () => {
  it('liest den Filter neu, wenn die Schlüssel-Deklaration zur Laufzeit wechselt', () => {
    setUrl('/?persona=cio&tab=ops&theme=dark');
    let keys: readonly { key: string }[] = [{ key: 'persona' }];
    const { result, rerender } = renderHook(() => useFilterState({ keys }));
    // tab ist noch nicht angemeldet → wird (korrekt) ignoriert
    expect(result.current.filter).toEqual({ persona: 'cio' });

    // Seite meldet 'tab' zusätzlich an → Zustand muss aus der URL neu gelesen
    // werden, sonst laufen Deklaration und Zustand auseinander.
    keys = [{ key: 'persona' }, { key: 'tab' }];
    rerender();
    expect(result.current.contract.keys).toEqual(expect.arrayContaining(['persona', 'tab']));
    expect(result.current.filter).toEqual({ persona: 'cio', tab: 'ops' });
  });

  it('Service-Deeplink beim Mount: Zustand gesetzt, URL bleibt unverändert teilbar', () => {
    setUrl('/?service=bbb&theme=dark');
    const { result } = renderHook(() => useFilterState());
    expect(result.current.filter).toEqual({ service: 'bbb' });
    // reines Lesen schreibt nichts in die Historie und lässt die URL unangetastet
    expect(window.location.search).toBe('?service=bbb&theme=dark');
    expect(new URLSearchParams(window.location.search).get('theme')).toBe('dark');
  });

  it('sequentielle Writes bleiben non-destructive über mehrere Schritte', () => {
    setUrl('/?theme=dark');
    const { result } = renderHook(() => useFilterState());
    act(() => result.current.replace({ view: 'services', zone: 'knowledge' }));
    expect(window.location.search).toBe('?theme=dark&view=services&zone=knowledge');
    act(() => result.current.push({ view: 'services', zone: 'knowledge', service: 'xwiki' }));
    expect(window.location.search).toBe('?theme=dark&view=services&zone=knowledge&service=xwiki');
    expect(new URLSearchParams(window.location.search).get('theme')).toBe('dark');
  });

  it('reset entfernt auch angemeldete Seitenschlüssel, fremde Parameter bleiben', () => {
    setUrl('/?persona=cio&q=mail&theme=dark');
    const { result } = renderHook(() => useFilterState({ keys: [{ key: 'persona' }] }));
    expect(result.current.filter).toEqual({ persona: 'cio', q: 'mail' });
    act(() => result.current.reset());
    expect(result.current.filter).toEqual({});
    expect(window.location.search).toBe('?theme=dark');
  });
});
