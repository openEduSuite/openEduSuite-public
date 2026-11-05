<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 8. Cross-cutting Concepts

## 8.1 Authentication & SSO

- SSO is delegated to **oauth2-proxy** in front of the portal.
- The portal probes `GET /oauth2/auth`: `200` → signed in, `401` → signed out.
- `sso.loginUrl` / `sso.accountUrl` come from the runtime config; logout uses
  `/oauth2/sign_out`.
- For the platform services, authentication/OIDC is configured per app via
  the placeholder environment (Keycloak realm, client secrets `CHANGEME`).

## 8.2 Configuration

| Layer | Mechanism |
|-------|-----------|
| Portal | Runtime `/config.json` (ConfigMap mount, `cache: no-store`), fallback `src/config.default.json` |
| Feed proxies | `nginx.conf.template` envsubst: `DNS_RESOLVER`, `FEED_*_URL` |
| Helmfile | `helmfile/environments/example.yaml` (shared placeholder env) |
| App values | per-app `values.yaml.gotmpl` consuming `.Values.*` from the environment |

Guarding rule: **no secrets in Git**. `environments/example.yaml` uses
`CHANGEME` placeholders; production secrets belong in SOPS / sealed-secrets /
external-secrets.

## 8.3 Security

- Sanitization: portability unit test (`config.test.ts`) rejects any
  deployment-specific value in shipped defaults; the render check in
  `helmfile/README.md` scans for leaked patterns (HRZ hosts, operator image
  namespaces, …).
- Static SPA: no server-side secrets by design.
- GitOps wrappers ignore Kubernetes-owned fields
  (`ignoreDifferences` in the App-of-Apps template) to avoid fight loops.
- REUSE-compliant SPDX headers across docs and manifests.

## 8.4 Modularity & Layering

Clear separation of concerns: **portal** (product) → **helmfile tree**
(deployment substrate) → **GitOps wrappers** (delivery). The wrappers never
duplicate app definitions; they reference the helmfile tree only.

## 8.5 Reproducibility

- All local charts use `file://`-style local paths or vendored charts; no
  remote chart repositories (exceptions: two opt-in OCI apps).
- `Chart.lock` files shipped for charts with dependencies; `--skip-deps` used
  during GitOps rendering.
- Image builds gate on `npm test`.

## 8.6 Language & UI

- i18n: `de` (default), `en`, `fr`, `zh`; identical key sets enforced by test;
  browser detection + persisted manual switcher.
- Theming: light/dark, `prefers-color-scheme` default, persisted override.
- Tile titles/descriptions are i18n keys (`services.<id>.*`), 29 built-in ids.

## 8.7 Operations & Observability

- Portal health endpoints: `GET /ping` → `pong`, `GET /health` → `ok`.
- Monitoring variant: `monitoring` app (blackbox probes) plus
  `opentelemetry-collector` and `tempo` charts for traces.
- ArgoCD sync waves: `1` observability, `5` services; `ApplyOutOfSyncOnly`,
  `CreateNamespace=true`, retry backoff.

---

[Back to index](./README.md)
