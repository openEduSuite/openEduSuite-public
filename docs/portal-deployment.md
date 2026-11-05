<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# openEduSuite Portal — Deployment & operations

Covers running the portal itself: local dev, Docker, Kubernetes, the nginx
feed proxies, i18n and theming. For deploying the **app services** see
[`helmfile/README.md`](../helmfile/README.md); for GitOps see
[`argocd/README.md`](../argocd/README.md) and
[`kubara/README.md`](../kubara/README.md).

## Authentication model (important)

The portal is designed to run **behind [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/)**
with a valid session cookie:

- On load it calls **`GET /oauth2/auth`** — `200` means signed in, `401` means signed out.
- **Signed out:** landing page only — hero text, project image, and a *login*
  button pointing at `sso.loginUrl`.
- **Signed in:** the service tiles, staff section, and widgets render; the
  header shows *logout* (`/oauth2/sign_out`) and an *account* link
  (`sso.accountUrl`).

Without oauth2-proxy in front, `/oauth2/auth` never returns 200 and visitors
only ever see the landing page.

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

[`nginx.conf.template`](../nginx.conf.template) is an **envsubst template**: the
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

- Locales live in [`src/locales/`](../src/locales): `de` (default), `en`, `fr`, `zh`.
- Language resolution: manual switcher (persisted in `localStorage` under
  `portal-locale`) → browser languages → fallback `de`. See
  [`src/i18n.ts`](../src/i18n.ts) (`SUPPORTED`, `resolveLanguage`).
- A test enforces that **all locales expose exactly the same keys** — adding a
  key to one locale requires adding it to all.
- To add a language: create `src/locales/<lang>.json`, add it to `SUPPORTED` in
  `i18n.ts`, and add an `<option>` to the switcher in `src/pages/Home.tsx`.

## Theming

Light/dark toggle in the header. Initial value follows the OS
(`prefers-color-scheme`); a manual choice is persisted in `localStorage`
under `portal-theme` ([`src/theme.ts`](../src/theme.ts)). Tailwind dark mode is
class-based.

---

[Back to README](../README.md)
