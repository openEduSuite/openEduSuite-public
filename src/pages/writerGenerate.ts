// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// writerGenerate.ts — clientseitiger Aufruf des KI-Gateways fuer die
// Writer-UI (P3-3, LiteLLM AI-Gateway).
//
// Der Browser spricht NUR den relativen, same-origin Pfad
// `/api/ai/generate` an (Portal-Nginx/Node-Proxy, siehe
// `server/ai-generate.mjs`). Es gibt bewusst:
//   - KEINE Gateway-URL im Client (kein litellm.* Host im Bundle),
//   - KEINEN API-Key/API-Token (der Schluessel liegt ausschliesslich
//     serverseitig in LITELLM_KEY und verlaesst den Pod nie).
//
// Persona-Auswahl und System-Prompt bleiben in der Registry-Quelle
// (`src/data/personas.ts`, Single Source of Truth): Der Client baut den
// System-Prompt mit `buildPersonaSystemPrompt` und sendet ihn mit — der
// Server prueft und leitet nur an LiteLLM weiter. Damit existiert keine
// zweite (driftende) Persona-Kopie im Backend.
//
// Die UI bleibt ohne Gateway funktionsfaehig (Spec ai-writer-personas):
// Jeder Fehler wird als `GenerateError` zurueckgegeben und von der Writer-Seite
// als Hinweis + deaktivierte Aktion dargestellt.

import { buildPersonaSystemPrompt, type Persona } from '../data/personas';

/** Relativer, same-origin Endpunkt des Portal-Backends (nie absolut/extern). */
export const AI_GENERATE_ENDPOINT = '/api/ai/generate';

/** Fehlermarkierung, damit die UI unterscheiden kann: Gateway-Fehler vs. Bug. */
export const GENERATE_ERROR = 'writer-generate-failed';

/** Fehlerobjekt der Generierungs-Aktion (nie ein Roh-Fetch-Fehler). */
export class GenerateError extends Error {
  readonly kind = GENERATE_ERROR;
  /** HTTP-Status des Gateways (0 = Netzwerk-/Parse-Fehler). */
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'GenerateError';
    this.status = status;
  }
}

/** Auftrag fuer die Generierung: Persona (Registry) + Nutzertext. */
export interface GenerateRequest {
  persona: Persona;
  text: string;
  /** AbortController-Signal (z. B. Unmount der Writer-Seite). */
  signal?: AbortSignal;
  /** Injizierbarer fetch (Unit-Tests, kein echter Netzwerk-Call). */
  fetchImpl?: typeof fetch;
}

/** Body, den der Server an /api/ai/generate erwartet (siehe server/ai-generate.mjs). */
export interface GenerateBody {
  personaId: string;
  systemPrompt: string;
  text: string;
}

/**
 * Reiner Body-Bau — ohne Netz. Enthaelt ausschliesslich personaId,
 * systemPrompt (aus der Registry) und text; keine Authentifizierung, keine
 * Keys, keine Gateway-URL.
 */
export function buildGenerateBody(persona: Persona, text: string): GenerateBody {
  return {
    personaId: persona.id,
    systemPrompt: buildPersonaSystemPrompt(persona),
    text,
  };
}

/**
 * POST an das Portal-Backend (relativer Pfad). Liefert den generierten Text
 * aus `{ text }` zurueck. Wirft `GenerateError` bei Netz-/HTTP-/Parse-Fehler,
 * damit die Writer-UI progressiv degradieren kann (Hint + deaktivierte
 * Aktion) statt zu crashen.
 */
export async function generatePersonaText({
  persona,
  text,
  signal,
  fetchImpl,
}: GenerateRequest): Promise<string> {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new GenerateError('Kein Text zum Generieren angegeben');
  }

  const doFetch = fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(AI_GENERATE_ENDPOINT, {
      method: 'POST',
      // Absichtlich ohne Authorization-/X-Api-Key-Header: same-origin only.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGenerateBody(persona, trimmed)),
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new GenerateError('KI-Gateway nicht erreichbar', 0);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new GenerateError('Generierung abgelehnt', response.status);
  }

  const generated =
    payload !== null && typeof payload === 'object'
      ? (payload as { text?: unknown }).text
      : undefined;
  if (typeof generated !== 'string' || generated.trim() === '') {
    throw new GenerateError('Antwort des KI-Gateways unbrauchbar', response.status);
  }
  return generated;
}
