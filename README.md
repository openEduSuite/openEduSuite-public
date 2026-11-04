# openEduSuite Portal

**Ihr kollaborativer Arbeitsplatz** — alle openEduSuite-Dienste an einem Ort.
Single Sign-On mit Ihrem Universitätskonto, integrierte Werkzeuge für Lehre,
Forschung und Zusammenarbeit.

*A configurable service dashboard (portal) for openEduSuite deployments: one
page that lists all connected services as tiles, with a single sign-on login
state, theme toggle and language switcher (de / en / fr / zh).*

Built with **React 19 + Vite + Tailwind CSS 4 + i18next**, served as a static
SPA by **nginx** in a small container image.

## How it works

The portal is intentionally **deployment-agnostic**:

- The image ships a placeholder [`src/config.default.json`](src/config.default.json)
  (all URLs are `example.org`).
- At runtime it fetches **`/config.json`** (served by nginx). Mount your real
  configuration there — in Kubernetes this is a ConfigMap mounted over
  `/usr/share/nginx/html/config.json`.
- A unit test ([`src/config.test.ts`](src/config.test.ts)) guarantees that the
  shipped default config contains **no deployment-specific values** (no real
  hostnames, no institution names) — so the public image is safe to pull.

### Configuration shape (`config.json`)

```json
{
  "sso": {
    "loginUrl": "https://id.example.org/realms/example/protocol/openid-connect/auth?...",
    "accountUrl": "https://id.example.org/realms/example/account/"
  },
  "docsUrl": "https://docs.example.org",
  "branding": { "operator": "IT Service Center", "institution": "Your University" },
  "services": [
    { "id": "opencloud", "category": "productivity", "launchUrl": "https://cloud.example.org",
      "ssoEnabled": true, "icon": "☁️" }
  ],
  "staffServices": [],
  "layout": {
    "sections": [
      { "id": "communication", "title": "Communication", "icon": "💬", "services": ["element", "bbb"] }
    ]
  },
  "widgets": {
    "weather": { "enabled": true, "src": "https://.../widget", "title": "Weather" },
    "news": { "enabled": true, "feeds": [ { "id": "news", "title": "News", "path": "/news", "max": 5 } ] }
  }
}
```

- `services` / `staffServices`: the tiles. `id` selects the localized
  name/description from `src/locales/*.json` (`services.<id>.name` /
  `.description`), `launchUrl` is the tile target, `ssoEnabled` shows the SSO
  badge, `icon` is an emoji.
- `layout.sections` (optional): flat placement of tiles in sections. Without it,
  tiles are grouped by `category`.
- `widgets.news.feeds[].path`: same-origin proxy paths (e.g. `/news`) that nginx
  rewrites to remote RSS/Atom feeds — see below.
- Login state: the portal runs behind **oauth2-proxy**; it calls
  `/oauth2/auth` once and shows *Anmelden* (→ `sso.loginUrl`) when signed out,
  *Abmelden* (→ `/oauth2/sign_out`) plus an account link when signed in.

## Run locally

```bash
npm ci
npm run dev      # vite dev server
npm test         # vitest (unit + component tests)
npm run build    # tsc + vite build -> dist/
```

## Run with Docker

```bash
docker build -t openedusuite-portal .
docker run -p 8080:80 \
  -e FEED_NEWS_URL=https://www.uni-example.edu/news/atom.xml \
  -v "$PWD/my-config.json:/usr/share/nginx/html/config.json:ro" \
  openedusuite-portal
```

Then open http://localhost:8080 (replace the config via volume mount, or bake it
into the image / mount a ConfigMap in Kubernetes).

### nginx feed proxies (optional widgets)

The image template [`nginx.conf.template`](nginx.conf.template) is substituted
at container start (nginx `/etc/nginx/templates` mechanism). Environment
variables:

| Variable | Default | Purpose |
|---|---|---|
| `DNS_RESOLVER` | `127.0.0.11` (Docker embedded DNS) | DNS resolver for upstream feeds; in Kubernetes set the cluster DNS IP |
| `FEED_NEWS_URL` | `https://example.org/feeds/news/atom.xml` | upstream for proxy path `/news` |
| `FEED_EVENTS_URL` | `https://example.org/feeds/events/atom.xml` | `/events` |
| `FEED_HRZ_URL` | `https://example.org/feeds/hrz/atom.xml` | `/hrz` |
| `FEED_UB_URL` | `https://example.org/feeds/library/atom.xml` | `/ub` |
| `FEED_CAL_URL` | `https://example.org/feeds/calendar/atom.xml` | `/kalender` |

Health endpoints: `GET /ping` → `pong`, `GET /health` → `ok`.

## Deploy on Kubernetes

The image is a plain static site behind nginx — a Deployment + Service + Ingress
is enough. Mount your portal configuration as a ConfigMap at
`/usr/share/nginx/html/config.json` and put the portal behind oauth2-proxy
(`/oauth2/auth`, `/oauth2/sign_out`) so the login button reflects the real
session. Set `DNS_RESOLVER` to your cluster DNS service IP if you use the feed
proxies.

## Internationalization

Locales live in [`src/locales/`](src/locales) (`de`, `en`, `fr`, `zh`). The
language is detected from the browser and can be overridden via the header
switcher (persisted in `localStorage`). A test enforces that all locales expose
exactly the same keys.

## Project layout

```
├── Dockerfile               # node:22 build (npm test gate) -> nginx:alpine
├── nginx.conf.template      # envsubst server config (SPA + feed proxies)
├── index.html
├── public/                  # favicon + brand assets
└── src/
    ├── config.ts            # /config.json loading + DEFAULT_CONFIG
    ├── config.default.json  # placeholder config shipped in the image
    ├── i18n.ts              # language detection + i18next setup
    ├── locales/             # de / en / fr / zh
    ├── pages/Home.tsx       # header, hero, sections/tiles, widgets
    ├── components/          # ServiceCard, NewsFeeds, WeatherWidget
    └── *.test.ts(x)         # portability guard + component tests
```

## License

[Apache-2.0](LICENSE) — © openEduSuite Contributors.

openEduSuite is based on [openDesk](https://github.com/Bundesdruckerei/opendesk).
