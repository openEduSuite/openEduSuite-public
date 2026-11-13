// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// personas.ts — AI-Writer-Persona-Registry (Single Source, Praesentationsschicht P-05).
//
// Die Registry ist die einzige Quelle fuer Schreib-Personas des Portals:
// Rolle, Stimme/Ton, Schreibregeln und ein Beispieltext je Persona. Sie ist
// bewusst unabhaengig von jedem LLM-/Pipeline-System aufgebaut (Annahme A2,
// proposal.md); eine spaetere Schreib-Pipeline (z. B. n8n/LLM) konsumiert
// nur diese Struktur — siehe docs/ai-writer-personas.md.
//
// Schema (alle Felder Pflicht, `enabled` steuert die Sichtbarkeit):
//   id       Slug, eindeutig, ^[a-z0-9]+(-[a-z0-9]+)*$  → Deeplink ?persona=<id>
//   nameKey  i18n-Key fuer den Anzeigenamen (locales de/en/fr/zh)
//   role     Zielgruppe/Rolle der Persona (Deutsch, Inhaltstext)
//   tone     Stimme/Stil
//   rules    mindestens zwei Schreibregeln (nicht leer)
//   example  Beispieltext (Deutsch), der die Stimme demonstriert
//   enabled  boolean — nur aktivierte Personas erscheinen in der Writer-UI
//
// Validierung: `validatePersonas` prueft das Schema deterministisch (ohne
// i18n-Global); der Unit-Test personas.test.ts haelt die Registry gruen und
// beweist Duplikat-ID/leere Pflichtfelder als rot.

/** Eine Schreib-Persona der AI-Writer-Registry. */
export interface Persona {
  /** Eindeutiger Slug ( Deeplink-Parameter `persona`). */
  id: string;
  /** i18n-Key des Anzeigenamens, z. B. `writer.personas.cioRedakteur`. */
  nameKey: string;
  /** Rolle/Zielgruppe, z. B. „Entscheider-/CIO-Kommunikation". */
  role: string;
  /** Stimme/Ton der Persona. */
  tone: string;
  /** Schreibregeln (mindestens zwei, je nicht leer). */
  rules: string[];
  /** Beispieltext (Deutsch), der die Stimme zeigt. */
  example: string;
  /** Nur aktivierte Personas werden in der Writer-UI angeboten. */
  enabled: boolean;
}

/** Pflicht-Personas laut Spec (Zielgruppen-Abdeckung, siehe personas.test.ts). */
export const REQUIRED_PERSONA_IDS = [
  'cio-redakteur',
  'studierenden-service',
  'didaktik',
  'oeffentlichkeit',
] as const;

/**
 * Die Persona-Registry (Single Source of Truth). Reihenfolge = Reihenfolge
 * der Auswahl in der Writer-UI; die erste aktivierte Persona ist Standard.
 */
export const PERSONAS: readonly Persona[] = [
  {
    id: 'cio-redakteur',
    nameKey: 'writer.personas.cioRedakteur',
    role: 'Entscheider-Kommunikation: CIO-/IT-Leitung, Lenkungskreise, Budgetverantwortliche',
    tone: 'Sachlich, entscheidungsorientiert, ohne Marketing-Jargon',
    rules: [
      'Kurze Hauptsätze (maximal 15 Wörter), ein Gedanke pro Satz.',
      'Nutzen, Kosten und Risiken benennen; am Ende steht eine klare Entscheidungsempfehlung.',
      'Keine Superlative und keine Zahlen ohne Quelle.',
    ],
    example:
      'Die Migration der Gruppenlaufwerke senkt den Betriebsaufwand in zwei Stufen. Die Risiken bleiben beherrschbar. Wir empfehlen Stufe 1 zum Sommersemester und legen Stufe 2 nach der Auswertung fest.',
    enabled: true,
  },
  {
    id: 'studierenden-service',
    nameKey: 'writer.personas.studierendenService',
    role: 'Studierenden-Service: Studierende, Studienbüro, Studierendensekretariat',
    tone: 'Freundlich, direkt, auf Augenhöhe (Du-Form)',
    rules: [
      'Du-Form konsistent verwenden.',
      'Konkrete Schritte mit Frist angeben; Fachbegriffe beim ersten Auftreten erklären.',
      'Immer eine Kontaktmöglichkeit am Ende nennen.',
    ],
    example:
      'Du schreibst deine Abschlussarbeit und brauchst mehr Speicherplatz? Sende uns das Formular bis zum 15. des Monats, wir erweitern dein Konto innerhalb von drei Werktagen. Fragen? Schreib uns an studium@example.org.',
    enabled: true,
  },
  {
    id: 'didaktik',
    nameKey: 'writer.personas.didaktik',
    role: 'Didaktik: Lehrende, Hochschuldidaktik, E-Learning-Teams',
    tone: 'Fachlich, lernorientiert, ermutigend',
    rules: [
      'Das Lernziel zuerst nennen.',
      'Methoden und Werkzeuge immer an einem Seminar-Beispiel zeigen.',
      'Keine Werkzeug-Listen ohne didaktischen Kontext.',
    ],
    example:
      'Lernziel: Studierende kuratieren Literatur gemeinsam. Nutzen Sie dafür den geteilten Nextcloud-Ordner mit Markdown-Notizen. Ein 15-minütiges Einstiegsvideo zeigt das Setup am Beispiel eines Proseminars.',
    enabled: true,
  },
  {
    id: 'oeffentlichkeit',
    nameKey: 'writer.personas.oeffentlichkeit',
    role: 'Öffentlichkeitsarbeit: Presse, Website, Interessierte außerhalb der Hochschule',
    tone: 'Verständlich, offen, ohne Innenjargon',
    rules: [
      'Fachbegriffe beim ersten Auftreten erklären.',
      'Aktiv statt Passiv formulieren; ein Satz pro Gedanke.',
      'Aufzählungen statt Schachtelsätze.',
    ],
    example:
      'Die Universität betreibt ihre Kollaborationsplattform selbst. Alle Daten liegen in europäischen Rechenzentren unter deutschem Datenschutzrecht. Wer mag, nutzt die Dienste sofort mit dem Unikonto.',
    enabled: true,
  },
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Prueft eine Liste von Persona-Kandidaten gegen das Schema. Liefert eine
 * Liste menschenlesbarer Fehler zurueck — leer heisst gueltig. Duplikat-IDs
 * und leere Pflichtfelder sind Fehler (siehe personas.test.ts, rot-Beweis).
 */
export function validatePersonas(candidates: readonly unknown[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  candidates.forEach((c, index) => {
    const label = `personas[${index}]`;
    if (c === null || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`${label}: kein Persona-Objekt`);
      return;
    }
    const p = c as Record<string, unknown>;

    if (!isNonEmptyString(p.id)) {
      errors.push(`${label}.id: Pflichtfeld fehlt oder ist leer`);
    } else if (!SLUG.test(p.id)) {
      errors.push(`${label}.id: "${p.id}" ist kein Slug (a-z, 0-9, Bindestrich)`);
    } else if (seen.has(p.id)) {
      errors.push(`${label}.id: doppelte ID "${p.id}"`);
    } else {
      seen.add(p.id);
    }

    for (const field of ['nameKey', 'role', 'tone', 'example'] as const) {
      if (!isNonEmptyString(p[field])) {
        errors.push(`${label}.${field}: Pflichtfeld fehlt oder ist leer`);
      }
    }

    if (!Array.isArray(p.rules)) {
      errors.push(`${label}.rules: Pflichtfeld fehlt (Array erwartet)`);
    } else if (p.rules.length < 2) {
      errors.push(`${label}.rules: mindestens zwei Regeln erforderlich`);
    } else {
      p.rules.forEach((r, ri) => {
        if (!isNonEmptyString(r)) errors.push(`${label}.rules[${ri}]: Regel ist leer`);
      });
    }

    if (typeof p.enabled !== 'boolean') {
      errors.push(`${label}.enabled: boolean erwartet`);
    }
  });

  return errors;
}

/** Nur aktivierte Personas (für die Writer-UI). */
export function getEnabledPersonas(): Persona[] {
  return PERSONAS.filter((p) => p.enabled);
}
