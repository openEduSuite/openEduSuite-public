// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Writer.tsx — minimale Writer-Oberflaeche fuer die AI-Writer-Personas (P-05).
//
// Bewusst OHNE LLM-Anbindung: Die Seite zeigt nur die validierte Registry
// (src/data/personas.ts) — Rolle, Stimme, Regeln und Beispieltext der
// gewaehlten Persona. Die Auswahl ist per Deeplink teilbar:
//   /writer?persona=<id>
// Der URL-Zugriff laeuft ueber den generischen URL-Filter-Contract aus
// T-PRS-06 (`src/lib/useFilterState.ts`): Writer meldet den Schluessel
// `persona` deklarativ an und normiert ihn per `enumOf` auf die aktivierten
// Registry-IDs. Unbekannte persona-IDs fallen damit weg (Standard-Persona,
// URL wird korrigiert); fremde Query-Parameter bleiben erhalten.
//
// P3-3 (LiteLLM AI-Gateway): Zusätzlich gibt es eine OPTIONALE
// „Generieren"-Aktion. Sie nutzt ausschließlich den relativen, same-origin
// Pfad `/api/ai/generate` (`./writerGenerate.ts` → Backend
// `server/ai-generate.mjs` → LiteLLM). Der System-Prompt kommt aus der
// Registry (`buildPersonaSystemPrompt`), Keys/URLs des Gateways bleiben
// serverseitig. Schlägt der Aufruf fehl, wird die Aktion gesperrt und ein
// Hinweis angezeigt — die Registry-Ansicht (Rolle, Stimme, Regeln, Beispiel)
// bleibt vollständig ohne LLM nutzbar.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEnabledPersonas, type Persona } from '../data/personas';
import { enumOf, type FilterKeyRule } from '../lib/filter';
import { useFilterState } from '../lib/useFilterState';
import { generatePersonaText } from './writerGenerate';

/** Seiten-Anmeldung am URL-Filter-Contract: `?persona=<registry-id>`. */
const PERSONA_KEY = 'persona';

function Writer() {
  const { t } = useTranslation();
  const personas = getEnabledPersonas();

  // Contract-Regel: nur aktivierte Registry-IDs sind gueltige Werte.
  // Die Registry ist statisch (Modul-Daten), daher ist die Regel stabil.
  const personaRule: FilterKeyRule = {
    key: PERSONA_KEY,
    normalize: enumOf(personas.map((p) => p.id)),
  };

  // URL-Filter-Contract inkl. popstate/hashchange-Sync (T-PRS-06).
  const { filter, replace } = useFilterState({ keys: [personaRule] });
  const urlPersona = filter[PERSONA_KEY];

  // Unbekannte/fehlende persona-ID faellt auf die Standard-Persona zurueck.
  const selected: Persona | undefined =
    personas.find((p) => p.id === urlPersona) ?? personas[0];

  // Normierung: der Deeplink bekommt immer die aktuelle Auswahl, damit er
  // teilbar ist (replace — keine History-Spam-Eintraege).
  useEffect(() => {
    if (!selected) return;
    if (urlPersona === selected.id) return;
    replace({ ...filter, [PERSONA_KEY]: selected.id });
  }, [filter, urlPersona, selected, replace]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) return;
    // Persona-Wechsel: alter Fehler/altes Ergebnis gehoeren zur alten Persona.
    setFailed(false);
    setGenerated(null);
    replace({ ...filter, [PERSONA_KEY]: e.target.value });
  };

  // ---- Optionale Generierung via Portal-Backend (/api/ai/generate) -------
  // Alles hier ist progressiv: Ohne Gateway (oder bei Fehler) bleibt die
  // Registry-Ansicht unberührt, die Aktion wird gesperrt + Hinweis angezeigt.
  const [draft, setDraft] = useState('');
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Laengst laufende Anfrage abbrechen, wenn die Seite verlassen wird.
  useEffect(() => () => abortRef.current?.abort(), []);

  const draftReady = draft.trim() !== '';
  const canGenerate = draftReady && !busy && !failed;

  const onDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    // Neue Eingabe = neuer Versuch erlaubt (Sperr-Hint zuruecksetzen).
    setFailed(false);
  };

  const onGenerate = async () => {
    if (!selected || !canGenerate) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setBusy(true);
    setGenerated(null);
    try {
      const text = await generatePersonaText({
        persona: selected,
        text: draft,
        signal: controller.signal,
      });
      setGenerated(text);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      setFailed(true);
      setGenerated(null);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const generateHint = failed
    ? t('writer.generateError', {
        defaultValue:
          'Generierung nicht verfügbar — das KI-Gateway ist nicht erreichbar. Passe den Entwurf an, um es erneut zu versuchen.',
      })
    : !draftReady
      ? t('writer.generateEmptyHint', {
          defaultValue: 'Entwurf eingeben, dann generieren.',
        })
      : null;

  if (!selected) return null;

  return (
    <main data-testid="writer-page" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{t('writer.title')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{t('writer.subtitle')}</p>

      <div className="mt-6">
        <label
          htmlFor="writer-persona-select"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {t('writer.selectLabel')}
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <select
            id="writer-persona-select"
            data-testid="writer-persona-select"
            value={selected.id}
            onChange={onChange}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:flex-1"
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.nameKey)}
              </option>
            ))}
          </select>
          {/* Generieren-Aktion direkt neben der Persona-Auswahl (P3-3). Ohne
              Gateway/funktionsunfähig: disabled + Hinweis (siehe unten). */}
          <button
            type="button"
            data-testid="writer-generate-button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-slate-50 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {busy
              ? t('writer.generateBusy', { defaultValue: 'Generiere …' })
              : t('writer.generate', { defaultValue: 'Generieren' })}
          </button>
        </div>
        {generateHint !== null && (
          <p
            data-testid="writer-generate-hint"
            role={failed ? 'alert' : undefined}
            className={
              failed
                ? 'mt-2 text-sm text-red-700 dark:text-red-400'
                : 'mt-2 text-sm text-slate-500 dark:text-slate-400'
            }
          >
            {generateHint}
          </p>
        )}

        {/* Optionale Generierung: Entwurf + Ergebnis. Der Aufruf laeuft NUR
            gegen den relativen Pfad /api/ai/generate — keine Gateway-URL und
            kein Key im SPA (siehe ./writerGenerate.ts). */}
        <label
          htmlFor="writer-generate-input"
          className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {t('writer.generateInputLabel', { defaultValue: 'Entwurf' })}
        </label>
        <textarea
          id="writer-generate-input"
          data-testid="writer-generate-input"
          rows={6}
          value={draft}
          onChange={onDraftChange}
          placeholder={t('writer.generatePlaceholder', {
            defaultValue: 'Rohtext oder Stichpunkte …',
          })}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {generated !== null && (
          <div
            data-testid="writer-generate-result"
            className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('writer.generateResultLabel', { defaultValue: 'Generierter Text' })}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-slate-900 dark:text-slate-100">
              {generated}
            </p>
          </div>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          {t(selected.nameKey)}
        </h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('writer.role')}
            </dt>
            <dd data-testid="writer-role" className="mt-1 text-slate-900 dark:text-slate-100">
              {selected.role}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('writer.tone')}
            </dt>
            <dd data-testid="writer-tone" className="mt-1 text-slate-900 dark:text-slate-100">
              {selected.tone}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('writer.rules')}
            </dt>
            <dd className="mt-1">
              <ul
                data-testid="writer-rules"
                className="list-disc space-y-1 pl-5 text-slate-900 dark:text-slate-100"
              >
                {selected.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('writer.example')}
            </dt>
            <dd
              data-testid="writer-example"
              className="mt-1 rounded-md bg-slate-50 p-3 italic text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            >
              {selected.example}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default Writer;
