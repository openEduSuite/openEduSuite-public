// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OverviewScene, { StaticOverview } from './OverviewScene';
import { __resetWebglCache } from './webgl';

describe('OverviewScene — progressive enhancement (Strom B)', () => {
  it('rendert ohne WebGL (jsdom) das statische Fallback-Bild', () => {
    __resetWebglCache();
    const { container } = render(<OverviewScene />);
    expect(screen.getByTestId('overview-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('workplace-canvas')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', '/brand/landing-overview.svg');
  });

  it('StaticOverview ist exportiert und zeigt das Landing-Bild', () => {
    render(<StaticOverview />);
    expect(screen.getByTestId('overview-fallback')).toBeInTheDocument();
  });

  it('nutzt den WebGL-Check (gering gerufen, kein drei.js-Import im Test)', () => {
    __resetWebglCache();
    // Sicherstellen, dass der Check auch bei fehlendem Kontext nicht wirft.
    expect(() => {
      const r = render(<OverviewScene />);
      r.unmount();
    }).not.toThrow();
  });
});
