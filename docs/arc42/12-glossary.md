<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 12. Glossary

| Term | Definition |
|------|------------|
| **openEduSuite** | Open-source digital-sovereign education workspace (based on openDesk/ZenDiS) |
| **Portal** | The configurable single-page service dashboard in this repo (`src/`) |
| **Tile / ServiceCard** | A portal card presenting one service with icon, localized name/description and launch link |
| **SSO** | Single sign-on; delegated to oauth2-proxy + identity provider |
| **oauth2-proxy** | SSO gateway in front of the portal; the portal probes `/oauth2/auth` |
| **IdP** | Identity provider (e.g. Keycloak) issuing the session |
| **Helm** | Kubernetes package manager; charts package manifests |
| **Helmfile** | Declarative orchestration of Helm releases (`helmfile/`) |
| **Release** | One deployed instance of a chart (here: one per app) |
| **Environment** (helmfile) | Named value set loaded from `helmfile/environments/*.yaml`; the public default is `example` |
| **Chart (headless)** | Self-contained chart without an upstream registry dependency |
| **Vendored chart** | Upstream chart checked into `helmfile/vendor/charts/` for offline use |
| **OCI registry** | Container (and chart) registry; used by the two opt-in apps |
| **GitOps** | Declarative deployment driven from Git (here: ArgoCD) |
| **ArgoCD** | GitOps operator; executes sync, health and drift control |
| **App-of-Apps** | ArgoCD pattern: one root Application generating many child Applications |
| **Application** (ArgoCD) | The unit ArgoCD syncs (repository path + destination) |
| **CMP** | Config Management Plugin — custom ArgoCD renderer; this repo ships the helmfile CMP |
| **Sync wave** | Ordering annotation for ArgoCD Applications (1 = observability, 5 = services) |
| **kubara** | GitOps/platform-engineering IDP that bootstraps ArgoCD and generates platform charts |
| **IDP** (here) | Internal Developer Platform, not to be confused with IdP (identity provider) |
| **Placeholder / sanitization** | Replacement of operator-specific values with `example.org`/`CHANGEME` |
| **Runtime config** | `/config.json` mounted at runtime (ConfigMap); portal fetches it on boot |
| **ConfigMap** | Kubernetes mechanism to mount the portal configuration |
| **SPDX / REUSE** | License/header conventions for machine-readable licensing |
| **publiccode.yml** | OSS metadata standard for public-sector software |
| **arc42 / C4** | Architecture documentation template / 4-level diagram model |
| **Blackbox probe** | Monitoring probe exercised by the `monitoring` app variant |

---

[Back to index](./README.md)
