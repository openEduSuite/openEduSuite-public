import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, getConfig, loadConfig, type PortalConfig } from './config';

const HRZ_MARKERS = [
  'openedusuite.org',
  'opendesk.hrz',
  'uni-marburg',
  'umr.uni-marburg',
  'SCS',
  'Marburg',
  'Philipps',
];

describe('portal runtime config (portable image, deployment-specific override)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('default config contains zero deployment-specific (HRZ) values', () => {
    const blob = JSON.stringify(DEFAULT_CONFIG);
    for (const marker of HRZ_MARKERS) {
      expect(blob, 'default config must not contain ' + marker).not.toContain(marker);
    }
    expect(DEFAULT_CONFIG.sso.loginUrl).toContain('example.org');
    expect(DEFAULT_CONFIG.branding.institution).toBe('Your University');
  });

  it('default config ships a complete, translatable catalog', () => {
    const ids = [...DEFAULT_CONFIG.services, ...DEFAULT_CONFIG.staffServices].map((s) => s.id);
    expect(ids).toEqual([
      'keycloak', 'element', 'bbb', 'opencloud', 'nextcloud', 'sogo', 'openproject',
      'xwiki', 'open-webui', 'argocd', 'sogo-staff', 'xwiki-staff', 'sogo-students',
    ]);
    for (const s of [...DEFAULT_CONFIG.services, ...DEFAULT_CONFIG.staffServices]) {
      expect(s.launchUrl).toMatch(/^https:\/\//);
      expect(s.icon).toBeTruthy();
    }
  });

  it('loadConfig() serves the runtime /config.json override when present', async () => {
    const remote: Partial<PortalConfig> = {
      sso: { loginUrl: 'https://id.example.org/realms/hr/protocol/openid-connect/auth?x', accountUrl: 'https://id.example.org/realms/hr/account/' },
      docsUrl: 'https://wiki.example.org',
      branding: { operator: 'IT', institution: 'Example University' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => remote }),
    );
    const cfg = await loadConfig();
    expect(cfg.sso.loginUrl).toContain('realms/hr');
    expect(cfg.branding.operator).toBe('IT');
    // services left untouched when remote omits them (deep-merge keeps default catalog)
    expect(cfg.services.length).toBe(DEFAULT_CONFIG.services.length);
  });

  it('falls back to the bundled default when /config.json is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const cfg = await loadConfig();
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });

  it('merges branding deeply while preserving default services', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ branding: { institution: 'Other Univ' } }),
    }));
    const cfg = await loadConfig();
    expect(cfg.branding.institution).toBe('Other Univ');
    expect(cfg.branding.operator).toBe(DEFAULT_CONFIG.branding.operator); // preserved
    expect(getConfig()).toBe(cfg);
  });
});
