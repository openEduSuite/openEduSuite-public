<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# C4 — Level 1: System Context (openEduSuite)

> **Focus:** the openEduSuite distribution as a whole — the portal and the
> platform-as-code artifact — in its environment. Maps to arc42
> [§3 Context and Scope](../03-context-and-scope.md).

```mermaid
flowchart LR
    U1["<b>User (staff)</b><br/>Person"]
    U2["<b>User (student)</b><br/>Person"]
    U3["<b>User (guest)</b><br/>Person"]

    subgraph SYS["<b>openEduSuite</b> (System)"]
        PORTAL["Portal<br/>portal.example.org"]
        PLATFORM["Deployed services<br/>*.example.org"]
    end

    OAUTH["<b>oauth2-proxy</b><br/>System · SSO gateway"]
    IDP["<b>Identity Provider</b><br/>System · Keycloak at id.example.org"]
    FEED["<b>News / events</b><br/>System · Atom/RSS + weather"]
    REG["<b>OCI registries</b><br/>System · opt-in charts only"]
    GITOPS["<b>GitOps operator</b><br/>System · ArgoCD / kubara"]
    OP["<b>Operator</b><br/>Person · config + sync"]

    U1 -->|"HTTPS browser"| PORTAL
    U2 -->|"HTTPS browser"| PORTAL
    U3 -->|"HTTPS browser"| PORTAL
    PORTAL -->|"GET /oauth2/auth · sign_out"| OAUTH
    OAUTH -->|"OIDC / OAuth2"| IDP
    PORTAL -->|"tiles → links"| PLATFORM
    PORTAL -->|"same-origin feed proxies"| FEED
    OP -->|"mounts config.json · helmfile apply"| PORTAL
    OP -->|"sync"| GITOPS
    GITOPS -->|"watches repo · renders helmfile"| PLATFORM
    PLATFORM -->|"chart pull (opt-in apps)"| REG
```

## Explanation

- **Users** reach the portal via the browser; the portal links to all deployed
  services (`cloud.`, `mail.`, `lms.`, …) without hosting them.
- **Authentication** is delegated to oauth2-proxy in front of the portal.
- **Platform services** are delivered either imperatively (helmfile) or via
  the GitOps operator — both render the same helmfile tree.
- **OCI registries** are only contacted for the two opt-in apps
  (kasmvnc, overleaf).

---

[Back to the C4 models](./README.md)
