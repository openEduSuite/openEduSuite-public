# openEduSuite Portal

[![CI](https://github.com/openEduSuite/openEduSuite-public/actions/workflows/ci.yml/badge.svg)](https://github.com/openEduSuite/openEduSuite-public/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**Ihr kollaborativer Arbeitsplatz** — alle openEduSuite-Dienste an einem Ort.
Single Sign-On mit Ihrem Universitätskonto, integrierte Werkzeuge für Lehre,
Forschung und Zusammenarbeit.

**Your collaborative workspace** — all openEduSuite services in one place, with
single sign-on via your university account.

A configurable **service dashboard (portal)** for openEduSuite deployments: one
page that lists every connected service as a tile, reflects the SSO login
state, and offers a theme toggle and language switcher (de / en / fr / zh).

Built with **React 19 + Vite + Tailwind CSS 4 + i18next**, served as a static
SPA by **nginx** from a small container image.

![openEduSuite portal — landing page](public/brand/birdeye.webp)

---

## Features

- 🧩 **Service tiles** — one card per service (icon, localized name/description,
  SSO badge, opens in a new tab), grouped into sections
- 🔐 **SSO-aware header** — shows *login* / *logout* / *account* depending on the
  real session (via oauth2-proxy, see below)
- 🗂 **Flexible layout** — flat sections via config, or automatic grouping by
  category; a separate staff/student section
- 🌦 **Widgets** — weather iframe + university news feeds (Atom/RSS, fetched
  same-origin through nginx proxies — no CORS issues)
- 🌗 **Dark mode** — toggle in the header, follows the OS preference by default,
  persisted in `localStorage`
- 🌍 **i18n** — German (default), English, French, Chinese; browser-language
  detection with a manual switcher
- 📦 **Portable image** — ships `example.org` placeholder config; your real
  values are injected at runtime

## How it works

The portal is a **static SPA with a runtime config**:

1. On boot it fetches **`/config.json`** (`cache: no-store`) from the same
   origin. The nginx image ships a placeholder copy; **mount your real config
   over `/usr/share/nginx/html/config.json`** (in Kubernetes: a ConfigMap).
2. If the fetch fails, it falls back to the bundled placeholder
   ([`src/config.default.json`](src/config.default.json)) — all `example.org`.
3. A unit test ([`src/config.test.ts`](src/config.test.ts)) **guarantees** that
   the shipped defaults contain zero deployment-specific values (no real
   hostnames, no institution names), so the public image is always safe to pull.

### Authentication (important)

The portal is designed to run **behind [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/)**
with a valid session cookie:

- On load it calls **`GET /oauth2/auth`** — `200` means signed in, `401` means
  signed out.
- **Signed out:** landing page only — hero text, project image, and a *login*
  button pointing at `sso.loginUrl`.
- **Signed in:** the service tiles, staff section, and widgets render; the
  header shows *logout* (`/oauth2/sign_out`) and an *account* link
  (`sso.accountUrl`).

Without oauth2-proxy in front, `/oauth2/auth` never returns 200 and visitors
only ever see the landing page.

---

## Configuration reference (`/config.json`)

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

### Service objects

| Field | Description |
|---|---|
| `id` | **Selects the localized name/description** from `src/locales/*.json` (`services.<id>.name` / `.description`). 29 built-in ids are shipped (see the locale files). A custom id renders the raw key unless you add it to every locale |
| `category` | One of `identity`, `communication`, `productivity`, `knowledge`, `development`, `infrastructure` (used in the category-grouped fallback layout) |
| `launchUrl` | Tile target — opened in a new tab (`rel="noopener"`) |
| `ssoEnabled` | Shows the 🔒 SSO badge on the tile |
| `icon` | Emoji shown on the tile |
| `status` | Legacy field, ignored by the UI |

### Sections, feed and widget titles are i18n keys

`layout.sections[].title`, `widgets.news.feeds[].title` and
`widgets.weather.title` are passed through the translation function — use keys
from `src/locales/*.json` (`ui.*`), e.g. `ui.sectionServices`, `ui.news`,
`ui.events`, `ui.hrz`, `ui.ub`, `ui.kalender`, `ui.weather`. Plain strings also
work (they render as-is) if you prefer not to touch the locale files.

> Note: hero text (`ui.hero`, `ui.heroSub`), subtitles and all UI labels live in
> the **locale files** (compile-time), not in `config.json`. Branding that is
> per-deployment (operator, institution, URLs, tiles) belongs in `config.json`.

---

## Run locally

Requires **Node.js 22+** (node:20/musl lacks zlib zstd and crashes the
vitest/undici workers).

```bash
npm ci
npm run dev       # Vite dev server
npm test          # vitest: 50 unit + component tests
npm run build     # tsc typecheck + vite build -> dist/
npm run preview   # serve the production build
```

For local development without a config mount, the app falls back to
`src/config.default.json`.

## Run with Docker

```bash
docker build -t openedusuite-portal .
docker run -p 8080:80 \
  -v "$PWD/my-config.json:/usr/share/nginx/html/config.json:ro" \
  -e FEED_NEWS_URL=https://www.uni-example.edu/news/atom.xml \
  openedusuite-portal
```

Then open <http://localhost:8080>. The image build itself runs `npm test` as a
gate, so a broken build never produces an image.

### nginx feed proxies (optional widgets)

[`nginx.conf.template`](nginx.conf.template) is an **envsubst template**: the
nginx image substitutes it into `/etc/nginx/conf.d` at container start.
Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `DNS_RESOLVER` | `127.0.0.11` (Docker embedded DNS) | Resolver for upstream feeds. In Kubernetes set your cluster DNS service IP |
| `FEED_NEWS_URL` | `https://example.org/feeds/news/atom.xml` | Upstream for proxy path `/news` |
| `FEED_EVENTS_URL` | `https://example.org/feeds/events/atom.xml` | `/events` |
| `FEED_HRZ_URL` | `https://example.org/feeds/hrz/atom.xml` | `/hrz` |
| `FEED_UB_URL` | `https://example.org/feeds/library/atom.xml` | `/ub` |
| `FEED_CAL_URL` | `https://example.org/feeds/calendar/atom.xml` | `/kalender` |

Health endpoints: `GET /ping` → `pong`, `GET /health` → `ok`.

## Deploy on Kubernetes

A Deployment + Service + Ingress is enough; put the **Ingress in front of
oauth2-proxy** so `/oauth2/auth` and `/oauth2/sign_out` work, and mount your
portal config as a ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: portal-config
data:
  config.json: |
    {
      "sso": { "loginUrl": "https://id.example.org/...", "accountUrl": "https://id.example.org/realms/example/account/" },
      "docsUrl": "https://docs.example.org",
      "branding": { "operator": "IT Service Center", "institution": "Your University" },
      "services": [ { "id": "opencloud", "category": "productivity",
                      "launchUrl": "https://cloud.example.org", "ssoEnabled": true, "icon": "☁️" } ]
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portal
spec:
  replicas: 2
  selector:
    matchLabels: { app: portal }
  template:
    metadata:
      labels: { app: portal }
    spec:
      containers:
        - name: portal
          image: openedusuite-portal:latest
          ports: [ { containerPort: 80 } ]
          env:
            - name: DNS_RESOLVER          # cluster DNS service IP, e.g. 10.96.0.10
              value: "10.96.0.10"
            - name: FEED_NEWS_URL
              value: "https://www.uni-example.edu/news/atom.xml"
          volumeMounts:
            - name: config
              mountPath: /usr/share/nginx/html/config.json
              subPath: config.json
          readinessProbe:
            httpGet: { path: /health, port: 80 }
          livenessProbe:
            httpGet: { path: /ping, port: 80 }
      volumes:
        - name: config
          configMap:
            name: portal-config
```

## Internationalization

- Locales live in [`src/locales/`](src/locales): `de` (default), `en`, `fr`, `zh`.
- Language resolution: manual switcher (persisted in `localStorage` under
  `portal-locale`) → browser languages → fallback `de`. See
  [`src/i18n.ts`](src/i18n.ts) (`SUPPORTED`, `resolveLanguage`).
- A test enforces that **all locales expose exactly the same keys** — adding a
  key to one locale requires adding it to all.
- To add a language: create `src/locales/<lang>.json`, add it to `SUPPORTED` in
  `i18n.ts`, and add an `<option>` to the switcher in `src/pages/Home.tsx`.

## Theming

Light/dark toggle in the header. Initial value follows the OS
(`prefers-color-scheme`); a manual choice is persisted in `localStorage`
under `portal-theme` ([`src/theme.ts`](src/theme.ts)). Tailwind dark mode is
class-based.

## Project layout

```
├── Dockerfile               # node:22 build (npm test gate) -> nginx:alpine
├── nginx.conf.template      # envsubst server config: SPA + feed proxies + health
├── index.html
├── public/                  # favicon + brand assets (logo, bird's-eye image)
└── src/
    ├── config.ts            # /config.json loading, DEFAULT_CONFIG, types
    ├── config.default.json  # placeholder config shipped inside the image
    ├── i18n.ts              # language detection + i18next setup
    ├── theme.ts / useTheme.ts
    ├── locales/             # de / en / fr / zh
    ├── pages/Home.tsx       # header, hero, sections/tiles, widgets, footer
    ├── components/          # ServiceCard, NewsFeeds, WeatherWidget
    └── *.test.ts(x)         # portability guard + i18n completeness + components
```

## Development

```bash
npm test            # all tests (vitest, jsdom)
npm run test:watch  # watch mode
```

The suite currently covers: config portability (no deployment values in
defaults), i18n key completeness across locales, config loading/merging, theme
resolution, and the Home/ServiceCard/NewsFeeds components (50 tests).

**Adding a service tile:** pick an `id` present in `src/locales/*.json` (or add
your own `services.<id>.name/description` to all four locales), then reference
it in `config.json` under `services` (and optionally in `layout.sections`).

## License

[Apache-2.0](LICENSE) — © openEduSuite Contributors.

openEduSuite is based on [openDesk](https://github.com/Bundesdruckerei/opendesk).
