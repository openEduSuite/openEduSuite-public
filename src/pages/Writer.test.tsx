import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
