<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# C4 — Level 2: Container (openEduSuite)

> **Focus:** the containers/deployables of the distribution and their
> technologies. Maps to arc42 [§5 Building Block View](../05-building-block-view.md).

```mermaid
flowchart TB
    subgraph PORTAL_C["Portal — container diagram"]
        NGINX["<b>nginx (container)</b><br/>static server + feed proxies + health"]
        SPA["<b>SPA bundle</b><br/>React 19 · Vite · Tailwind 4"]
        CONF["<b>config.json</b><br/>runtime · ConfigMap mount"]
        NGINX --> SPA
        SPA -->|"fetch /config.json"| CONF
        NGINX -->|"/news · /events · /kalender"| FEEDUP["Atom/RSS upstream"]
    end

    subgraph PC["Platform-as-Code"]
        HF["<b>helmfile tree</b><br/>root helmfile + 27 apps"]
        CH["<b>Helm charts</b><br/>24 local + 4 vendored"]
        ENV["<b>environments/example.yaml</b><br/>placeholder values"]
        ARGO["<b>ArgoCD</b><br/>App-of-Apps + helmfile CMP"]
        KUB["<b>kubara</b><br/>platform bootstrap"]
        HF --> CH
        HF --> ENV
        ARGO -->|"helmfile CMP"| HF
        KUB -->|"provisions"| ARGO
    end

    NGINX -->|"get image"| IMG["openedusuite-portal image<br/>Dockerfile · npm test gate"]
```

## Containers

| Container | Technology | Responsibility |
|-----------|-----------|----------------|
| **nginx** | `nginx.conf.template` + envsubst | Serves the SPA, proxies feeds same-origin, health endpoints |
| **SPA bundle** | React 19, Vite 8, Tailwind 4, i18next | Dashboard UI, config load, SSO probe, widgets |
| **config.json** | JSON (ConfigMap) | Runtime contract between operator and portal |
| **helmfile tree** | helmfile yaml.gotmpl | Deployment substrate for 27 services |
| **Helm charts** | local / vendored | Package the manifests per service |
| **ArgoCD** | operator + helmfile CMP | GitOps delivery of the platform |
| **kubara** | IDP bootstrap | ArgoCD + platform components provisioning |

---

[Back to the C4 models](./README.md)
