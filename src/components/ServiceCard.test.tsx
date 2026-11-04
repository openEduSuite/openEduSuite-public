import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import ServiceCard from './ServiceCard';
import type { PortalService } from '../config';

const fixture: PortalService = {
  id: 'keycloak',
  category: 'identity',
  launchUrl: 'https://id.example.org/realms/example/account/',
  ssoEnabled: true,
  icon: '🔐',
};

function renderAt() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ServiceCard service={fixture} />
    </I18nextProvider>,
  );
}

describe('ServiceCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('renders the localized name and description', () => {
    renderAt();
    expect(screen.getByText('Keycloak SSO')).toBeInTheDocument();
    expect(screen.getByText(/Single-Sign-On-Identitätsanbieter/)).toBeInTheDocument();
  });

  it('does not render a lifecycle status badge (monitoring covers availability)', () => {
    renderAt();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('Geplant')).not.toBeInTheDocument();
  });

  it('shows the SSO badge only for ssoEnabled services', async () => {
    renderAt();
    expect(screen.getByText('SSO')).toBeInTheDocument();
  });

  it('omits the SSO badge for non-SSO services', () => {
    render(<I18nextProvider i18n={i18n}><ServiceCard service={{ ...fixture, ssoEnabled: false }} /></I18nextProvider>);
    expect(screen.queryByText('SSO')).not.toBeInTheDocument();
  });

  it('updates when the language changes', async () => {
    renderAt();
    expect(screen.getByText(/Single-Sign-On-Identitätsanbieter/)).toBeInTheDocument();
    await i18n.changeLanguage('fr');
    expect(screen.getByText(/Fournisseur d'identité Single Sign-On/)).toBeInTheDocument();
    expect(screen.getByText('SSO')).toBeInTheDocument();
  });

  it('keeps brand names identical across locales', async () => {
    renderAt();
    expect(screen.getByText('Keycloak SSO')).toBeInTheDocument();
    await i18n.changeLanguage('zh');
    expect(screen.getByText('Keycloak SSO')).toBeInTheDocument();
  });
});
