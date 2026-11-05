<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 2. Constraints

## 2.1 Technical Constraints

| Constraint | Explanation |
|------------|-------------|
| Kubernetes | Deployment target for the portal and all app variants |
| Helmfile / Helm | The portable manifest layer (`helmfile/`) |
| ArgoCD (GitOps) | Production deployment chain is ArgoCD → helmfile → charts; offered via `argocd/` |
| React 19 + Vite + Tailwind 4 + nginx | Portal stack, built as a static SPA container image |
| Node.js 22+ | Local build/test toolchain |
| Offline renderability | All charts are local (`helmfile/charts/`) or vendored (`helmfile/vendor/charts/`); no remote chart repositories are required — with two opt-in exceptions (below) |

## 2.2 Organizational Constraints

| Constraint | Explanation |
|------------|-------------|
| Public release | Everything in this repo is publicly visible; operator-specific data is **not** allowed |
| Sanitization | Placeholders (`example.org`, `CHANGEME`) replace all upstream values; table in `helmfile/README.md` |
| Licensing | Apache-2.0 core; some vendored Helm charts are AGPL-3.0-or-later (see `LICENSES/`); SPDX/REUSE headers required |
| Secrets | Never commit secrets — values files are plain YAML by design and expect SOPS/sealed-secrets/external-secrets in production |

## 2.3 Conventions

- Manifest and doc YAML/Markdown carry SPDX headers (`SPDX-FileCopyrightText`,
  `SPDX-License-Identifier`)
- All example hostnames are `*.example.org`; RFC 5737 TEST-NET ranges for IPs
- App values are expressed as helmfile `.Values.*` consumed from the shared
  placeholder environment (`helmfile/environments/example.yaml`)
- Architecture is documented in arc42 (this directory) plus C4 models (`c4/`)

## 2.4 Opt-in exceptions (public registries)

`kasmvnc` and `overleaf` pull their charts from **public OCI registries**
(not vendored) and are therefore disabled in the example environment by
default. Enabling them requires outbound registry access — see
`helmfile/environments/example.yaml`.

---

[Back to index](./README.md)
