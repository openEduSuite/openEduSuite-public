<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# openEduSuite Portal — Configuration reference

The portal is a static SPA with a **runtime config**: it fetches `/config.json`
(`cache: no-store`) from its own origin on boot, and mounts your real config
over `/usr/share/nginx/html/config.json` (in Kubernetes: a ConfigMap). If the
fetch fails it falls back to the bundled placeholder
([`src/config.default.json`](../src/config.default.json)).

> A unit test ([`src/config.test.ts`](../src/config.test.ts)) guarantees the
> shipped defaults contain **zero** deployment-specific values, so the public
> image is always safe to pull.

## Schema (`/config.json`)

```json
{
  "sso": {
    "loginUrl": "https://id.example.org/realms/example/protocol/openid-connect/auth?client_id=portal&redirect_uri=https%3A%2F%2Fportal.example.org&response_type=code&scope=openid%20profile%20email",
    "accountUrl": "https://id.example.org/realms/example/account/"
  },
  "docsUrl": "https://docs.example.org",
  "branding": { "operator": "IT Service Center", "institution": "Your University" },
  "services": [
    { "id": "opencloud", "category": "productivity", "launchUrl": "https://cloud.example.org", "ssoEnabled": true, "icon": "☁️" }
  ],
  "staffServices": [],
  "layout": {
    "sections": [
      { "id": "services", "title": "ui.sectionServices", "icon": "🛠", "services": ["opencloud", "sogo", "element"] }
    ]
  },
  "widgets": {
    "weather": { "enabled": true, "src": "https://example.org/weather-widget", "title": "ui.weather" },
    "news": { "enabled": true, "feeds": [ { "id": "news", "title": "ui.news", "path": "/news" } ] }
  }
}
```

| Field | Description |
|---|---|
| `sso.loginUrl` | Login button target (your IdP authorization endpoint) |
| `sso.accountUrl` | "Account" link in header/footer (shown when signed in) |
| `docsUrl` | "Docs" link in the footer |
| `branding.operator` / `branding.institution` | Footer line: *Powered by {{operator}} · Hosted at {{institution}}* |
| `services[]` | The tiles. See below |
| `staffServices[]` | Extra tiles in a dedicated 🎓 section; in flat-layout mode, tiles already placed in `layout.sections` are de-duplicated |
| `layout.sections[]` | Optional flat placement. When present, **exactly** these sections render in order; otherwise tiles are grouped by `category` |
| `widgets.weather` | `{ enabled, src, title }` — `src` is an **iframe embed URL** (e.g. a weather widget), `title` an i18n key |
| `widgets.news` | `{ enabled, feeds: [{ id, title, path, max? }] }` — each feed card fetches `path` same-origin and parses Atom/RSS (up to 6 entries per feed); `title` is an i18n key |

## Service objects

| Field | Description |
|---|---|
| `id` | **Selects the localized name/description** from `src/locales/*.json` (`services.<id>.name` / `.description`). 29 built-in ids are shipped (see the locale files). A custom id renders the raw key unless you add it to every locale |
| `category` | One of `identity`, `communication`, `productivity`, `knowledge`, `development`, `infrastructure` (used in the category-grouped fallback layout) |
| `launchUrl` | Tile target — opened in a new tab (`rel="noopener"`) |
| `ssoEnabled` | Shows the 🔒 SSO badge on the tile |
| `icon` | Emoji shown on the tile |
| `status` | Legacy field, ignored by the UI |

## Sections, feed and widget titles are i18n keys

`layout.sections[].title`, `widgets.news.feeds[].title` and
`widgets.weather.title` are passed through the translation function — use keys
from `src/locales/*.json` (`ui.*`), e.g. `ui.sectionServices`, `ui.news`,
`ui.events`, `ui.hrz`, `ui.ub`, `ui.kalender`, `ui.weather`. Plain strings also
work (they render as-is) if you prefer not to touch the locale files.

> Hero text (`ui.hero`, `ui.heroSub`), subtitles and all UI labels live in the
> **locale files** (compile-time), not in `config.json`. Branding that is
> per-deployment (operator, institution, URLs, tiles) belongs in `config.json`.

---

[Back to README](../README.md)
