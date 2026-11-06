import defaultConfig from './config.default.json';

export interface PortalService {
  id: string;
  category: string;
  /** Optional legacy field (ignored by the UI; availability is monitored). */
  status?: 'live' | 'beta' | 'planned';
  launchUrl: string;
  ssoEnabled: boolean;
  icon: string;
}

/** A named section rendering its service tiles in placement order (flat grid). */
export interface PortalSection {
  id: string;
  title: string;
  icon?: string;
  /** Service ids in display order. */
  services: string[];
}

export interface NewsFeed {
  id: string;
  title: string;
  /** Same-origin proxy path (nginx rewrites to the remote RSS/Atom feed). */
  path: string;
  max?: number;
}

export interface PortalConfig {
  sso: { loginUrl: string; accountUrl: string };
  docsUrl: string;
  branding: { operator: string; institution: string };
  services: PortalService[];
  staffServices: PortalService[];
  /**
   * Optional flat placement (the classic openDesk portal layout). When present,
   * Home renders exactly these sections in order — otherwise it falls back to
   * the category-grouped layout.
   */
  layout?: {
    sections: PortalSection[];
  };
  /** Optional widgets row (weather + university news feeds). */
  widgets?: {
    weather?: { enabled: boolean; src: string; title: string };
    news?: { enabled: boolean; feeds: NewsFeed[] };
  };
}

const DEFAULT_CONFIG = defaultConfig as unknown as PortalConfig;

let current: PortalConfig = DEFAULT_CONFIG;

/**
 * Load the deployment-specific runtime config from /config.json (served by
 * nginx; a ConfigMap mounts the real values over the image's placeholder).
 * Falls back to the bundled default when unavailable (offline/dev/tests).
 * Resolved before React renders so components can read getConfig() sync.
 */
export async function loadConfig(): Promise<PortalConfig> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (res.ok) {
      const remote = (await res.json()) as Partial<PortalConfig>;
      current = {
        ...DEFAULT_CONFIG,
        ...remote,
        branding: { ...DEFAULT_CONFIG.branding, ...remote.branding },
      };
    }
  } catch {
    // keep default (fresh boot with no /config.json)
    current = DEFAULT_CONFIG;
  }
  return current;
}

export function getConfig(): PortalConfig {
  return current;
}

/** Config used when /config.json is absent (also exported for tests/spec). */
export { DEFAULT_CONFIG };
// e2e-sync-test-marker-1793953261
