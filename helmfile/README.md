# App deployment variants (helmfile)

Sanitized, publicly publishable variants of the openEduSuite app deployment
manifests. These are the `helmfile/apps/edu/*` trees plus the local charts
they reference, with all operator-specific values replaced by placeholders.

## What's included

| Path | Contents |
|---|---|
| `apps/edu/<app>/` | Per-app helmfile + values (gotmpl) for the portal-tiled apps: **ilias, sogo, opencloud, etherpad, jupyterhub, moodle, bigbluebutton, bookstack, code-server, drawio, excalidraw, limesurvey, mayan-edms, n8n, ollama, open-webui, paperless-ngx, planka, rstudio, slidev, snipr, ttyd, typo3, zammad** plus monitoring (blackbox-probes, OTel collector, Tempo). **kasmvnc** and **overleaf** are included but disabled in `environments/example.yaml`: their charts are only available as OCI artifacts (`oci://registry.kasmweb.com/kasmweb/charts/kasmvnc`, `oci://ghcr.io/sharelatex/overleaf-helm-chart/overleaf`) that are not publicly pullable, so they are not vendored — enable them only where those registries are reachable |
| `charts/<chart>/` | Local Helm charts referenced by the apps (`sogo`, `ilias`, `moodle`, `opencloud`, `etherpad`, `blackbox-probes`, `opentelemetry-collector`, `tempo`, `common` library) |
| `vendor/charts/jupyterhub/` | Vendored upstream [jupyterhub helm chart](https://hub.jupyter.org/helm-chart) v4.4.0 |
| `vendor/charts/{code-server,ollama,open-webui}/` | Vendored upstream charts (see each `Chart.yaml` `opendesk/upstream-*` annotations for source repo + version) |
| `helmfile.yaml.gotmpl` | Root helmfile — globs `apps/edu/*/helmfile.yaml.gotmpl` |
| `helmfile-defaults.yaml.gotmpl` | Shared default values |
| `environments/example.yaml` | **Placeholder environment** — edit this before deploying |

## Quick start

```bash
cd helmfile
cp environments/example.yaml environments/myenv.yaml   # edit placeholders
helmfile -f helmfile.yaml.gotmpl -e myenv template     # render & inspect
helmfile -f helmfile.yaml.gotmpl -e myenv diff         # compare with cluster
helmfile -f helmfile.yaml.gotmpl -e myenv apply        # deploy
```

Requirements: `helm` v3 + `helmfile` (v0.16x+). No remote chart repositories
are needed — all charts are local or vendored.

## Placeholders to replace (`environments/example.yaml`)

- **Domains**: everything is `<service>.example.org` (`global.domain`, `apps.keycloak.host`, `apps.sogo.host`, `global.hosts.*`). Ingress hosts, OIDC issuer/redirect URLs and mail domains are all derived from these.
- **LDAP**: `ldap.host`, `ldap.baseDN`, `ldap.sogoBindDN`, `ldap.sogoBindPassword`.
- **Database**: `databases.sogo.*`.
- **Secrets**: the whole `secrets:` tree is `CHANGEME`/empty. **Never commit real secrets** — use SOPS, sealed-secrets or external-secrets in production (the values files are plain YAML by design).
- **Storage**: `persistence.storageClassNames.RWO` and per-app `persistence.storages.*.storageClassName`.
- **Ingress class**: `ingress.className` (app values may hardcode `haproxy` — adjust per app if you use another controller).

## Sanitization applied to these variants

The upstream (private) manifests contain operator-specific literals. The
public variants replace them systematically:

| Original pattern | Public placeholder |
|---|---|
| `*.opendesk.hrz.uni-marburg.de`, `opendesk.hrz.uni-marburg.de` | `*.opendesk.example.com` |
| `hrz.uni-marburg.de`, `uni-marburg.de` (e.g. apt proxy) | `example.com` / `example.org` |
| `*.openedusuite.org` deployment hosts, `mailDomain: openedusuite.org` | `*.example.org` / `example.org` |
| `ghcr.io/opendesk-edu/*`, `ghcr.io/opendesk/*` images | `ghcr.io/openedusuite/*` |
| `registry.gitlab.com/<org>/opendesk-kubectl` | `registry.example.com/opendesk/kubectl` |
| Internal LDAP DN `dc=swp-ldap,dc=internal`, `ums-ldap-server-primary` | `dc=example,dc=org`, `ldap` |
| Internal IP allowlists (e.g. `192.168.3.201`) | `192.0.2.10` (RFC 5737 TEST-NET-1) |
| Dev passwords (`sogo-password`, `sogo-ldap-password`) | `CHANGEME` |
| Hardcoded HRZ apt egress proxy in the SOGo entrypoint | removed — now opt-in via `sogo.aptProxy` |

Fixes applied on top of sanitization (also worth porting upstream):

- `charts/etherpad`, `charts/ilias`, `charts/sogo`: `monitoring:` blocks were
  nested under the wrong parent (`postgresql:`/`sso:`/top-level) — moved to
  `<app>.monitoring` where templates actually read them.
- `charts/ilias/values.yaml`: added missing `mariadbBackup`, `networkPolicy`,
  `pdb` defaults that templates reference directly.
- `apps/edu/ilias/values.yaml.gotmpl`: quoted ints (`autoUpdate: "0"`, …) and
  empty-object overrides (`phpConfig: {}`) violated the chart's
  `values.schema.json` — now uses chart defaults / proper types.
- `apps/edu/opencloud/values.yaml.gotmpl`: stray mis-indented `pdb:`/`monitoring:`
  block after `urlSigningSecret:` made the rendered values invalid YAML — now a
  proper `opencloud:` section.
- `apps/edu/moodle/helmfile.yaml.gotmpl`: `needs: [opendesk/moodle-pvc]`
  references a release outside this subset — commented out.
- `apps/edu/jupyterhub/helmfile.yaml.gotmpl`: chart path corrected to
  `../../../vendor/charts/jupyterhub`.
- Public-variant conventions applied across the copied app/chart trees (all marked in-file):
  - `{{- with .Values.annotations.<app>.<kind> }}` guards around empty annotation maps (`toYaml | nindent` on `{}` emits invalid YAML).
  - `# --- public-variant defaults ... ---` blocks appended to chart `values.yaml` / `environments/example.yaml` where templates dereference keys the upstream values omitted (nil-pointer guards); scalars where the template expects scalars.
  - `dig ... .Values` inside `range` loops corrected to `$.Values` (excalidraw, limesurvey ingress).
  - `"Values" .Values` added to `common.deployment` dicts (drawio, excalidraw, rstudio, slidev, ttyd) so the `common` library chart can read `.Values.*`.
  - Numeric `resources.limits.cpu` quoted where a chart schema requires string; string-form `ingress.hosts` converted to `{host, paths}` objects where the schema requires objects.
  - Remote `dependencies:` removed from vendored `Chart.yaml`s whose subcharts are already packaged under `charts/`; broken `annotations:` indentation in vendored `Chart.yaml`s repaired.
  - `version:` pins removed from local-path chart releases in kasmvnc/overleaf app helmfiles (invalid for `file`/local charts).
- `vendor/charts/jupyterhub/Chart.yaml`: fixed inconsistent indentation that
  made it unparseable.
- Empty per-resource annotation maps now render safely (`with` guards) instead
  of emitting a bare `{}` that broke YAML parsing.

## GitOps wrappers (ArgoCD / kubara)

The helmfile tree above is the portable substrate. On top of it this repo also
ships the same GitOps wrapper production uses:

- [`argocd/`](../argocd/README.md) — ArgoCD **App-of-Apps** (one `Application`
  per service, rendered through the helmfile CMP). Install the CMP, apply the
  root application, done.
- [`kubara/`](../kubara/README.md) — kubara bootstraps ArgoCD + the platform
  layer (cert-manager, kyverno, external-secrets, …); the openEduSuite apps
  deploy through the same `argocd/` wrapper.

Both render exactly these helmfiles — they add the GitOps operator, they do
not add a second deployment format.

## Verifying a render

```bash
helmfile -f helmfile.yaml.gotmpl -e example template > /tmp/rendered.yaml
grep -cE 'hrz\.uni-marburg|uni-marburg\.de|openedusuite\.org|swp-ldap' /tmp/rendered.yaml   # must be 0
```

## License

Each file keeps its own SPDX header. The portal app is Apache-2.0; several
charts are AGPL-3.0-or-later (see `../LICENSES/`). The vendored jupyterhub
chart is upstream Apache-2.0.
