<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 10. Quality Requirements

## 10.1 Quality tree

| Quality | Scenario |
|---------|----------|
| **Portability** | Ship the image/manifests with placeholder config and produce a working cluster render (`helmfile -e example template`) without any external service |
| **Verifiability** | `npm test` (50 unit/component tests incl. config-portability guard); render leak check (`grep` for operator patterns) |
| **Security** | No secrets in the repository; portability test rejects deployment-specific defaults; runtime config via ConfigMap |
| **Operability** | Health endpoints `/ping`/`/health`; readiness/liveness probes in the k8s example; image build gated on tests |
| **Maintainability** | SPDX headers, arc42 + C4 docs, one-file-per-section, `publiccode.yml` |
| **Usability** | i18n key completeness enforced by test; dark mode; localized tile names |
| **Performance** | Static assets + same-origin feed proxies (no CORS, no backend); nginx caching defaults |

## 10.2 Explicit quality requirements

| Requirement | Verification | Status |
|-------------|--------------|--------|
| Shipped defaults contain zero deployment-specific values | `src/config.test.ts` | Satisfied |
| All locales expose exactly the same keys | i18n completeness test | Satisfied |
| Root helmfile renders all 27 apps offline | `helmfile -e example template` | Satisfied |
| ArgoCD chart renders 27 valid Application CRDs, 1:1 release mapping | `helm template` + selector check | Satisfied (on cut) |
| No operator pattern leaks in public artifacts | Render leak check (helmfile README) | Satisfied |

## 10.3 Conventions / test drives

- CI: `.github/workflows/ci.yml` (unit tests on PR).
- Local render check:
  ```bash
  cd helmfile
  helmfile -f helmfile.yaml.gotmpl -e example template > /tmp/rendered.yaml
  grep -cE 'hrz\.uni-marburg|uni-marburg\.de|openedusuite\.org|swp-ldap' /tmp/rendered.yaml
  ```

---

[Back to index](./README.md)
