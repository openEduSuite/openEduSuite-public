# Deploying openEduSuite with ArgoCD

The openEduSuite helmfile tree in [`helmfile/`](../helmfile/) is the portable
substrate. This directory provides the **same GitOps wrapper we use in
production** on top of it: ArgoCD **App-of-Apps**, one `Application` per
service, each rendered through the **helmfile Config Management Plugin (CMP)**.

Everything here is placeholder-based — no HRZ-specific hostnames, secrets, or
repos leak in. Replace before deploying.

```
argocd/                          ← this directory
├── README.md
├── root-application.yaml        ← Root Application (apply manually once)
├── cmp-helmfile.yaml            ← helmfile CMP definition (ConfigMap)
├── cmp-repo-server.yaml         ← argocd-repo-server sidecar patch
└── openedusuite-apps/           ← App-of-Apps chart (1 Application per service)
    ├── Chart.yaml
    ├── values.yaml              ← global defaults + 27 child Applications
    └── templates/application.yaml
```

## Architecture

```
argocd (namespace)
  └── openedusuite-apps (Root App)          ← watches openEduSuite-public@main
        ├── monitoring          (wave 1, helmfile CMP)
        ├── bigbluebutton       (wave 5)
        ├── bookstack           (wave 5)
        ├── … 25 more …         (wave 5)
        └── zammad              (wave 5)
```

Each child `Application` points the **helmfile CMP** at the *shared* root
helmfile (`helmfile/helmfile.yaml.gotmpl`, which carries the
`environments/example.yaml` values) and restricts the render to its own
release:

```
helmfile --file helmfile.yaml.gotmpl \
         --environment example \
         --namespace openedusuite \
         --allow-no-matching-release \
         -l name=moodle
```

Why the shared root file instead of one helmfile per app? The public app
helmfiles (`helmfile/apps/edu/*/helmfile.yaml.gotmpl`) are not self-contained —
they consume `.Values` from `environments/example.yaml`, which only the root
helmfile loads. Selecting `-l name=<release>` out of the root keeps a single
source of truth and requires no changes to the 27 app files. Verified: all 27
releases render cleanly this way (`helmfile ... template`).

## Prerequisites

- Kubernetes cluster with the `argocd` namespace and ArgoCD ≥ 2.10
- [argocd-applicationset](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/) controller (default in modern installs) — only needed if you use the ApplicationSet variant below
- `helm` and `helmfile` in the repo-server sidecar (see `cmp-repo-server.yaml`)
- Values placeholders replaced in `helmfile/environments/example.yaml`
  (domains, OIDC endpoints, secrets) and in `openedusuite-apps/values.yaml`

## Install

All commands assume you are in the repo root and point at your ArgoCD instance.

### 1. Point ArgoCD at your repo

Register your **fork** of `openEduSuite-public` as a repository in ArgoCD
(UI: *Settings → Repositories*, or `argocd repo add`). The default values use
`https://github.com/openEduSuite/openEduSuite-public.git` — replace it in
`openedusuite-apps/values.yaml` and `root-application.yaml`.

### 2. Install the helmfile CMP

```bash
kubectl apply -f argocd/cmp-helmfile.yaml   # plugin definition
kubectl patch deployment argocd-repo-server -n argocd \
  --patch-file argocd/cmp-repo-server.yaml  # sidecar + helm/helmfile binaries
kubectl patch configmap argocd-cmp-cm -n argocd --type merge -p \
  '{"data": {"plugins": "cmp-helmfile"}}'   # register the plugin
```

Restart the repo-server, then verify:

```bash
kubectl rollout restart deployment argocd-repo-server -n argocd
kubectl logs -n argocd deployment/argocd-repo-server -c helmfile | tail
```

The sidecar should start and pick up the plugin definition.

### 3. Adjust the environment values

Edit `helmfile/environments/example.yaml` (domains, realm, OIDC endpoints,
ingress class) and `argocd/openedusuite-apps/values.yaml` (repoURL, namespace,
secrets via `global.helmfilePluginEnv`). The child Applications inherit these
on the next sync.

### 4. Deploy

```bash
kubectl apply -f argocd/root-application.yaml
```

The root Application creates the 27 child Applications. ArgoCD syncs them in
wave order (`1` observability first, then `5` for all services). Sync each
child when its predecessors are healthy:

```bash
argocd app sync -l 'app.kubernetes.io/part-of in (openedusuite), argocd.argoproj.io/sync-wave in (1,5)'
# or per-app:
argocd app sync moodle
```

## Opt-in services (rendered empty by default)

Two services are declared in `openedusuite-apps/values.yaml` but render **no
resources** with the shipped `example` environment: `kasmvnc` and `overleaf`.
Their charts are pulled from public OCI registries (not vendored into
`helmfile/`), so they are set to `enabled: false` in
`helmfile/environments/example.yaml`. Flip them to `enabled: true` there if
those registries are reachable from your cluster.

## Day-to-day

- **Enable/disable a service:** set `enabled: false` in
  `openedusuite-apps/values.yaml` and sync the root app — the child Application
  stays but is skipped, or you can prune it.
- **Change values for a service:** edit `helmfile/environments/example.yaml` or
  `helmfile/apps/edu/<app>/values.yaml.gotmpl`; just refresh the child app.
- **Add a service:** drop a new dir under `helmfile/apps/edu/`, add an entry to
  `openedusuite-apps/values.yaml` (copy any sibling, set `release:` to the new
  helmfile release name), and sync the root app.

## ApplicationSet alternative

Prefer generated Applications over a static chart? The same wiring works with a
[Git file generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Git/)
over `helmfile/apps/edu/**` — no `values.yaml` bookkeeping needed:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: openedusuite-apps
  namespace: argocd
spec:
  goTemplate: true
  generators:
    - git:
        repoURL: https://github.com/openEduSuite/openEduSuite-public.git
        revision: main
        directories:
          - path: helmfile/apps/edu/*
  template:
    metadata:
      name: '{{ .path.basename }}'
      annotations:
        argocd.argoproj.io/sync-wave: "5"
    spec:
      project: default
      source:
        repoURL: https://github.com/openEduSuite/openEduSuite-public.git
        targetRevision: main
        path: helmfile
        plugin:
          name: helmfile
          env:
            - name: HELMFILE_GLOBAL_OPTIONS
              value: '--file helmfile.yaml.gotmpl --environment example --namespace openedusuite --allow-no-matching-release -l name={{ .path.basename }}'
      destination:
        server: https://kubernetes.default.svc
        namespace: openedusuite
      syncPolicy:
        automated:
          prune: true
          selfHeal: false
```

(You will still need per-service release-name mapping for apps whose helmfile
release name differs from the directory — `opencloud` → `opendesk-opencloud`,
`monitoring` → `blackbox-probes`.)

## References

- [ArgoCD Config Management Plugins](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins/)
- [Helmfile plugin for ArgoCD](https://github.com/travisghansen/argo-cd-helmfile)
- This wrapper mirrors the production App-of-Apps pattern used for the
  openEduSuite HRZ deployment (sanitized): ArgoCD → helmfile → charts.
