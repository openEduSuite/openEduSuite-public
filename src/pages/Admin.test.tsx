// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Admin.test.tsx — L1-Unit-Tests für die rollen-gated Admin-Seite (Variante 1).
// Vertrag (specs/admin-access): Rendering NUR bei isAdmin=true; ohne Nachweis
// keinerlei Admin-Inhalt (null). Admin-Kacheln werden aus dem Katalog aufgelöst.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import Admin from './Admin';

// Hook deterministisch mocken (kein echter /api/me-fetch im Unit-Test).
let hookState: { loading: boolean; isAdmin: boolean };
vi.mock('../lib/portalAuth', () => ({
  ADMIN_GROUP: '/portal-admins',
  EMPTY_AUTH: { groups: [], isAdmin: false },
  isAdminFromGroups: () => hookState.isAdmin,
  usePortalAuth: () => ({ loading: hookState.loading, isAdmin: hookState.isAdmin, groups: [], state: hookState }),
  parseMe: () => ({ groups: [], isAdmin: false }),
}));

function renderAdmin(isAdmin?: boolean) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Admin isAdmin={isAdmin} />
    </I18nextProvider>,
  );
}

describe('Admin-Arbeitsbereich (Variante 1, role-gated)', () => {
  beforeEach(() => {
    hookState = { loading: false, isAdmin: false };
  });

  it('rendert ohne Nachweis (isAdmin=false) keinerlei Admin-Inhalt', () => {
    hookState = { loading: false, isAdmin: false };
    const { container } = renderAdmin(false);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('admin-workspace')).toBeNull();
  });

  it('rendert bei nachgewiesener Mitgliedschaft die Admin-Kacheln aus dem Katalog', () => {
    hookState = { loading: false, isAdmin: true };
    renderAdmin(true);
    expect(screen.getByTestId('admin-workspace')).toBeTruthy();
    expect(screen.getByTestId('admin-tile-argocd')).toBeTruthy();
    expect(screen.getByTestId('admin-tile-keycloak')).toBeTruthy();
  });

  it('nutzt ohne isAdmin-Prop den Hook-Status (allowed = prop ?? hook)', () => {
    hookState = { loading: false, isAdmin: true };
    renderAdmin();
    expect(screen.getByTestId('admin-workspace')).toBeTruthy();
  });
});
