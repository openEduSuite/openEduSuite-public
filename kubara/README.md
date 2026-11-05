# Deploying openEduSuite with kubara

[kubara](https://github.com/kubara-io/kubara) is a GitOps / platform-engineering
tool that **bootstraps ArgoCD** into a cluster and **generates Helm charts
for the platform layer** (cert-manager, external-secrets, kyverno, ...) from
OCI-based service catalogs.

For openEduSuite, kubara is the **platform channel**, not a second app-deployment
format. The deal:

```
kubara                     ArgoCD (bootstrapped + managed by kubara)
   │                             │
   │ platform components         │ openEduSuite services
   │ (cert-manager, kyverno,     │ (moodle, ilias, opencloud, …)
   │  external-secrets, …)       │
   ▼                             ▼
kubara/config.yaml ──► ArgoCD ──► argocd/root-application.yaml ──► helmfile CMP ──► helmfile/apps/edu/*
    (catalog OCI)                 (this repo, argocd/)               (argocd/cmp-helmfile.yaml)
```

App services are deployed **exactly like in plain-ArgoCD mode** — through the
[`argocd/`](../argocd/) wrapper shipped in this repo. kubara only provides the
operator and the platform base services underneath.

## Why this split

- The public repo's app charts are helmfile-rendered; that does not change
  whether the ArgoCD on top is kubara-managed or hand-rolled.
- kubara's own app-deployment path (plain manifests in a `k8s/` directory) would
  mean maintaining a **second** deployment format for the same 27 services.
  Reusing the `argocd/` wrapper keeps a single source of truth.
- kubara's value-add — ArgoCD + platform components — is exactly the layer
  openEduSuite expects underneath (ingress controller, cert-manager, secrets).

## Install

```bash
# 1. Copy + edit the config template (domains, repo URL, services)
cp kubara/config.yaml.example kubara/config.yaml

# 2. Secrets for the ArgoCD bootstrap
cat > kubara/.env <<EOF
PROJECT_NAME=openedusuite
PROJECT_STAGE=dev
ARGOCD_WIZARD_ACCOUNT_PASSWORD=<your-password>
ARGOCD_GIT_AUTH_MODE=https
ARGOCD_GIT_URL=https://github.com/<your-fork>/openEduSuite-public.git
ARGOCD_GIT_USERNAME=git
ARGOCD_GIT_PAT_OR_PASSWORD=<your-token>
EOF

# 3. Bootstrap ArgoCD + generate platform components + apply
kubara bootstrap --local
kubara generate --helm
kubara apply
```

### 4. Install the helmfile CMP (one-time, same as plain-ArgoCD mode)

```bash
kubectl apply -f argocd/cmp-helmfile.yaml
kubectl patch deployment argocd-repo-server -n argocd \
  --patch-file argocd/cmp-repo-server.yaml
kubectl patch configmap argocd-cmp-cm -n argocd --type merge -p \
  '{"data": {"plugins": "cmp-helmfile"}}'
kubectl rollout restart deployment argocd-repo-server -n argocd
```

### 5. Deploy the openEduSuite apps

```bash
kubectl apply -f argocd/root-application.yaml
```

The root Application renders one ArgoCD Application per openEduSuite service
(helmfile CMP → `helmfile/helmfile.yaml.gotmpl`, filtered per release).
Sync wave 1 (observability) first, then wave 5 (all services).

## What lives where

| Layer | Owned by | Location |
|---|---|---|
| ArgoCD operator, ingress, cert-manager, kyverno, external-secrets | kubara (catalog) | `kubara/config.yaml` (your cluster) |
| App-of-Apps + helmfile CMP | openEduSuite | `argocd/` (this repo) |
| App services (moodle, ilias, opencloud, …) | openEduSuite | `helmfile/` (this repo) |
| Placeholder site values (domains, realm, secrets) | operator | `helmfile/environments/example.yaml` |

## Notes

- kubara is evaluated/experimental for openEduSuite in production — the proven
  path remains plain ArgoCD + this wrapper. Treat kubara as the convenience
  bootstrap for the platform base.
- kubara-generated artifacts (the `helm/` chart dump under
  `platform-components/`) are cluster-specific; keep them out of this repo.
- When kubara's catalog chart generation changes chart internals for shared
  components (cert-manager), verify the openEduSuite charts (which reference
  CRDs like `Certificate`) still reconcile.

## References

- kubara: <https://github.com/kubara-io/kubara>, docs: <https://docs.kubara.io/>
- ArgoCD wrapper: [`argocd/README.md`](../argocd/README.md)
