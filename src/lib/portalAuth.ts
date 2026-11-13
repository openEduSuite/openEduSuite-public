// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// portalAuth.ts — einmalige same-origin Abfrage des Admin-Gruppen-Nachweises.
//
// Die Portal-Nginx-exponierte Route /api/me spiegelt den oauth2-proxy-Header
// `X-Auth-Request-Groups` (URL-codierte Gruppenpfade, z. B. %2Fportal-admins).
// Diese Datei dekodiert die Gruppen und leitet `isAdmin` ausschließlich daraus
// ab — progressiv: jeder Fehler (Netz, HTTP-Status, Timeout, Parse) ergibt
// `isAdmin = false` und es wird niemals geworfen.

import { useEffect, useState } from 'react';

/** Die Keycloak-Gruppe, deren Mitglieder den Admin-Arbeitsbereich sehen. */
export const ADMIN_GROUP = '/portal-admins';

export interface PortalMe {
  groups: string[];
}

export interface PortalAuthState {
  groups: string[];
  isAdmin: boolean;
}

export const EMPTY_AUTH: PortalAuthState = { groups: [], isAdmin: false };

/**
 * URL-decoden eines oauth2-proxy-Gruppenpfads. oauth2-proxy liefert Gruppen
 * URL-codiert (`%2Fportal-admins` → `/portal-admins`); sowohl codierte als
 * auch bereits decodierte Pfade sind gültig. Kaputte Prozent-Sequenzen bleiben
 * unverändert (kein throw).
 */
export function decodeGroup(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** isAdmin = Gruppenliste enthält exakt den Admin-Gruppenpfad (nach Dekodierung). */
export function isAdminFromGroups(groups: readonly string[]): boolean {
  return groups.includes(ADMIN_GROUP);
}

/**
 * Robust typisierte Auswertung der /api/me-Antwort. Fehlt `groups` oder hat
 * eine andere Form, gilt: leere Gruppenliste, isAdmin=false.
 */
export function parseMe(body: unknown): PortalAuthState {
  if (typeof body !== 'object' || body === null) return { groups: [], isAdmin: false };
  const raw = (body as { groups?: unknown }).groups;
  if (!Array.isArray(raw)) return { groups: [], isAdmin: false };
  const groups = raw.map((g) => decodeGroup(String(g)));
  return { groups, isAdmin: isAdminFromGroups(groups) };
}

/**
 * Einmalige frische GET /api/me-Abfrage (same-origin). Nimmt optional einen
 * externen AbortSignal entgegen (Abbruch/Timeout von außen). Wirft nie:
 * Netzwerk-, HTTP- oder Parse-Fehler ergeben `isAdmin=false`.
 */
export async function fetchPortalAuth(signal?: AbortSignal): Promise<PortalAuthState> {
  try {
    const res = await fetch('/api/me', { cache: 'no-store', signal });
    if (!res.ok) return { groups: [], isAdmin: false };
    const body: unknown = await res.json().catch(() => undefined);
    return parseMe(body);
  } catch {
    return { groups: [], isAdmin: false };
  }
}

let cached: Promise<PortalAuthState> | null = null;

/** Einmaliger Abruf beim Boot: der zweite Aufrufer erhält dasselbe Promise. */
export function getPortalAuth(): Promise<PortalAuthState> {
  if (!cached) cached = fetchPortalAuth();
  return cached;
}

/** Tests: Cache zurücksetzen, damit jeder Fall frisch abgefragt wird. */
export function resetPortalAuthCache(): void {
  cached = null;
}

export interface UsePortalAuthResult {
  loading: boolean;
  groups: string[];
  isAdmin: boolean;
  state: PortalAuthState;
}

/**
 * React-Hook: löst den einmaligen /api/me-Abruf aus (Modul-Cache) und gibt
 * den abgeleiteten Admin-Status aus. Während `loading` ist noch keine
 * Aussage möglich — die UI rendert ohne Admin-Einträge (progressiv).
 */
export function usePortalAuth(): UsePortalAuthResult {
  const [state, setState] = useState<PortalAuthState>({ groups: [], isAdmin: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPortalAuth()
      .then((s) => {
        if (!cancelled) {
          setState(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ groups: [], isAdmin: false });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, groups: state.groups, isAdmin: state.isAdmin, state };
}
