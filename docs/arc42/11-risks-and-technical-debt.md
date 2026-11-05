<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 11. Risks and Technical Debt

## 11.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Drift between public variants and upstream production** — sanitization and fixes are applied manually (see `helmfile/README.md` "Fixes applied") | Deployed apps may diverge from the operator's real setup | Render leak check + regular upstream sync; fixes are documented so they can be ported back |
| **Shared-root selector coupling** — ArgoCD children depend on `-l name=<release>` mapping | New apps need a values entry + correct release name, or the Application renders empty | Documented procedure in `argocd/README.md`; release-name check tooling |
| **OCI-registry dependency (opt-in apps)** | Outbound registry access required; offline render no longer guaranteed | Disabled in `example` by default; explicitly documented |
| **kubara is experimental** | Catalogs/chart generation may change shared components (e.g. cert-manager CRDs) the helmfile charts reference | kubara documented as evaluation channel; production path stays plain ArgoCD |
| **Single 'example' environment** | Adopters with multiple clusters need their own environments | `helmfile/environments/<env>.yaml` is the designed extension point |

## 11.2 Technical Debt

| Item | Note |
|------|------|
| `paperless-ngx` chart lint fails | Chart metadata declares `postgresql`/`redis` dependencies that are not vendored; lint (`helmfile lint`) is an advisory — rendering and install use `--skip-deps` |
| Manual release-name mapping (opencloud, monitoring) | Historical release names (`opendesk-opencloud`, `blackbox-probes`) differ from directory names; selectors compensate |
| Flat sync waves | No per-app dependency ordering in the public subset (no `needs:`) — ordering may need tuning for specific adopters |
| Static values files | `helmfile/environments/example.yaml` is plain YAML; secret management (SOPS/external-secrets) is documented but not enforced |

## 11.3 Deprecated / removed

- The 29,704-line monolithic manifest approach was replaced by the App-of-Apps
  pattern (upstream openDesk history).
- Backchannel, provisioning, and data-loader jobs are **out of scope** for the
  public distribution.

---

[Back to index](./README.md)
