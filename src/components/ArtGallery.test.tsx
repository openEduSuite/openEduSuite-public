// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import ArtGallery, { ART_PIECES } from './ArtGallery';

const SLIDE_MS = 7000;

function renderGallery() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ArtGallery />
    </I18nextProvider>,
  );
}

describe('ArtGallery (öffentliche Landing)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('renders every art piece as a slide inside an accessible carousel region', () => {
    renderGallery();
    const region = screen.getByRole('region', { name: /gallery/i });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    const imgs = region.querySelectorAll('img');
    expect(imgs.length).toBe(ART_PIECES.length);
    // Picassos Poster bleibt als erste Folie erhalten.
    expect(imgs[0].getAttribute('src')).toBe('/brand/landing-overview.svg');
    // Die Folienliste enthält die vier Stil-Poster.
    for (const piece of ART_PIECES) {
      expect(piece.src).toMatch(/^\/brand\//);
    }
  });

  it('shows exactly the first piece (Picasso) as the active slide', () => {
    renderGallery();
    expect(screen.getByTestId('art-slide-0')).not.toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('art-slide-1')).toHaveAttribute('aria-hidden', 'true');
    // Screenreader sehen nur die aktive Folie.
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByTestId('art-dot-0')).toHaveAttribute('aria-current', 'true');
  });

  it('auto-advances to the next artist after the slide interval', () => {
    renderGallery();
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS + 50);
    });
    expect(screen.getByTestId('art-slide-0')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('art-slide-1')).not.toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('art-dot-1')).toHaveAttribute('aria-current', 'true');
  });

  it('navigates back and forth via the arrow buttons and resets the timer', () => {
    renderGallery();
    fireEvent.click(screen.getByTestId('art-next'));
    expect(screen.getByTestId('art-slide-1')).not.toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByTestId('art-next'));
    expect(screen.getByTestId('art-slide-2')).not.toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByTestId('art-prev'));
    expect(screen.getByTestId('art-slide-1')).not.toHaveAttribute('aria-hidden', 'true');
    // Nach manueller Navigation vergeht wieder ein voller Takt bis zur Auto-Rotation.
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS + 50);
    });
    expect(screen.getByTestId('art-slide-2')).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('jumps directly to the chosen piece via the dot indicators', () => {
    renderGallery();
    fireEvent.click(screen.getByTestId('art-dot-3'));
    expect(screen.getByTestId('art-slide-3')).not.toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('art-dot-3')).toHaveAttribute('aria-current', 'true');
  });

  it('wraps around at the ends of the gallery', () => {
    renderGallery();
    fireEvent.click(screen.getByTestId('art-prev'));
    expect(screen.getByTestId('art-slide-4')).not.toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByTestId('art-next'));
    expect(screen.getByTestId('art-slide-0')).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('pauses auto-rotation on hover and resumes on leave', () => {
    const { container } = renderGallery();
    const gallery = container.querySelector('[data-testid="art-gallery"]')!;
    fireEvent.mouseEnter(gallery);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 2);
    });
    expect(screen.getByTestId('art-slide-0')).not.toHaveAttribute('aria-hidden', 'true');
    fireEvent.mouseLeave(gallery);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS + 50);
    });
    expect(screen.getByTestId('art-slide-1')).not.toHaveAttribute('aria-hidden', 'true');
  });
});
