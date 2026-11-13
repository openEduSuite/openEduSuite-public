// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// portalAuth.test.ts — L1-Unit-Tests für den Admin-Gruppen-Nachweis (Variante 1).
// Vertrag (specs/admin-access): isAdmin = groups enthält `ADMIN_GROUP`;
// URL-Dekodierung (`%2Fportal-admins` → `/portal-admins`); jeder Fehler
// (HTTP-Status, Parse, Netz) ergibt `isAdmin=false` und es wird nie geworfen.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  decodeGroup,
  isAdminFromGroups,
  parseMe,
  fetchPortalAuth,
  getPortalAuth,
  resetPortalAuthCache,
  EMPTY_AUTH,
} from './portalAuth';

describe('decodeGroup', () => {
  it('dekodiert URL-codierte oauth2-proxy Gruppenpfade', () => {
    expect(decodeGroup('%2Fportal-admins')).toBe('/portal-admins');
  });

  it('lässt bereits dekodierte Pfade unverändert', () => {
    expect(decodeGroup('/portal-admins')).toBe('/portal-admins');
  });

  it('wirft bei kaputten Prozent-Sequenzen nicht, sondern behält den Rohwert', () => {
    expect(decodeGroup('%zz-broken')).toBe('%zz-broken');
    expect(() => decodeGroup('%')).not.toThrow();
  });
});

describe('isAdminFromGroups', () => {
  it('erkennt exakte Gruppenpfad-Mitgliedschaft', () => {
    expect(isAdminFromGroups(['/users', '/portal-admins'])).toBe(true);
  });

  it('lehnt nicht passende Gruppen ab', () => {
    expect(isAdminFromGroups(['/users', '/portal-admins-extra'])).toBe(false);
    expect(isAdminFromGroups([])).toBe(false);
  });

  it('normiert trailing Slashes nicht (exakte Pfadsemantik)', () => {
    expect(isAdminFromGroups(['/portal-admins/'])).toBe(false);
  });
});

describe('parseMe', () => {
  it('wertet gültige Gruppen mit URL-Dekodierung aus', () => {
    const state = parseMe({ groups: ['%2Fportal-admins', '/users'] });
    expect(state.isAdmin).toBe(true);
    expect(state.groups).toEqual(['/portal-admins', '/users']);
  });

  it('gibt leere Gruppen bei fehlendem groups-Feld', () => {
    expect(parseMe({})).toEqual(EMPTY_AUTH);
  });

  it('gibt leere Gruppen bei nicht-Array groups', () => {
    expect(parseMe({ groups: 'portal-admins' })).toEqual(EMPTY_AUTH);
    expect(parseMe({ groups: null })).toEqual(EMPTY_AUTH);
  });

  it('behandelt Nicht-Objekte als keine Admin-Gruppe', () => {
    expect(parseMe(null)).toEqual(EMPTY_AUTH);
    expect(parseMe('kaputt')).toEqual(EMPTY_AUTH);
    expect(parseMe(undefined)).toEqual(EMPTY_AUTH);
  });
});

describe('fetchPortalAuth', () => {
  beforeEach(() => {
    resetPortalAuthCache();
  });

  function stubFetch(impl: () => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(impl));
  }
  function jsonOk(body: unknown): Response {
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }
  function jsonNotOk(): Response {
    return { ok: false, status: 403, json: async () => ({}) } as unknown as Response;
  }

  it('liefert isAdmin=true wenn /api/me die Admin-Gruppe enthält', async () => {
    stubFetch(async () => jsonOk({ groups: ['%2Fportal-admins'] }));
    const state = await fetchPortalAuth();
    expect(state.isAdmin).toBe(true);
    expect(state.groups).toEqual(['/portal-admins']);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/me', expect.any(Object));
  });

  it('liefert isAdmin=false bei HTTP-Fehler (z. B. 403)', async () => {
    stubFetch(async () => jsonNotOk());
    expect(await fetchPortalAuth()).toEqual(EMPTY_AUTH);
  });

  it('liefert isAdmin=false bei Netzwerkfehler — wirft nie', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchPortalAuth()).resolves.toEqual(EMPTY_AUTH);
  });

  it('liefert isAdmin=false bei unparsebarem Body', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } }) as unknown as Response);
    expect(await fetchPortalAuth()).toEqual(EMPTY_AUTH);
  });

  it('kursiert das Ergebnis modular über getPortalAuth (ein Abruf beim Boot)', async () => {
    const impl = vi.fn(async () => jsonOk({ groups: ['/portal-admins'] }));
    stubFetch(impl);
    const a = await getPortalAuth();
    const b = await getPortalAuth();
    expect(a.isAdmin).toBe(true);
    expect(b).toBe(a);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('resetPortalAuthCache erzwingt eine frische Abfrage', async () => {
    const impl = vi.fn(async () => jsonOk({ groups: [] }));
    stubFetch(impl);
    await getPortalAuth();
    resetPortalAuthCache();
    await getPortalAuth();
    expect(impl).toHaveBeenCalledTimes(2);
  });
});
