<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 9. Architecture Decisions

| # | Decision | Rationale / Alternative | Status |
|---|----------|-------------------------|--------|
| ADR-01 | **Static SPA + runtime config** (no backend) | Zero server components to operate; portability via `/config.json`. Alternative (server-rendered portal) rejected for operations cost | Accepted |
| ADR-02 | **SSO delegated to oauth2-proxy** | Portal stays IdP-agnostic; probes `/oauth2/auth`. Alternative (native OIDC in SPA) rejected: redirect logic, logout, refresh complexity | Accepted |
| ADR-03 | **helmfile = the portable deployment substrate** | Production already deploys these exact manifests under ArgoCD's helmfile plugin. One shared root helmfile owns env values; 27 apps are releases | Accepted |
| ADR-04 | **Shared-root rendering per app in ArgoCD** (`-l name=<release>`) | App helmfiles (`apps/edu/*`) consume `.Values` from the root environment and fail standalone — selectors isolate them from the root. Alternative (duplicating env blocks in 27 files) rejected | Accepted |
| ADR-05 | **kubara = platform bootstrap only** | No second app-deployment format; services reuse the `argocd/` wrapper. kubara is experimental for openEduSuite | Accepted |
| ADR-06 | **Sanitized public variants** | `example.org` placeholders + portability test + render leak check. Required for a public release | Accepted |
| ADR-07 | **Local/vendored charts, offline render** | Fully offline `helmfile template`. Cost: chart upgrades are manual (vendoring) | Accepted |
| ADR-08 | **kasmvnc / overleaf opt-in** | Their charts live on public OCI registries; disabled by default in `example` | Accepted |
| ADR-09 | **License policy: Apache-2.0 + SPDX, AGPL components flagged** | REUSE-compliant; AGPL charts documented in `LICENSES/` | Accepted |

Additional design notes:

- App-of-Apps sync waves: observability first (wave 1), all services flat
  (wave 5) — no invented platform dependencies (the public subset has none of
  the production pre/post-migration helpers).
- `ignoreDifferences` set on child Applications to skip Kubernetes-owned
  status/annotation fields.
- The `monitoring`/`opencloud` releases keep their historical names
  (`blackbox-probes`, `opendesk-opencloud`) — selectors map directory name →
  release name.

---

[Back to index](./README.md)
