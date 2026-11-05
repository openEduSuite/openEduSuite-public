<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 4. Solution Strategy

The architecture follows four recurring decisions:

## 4.1 The portal: static SPA + runtime config

No backend. The portal is a compiled React SPA served by nginx; all
deployment-specific data flows in at **runtime** through `/config.json`
(mounted as a Kubernetes ConfigMap). The image ships a placeholder default,
and a unit test ([`src/config.test.ts`](../../src/config.test.ts)) guarantees
the shipped defaults contain zero deployment-specific values.

## 4.2 SSO by delegation

The portal is **SSO-agnostic**: it does not implement authentication. It runs
behind **oauth2-proxy** and merely probes `/oauth2/auth` (200 = signed in,
401 = signed out) to switch between landing page and signed-in dashboard. Its
only IdP knowledge is a login URL and an account URL in the config.

## 4.3 Deployment variants: one portable substrate

The helmfile tree is the **lowest common denominator** — production deploys
exactly these manifests (ArgoCD's helmfile plugin executes helmfile). A single
root helmfile ([`helmfile/helmfile.yaml.gotmpl`](../../helmfile/helmfile.yaml.gotmpl))
owns the `example` environment values; each of the 27 apps is one release
under `helmfile/apps/edu/<app>/`. Charts are local or vendored so rendering
works fully offline.

## 4.4 GitOps wrappers render the same substrate

The production chain is **ArgoCD → helmfile → charts**. This is exactly what
the `argocd/` wrapper offers publicly: one ArgoCD `Application` per service,
each rendering the shared root helmfile filtered to its own release
(`-l name=<release>`). kubara only bootstraps the ArgoCD + platform layer; the
apps ride the same wrapper — there is deliberately **no** second application
format.

## 4.5 Sanitization by construction

Placeholder environments, `example.org` hostnames, SPDX headers and the
portability test make the distribution safe to publish and easy to adapt. The
sanitization table in [`helmfile/README.md`](../../helmfile/README.md)
documents exactly what was replaced.

---

[Back to index](./README.md)
