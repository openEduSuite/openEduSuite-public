<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 6. Runtime View

## 6.1 Scenario — Portal boot & SSO state

```
User ──HTTPS──▶ nginx  ──/config.json──▶ disk (ConfigMap mount)
nginx ──▶ SPA boot (fetch config.json, cache: no-store)
SPA  ──▶ GET /oauth2/auth ──▶ oauth2-proxy
   ├── 200 → signed in  → render tiles, widgets, account link
   └── 401 → signed out → render landing page (hero + login button)
SPA  ──▶ /news, /events … ──▶ nginx proxy ──▶ upstream Atom/RSS feeds
```

Key properties: configuration is readonly after boot; no backend calls; all
service access happens by opening external links in new tabs.

## 6.2 Scenario — SSO login round-trip

1. User clicks *Login* → `sso.loginUrl` (IdP authorization endpoint).
2. User authenticates at the IdP; oauth2-proxy completes the OIDC exchange and
   sets a session cookie.
3. Next portal load probes `/oauth2/auth` → 200 → signed-in dashboard.

The portal never sees credentials; it only consumes the proxied session.

## 6.3 Scenario — Deploy a service directly (helmfile)

```
Operator: helmfile -f helmfile/helmfile.yaml.gotmpl -e example apply
  1. render root helmfile, load environments/example.yaml
  2. iterate included apps/edu/<app>/helmfile.yaml.gotmpl (27×)
  3. each app: helm template+upgrade against helmfile/charts/<app>
  4. kubectl applies manifests to the cluster
```

Rendering is fully offline because all charts are local/vendored.

## 6.4 Scenario — Deploy a service via ArgoCD (GitOps)

```
ArgoCD syncs root Application (argocd/openedusuite-apps)
  → renders 27 child Applications (chart template)
  → each child: helmfile CMP runs
       helmfile --file helmfile.yaml.gotmpl
                --environment example --namespace openedusuite
                --allow-no-matching-release -l name=<release> template
  → manifests compared/applied to cluster (waves 1, 5)
```

The selector `-l name=<release>` isolates one app out of the shared root
helmfile, so one ArgoCD `Application` maps to exactly one service.

## 6.5 Scenario — kubara path

1. `kubara bootstrap --local` provisions ArgoCD + platform components
   (cert-manager, kyverno, external-secrets, …).
2. The helmfile CMP and root Application from `argocd/` are applied
   (identical to §6.4 from that point on).

---

[Back to index](./README.md)
