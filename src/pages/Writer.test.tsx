import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import Writer from './Writer';
import { PERSONAS } from '../data/personas';

function urlParam(): string | null {
  return new URLSearchParams(window.location.search).get('persona');
}

function renderWriter() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Writer />
    </I18nextProvider>,
  );
}

/** fetch-Stub fuer die Generierungs-Aktion (kein echter Netzwerk-Call). */
function stubGenerateFetch(impl: () => Promise<unknown>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('Writer-Seite (AI-Writer-Personas, ohne LLM)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    window.history.replaceState(null, '', '/writer');
  });

  it('listet die aktivierten Personas der Registry zur Auswahl', () => {
    renderWriter();
    const select = screen.getByTestId('writer-persona-select') as HTMLSelectElement;
    const options = [...select.querySelectorAll('option')].map((o) => o.value);
    for (const p of PERSONAS.filter((x) => x.enabled)) {
      expect(options).toContain(p.id);
    }
    expect(options.length).toBeGreaterThanOrEqual(4);
  });

  it('zeigt Rolle, Stimme, Regeln und Beispiel und teilt die Auswahl per ?persona=<id>', () => {
    renderWriter();
    const select = screen.getByTestId('writer-persona-select') as HTMLSelectElement;
    const target = PERSONAS.find((p) => p.id === 'didaktik')!;

    fireEvent.change(select, { target: { value: target.id } });

    expect((screen.getByTestId('writer-role') as HTMLElement).textContent).toBe(target.role);
    expect((screen.getByTestId('writer-tone') as HTMLElement).textContent).toBe(target.tone);
    const rules = [...(screen.getByTestId('writer-rules') as HTMLElement).querySelectorAll('li')].map(
      (li) => li.textContent,
    );
    expect(rules).toEqual(target.rules);
    expect((screen.getByTestId('writer-example') as HTMLElement).textContent).toBe(target.example);
    // Auswahl ist per Deeplink teilbar.
    expect(urlParam()).toBe(target.id);
  });

  it('waehlt die Persona aus dem Deeplink ?persona=<id> vor', () => {
    window.history.replaceState(null, '', '/writer?persona=studierenden-service');
    renderWriter();
    const select = screen.getByTestId('writer-persona-select') as HTMLSelectElement;
    expect(select.value).toBe('studierenden-service');
    expect((screen.getByTestId('writer-role') as HTMLElement).textContent).toBe(
      PERSONAS.find((p) => p.id === 'studierenden-service')!.role,
    );
  });

  it('ignoriert/normiert unbekannte persona-IDs auf die Standard-Persona', () => {
    window.history.replaceState(null, '', '/writer?persona=gibt-es-nicht');
    renderWriter();
    const select = screen.getByTestId('writer-persona-select') as HTMLSelectElement;
    const enabled = PERSONAS.filter((p) => p.enabled);
    expect(select.value).toBe(enabled[0].id);
    // Unbekannter Wert wird aus der URL normiert (nicht teilbar/unbenutzbar).
    expect(urlParam()).toBe(enabled[0].id);
  });

  it('erhaelt fremde Query-Parameter bei der Auswahl', () => {
    window.history.replaceState(null, '', '/writer?foo=bar');
    renderWriter();
    const select = screen.getByTestId('writer-persona-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'oeffentlichkeit' } });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('persona')).toBe('oeffentlichkeit');
    expect(params.get('foo')).toBe('bar');
  });
});

// ---------------------------------------------------------------------------
// P3-3 — optionale „Generieren"-Aktion ueber /api/ai/generate (LiteLLM).
// Die Registry-Ansicht bleibt ohne LLM vollstaendig nutzbar; schlaegt der
// Gateway-Aufruf fehl, wird die Aktion gesperrt und ein Hinweis angezeigt.
// ---------------------------------------------------------------------------

describe('Writer-Seite: Generieren-Aktion (KI-Gateway, optional)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    window.history.replaceState(null, '', '/writer');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const generateButton = () =>
    screen.getByTestId('writer-generate-button') as HTMLButtonElement;

  it('bietet die Generieren-Aktion neben der Persona-Auswahl — ohne Entwurf gesperrt mit Hinweis', () => {
    stubGenerateFetch(async () => ({ ok: true, status: 200, json: async () => ({ text: 'x' }) }));
    renderWriter();

    expect(screen.getByTestId('writer-generate-button')).toBeTruthy();
    expect(generateButton().disabled).toBe(true);
    expect((screen.getByTestId('writer-generate-hint') as HTMLElement).textContent).toContain(
      'Entwurf eingeben',
    );
  });

  it('generiert ueber den relativen Pfad /api/ai/generate und zeigt das Ergebnis', async () => {
    const mock = stubGenerateFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Generierter Text' }),
    }));
    renderWriter();

    fireEvent.change(screen.getByTestId('writer-generate-input'), {
      target: { value: 'Gruppenlaufwerke migrieren' },
    });
    expect(generateButton().disabled).toBe(false);
    fireEvent.click(generateButton());

    await waitFor(() => {
      expect((screen.getByTestId('writer-generate-result') as HTMLElement).textContent).toContain(
        'Generierter Text',
      );
    });

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/generate');
    expect(init.method).toBe('POST');
    // Kein Key im Request: nur der Content-Type-Header.
    expect(Object.keys(init.headers as Record<string, string>)).toEqual(['Content-Type']);
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    const target = PERSONAS.find((p) => p.id === 'cio-redakteur')!;
    expect(body.personaId).toBe(target.id);
    expect(body.systemPrompt).toContain(target.role);
    expect(body.systemPrompt).toContain(target.tone);
    expect(body.systemPrompt).toContain(target.rules[0]);
  });

  it('sperrt die Aktion mit klarem Hinweis, wenn /api/ai/generate fehlschlägt (503)', async () => {
    stubGenerateFetch(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'ai-gateway-not-configured' }),
    }));
    renderWriter();

    fireEvent.change(screen.getByTestId('writer-generate-input'), {
      target: { value: 'Entwurf' },
    });
    fireEvent.click(generateButton());

    await waitFor(() => {
      expect(generateButton().disabled).toBe(true);
    });
    const hint = screen.getByTestId('writer-generate-hint') as HTMLElement;
    expect(hint.textContent).toContain('Generierung nicht verfügbar');
    expect(screen.queryByTestId('writer-generate-result')).toBeNull();

    // Spec ai-writer-personas bleibt intakt: Registry-Ansicht ohne LLM sichtbar.
    const enabled = PERSONAS.filter((p) => p.enabled);
    expect((screen.getByTestId('writer-role') as HTMLElement).textContent).toBe(enabled[0].role);
    expect((screen.getByTestId('writer-example') as HTMLElement).textContent).toBe(
      enabled[0].example,
    );

    // Neuer Versuch nach Anpassung des Entwurfs ist wieder erlaubt.
    fireEvent.change(screen.getByTestId('writer-generate-input'), {
      target: { value: 'Entwurf, zweiter Versuch' },
    });
    expect(generateButton().disabled).toBe(false);
  });

  it('laesst die Seite ohne Gateway komplett funktionieren (kein fetch zu /api/me-artigen Abhängigkeiten)', () => {
    const mock = stubGenerateFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    renderWriter();

    // Nur Ansicht/Deeplink, kein Gateway-Call ohne Nutzeraktion.
    expect(mock).not.toHaveBeenCalled();
    expect((screen.getByTestId('writer-rules') as HTMLElement).querySelectorAll('li').length)
      .toBeGreaterThan(0);
  });
});
