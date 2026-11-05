<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# openEduSuite — Architecture Documentation (arc42)

> **Version:** 1.0
> **Date:** 2026-11-05
> **Classification:** Public
> **Status:** Maintained (openEduSuite-public distribution)

This documentation follows the [arc42 template](https://arc42.org) (version 8),
one file per section. It describes the architecture of the **public
openEduSuite distribution** — the configurable SSO portal plus the sanitized
**app deployment variants** (helmfile tree) and the **GitOps wrappers**
(ArgoCD / kubara) shipped in this repository.

The docs are deliberately **sanitized**: all examples use `example.org`
placeholders, no operator-specific hostnames, secrets or internal references
appear anywhere. The same goes for the code and manifest artifacts — see the
[sanitization table](../../helmfile/README.md#sanitization-applied-to-these-variants).

## Sections

| # | Section | File |
|---|---------|------|
| 1 | Introduction and Goals | [01-introduction-and-goals.md](./01-introduction-and-goals.md) |
| 2 | Constraints | [02-constraints.md](./02-constraints.md) |
| 3 | Context and Scope | [03-context-and-scope.md](./03-context-and-scope.md) |
| 4 | Solution Strategy | [04-solution-strategy.md](./04-solution-strategy.md) |
| 5 | Building Block View | [05-building-block-view.md](./05-building-block-view.md) |
| 6 | Runtime View | [06-runtime-view.md](./06-runtime-view.md) |
| 7 | Deployment View | [07-deployment-view.md](./07-deployment-view.md) |
| 8 | Cross-cutting Concepts | [08-cross-cutting-concepts.md](./08-cross-cutting-concepts.md) |
| 9 | Architecture Decisions | [09-architecture-decisions.md](./09-architecture-decisions.md) |
| 10 | Quality Requirements | [10-quality-requirements.md](./10-quality-requirements.md) |
| 11 | Risks and Technical Debt | [11-risks-and-technical-debt.md](./11-risks-and-technical-debt.md) |
| 12 | Glossary | [12-glossary.md](./12-glossary.md) |

## C4 Models

| Level | View | File |
|-------|------|------|
| 1 | System Context | [c4/level-1-system-context.md](./c4/level-1-system-context.md) |
| 2 | Container | [c4/level-2-container.md](./c4/level-2-container.md) |
| 3 | Component | [c4/level-3-component.md](./c4/level-3-component.md) |

The diagrams are Mermaid code blocks rendered natively by GitHub/GitLab and
VS Code — no build tooling required.

## Quick orientation

- **[Portal](./04-solution-strategy.md#the-portal)**: static React SPA, runtime
  `/config.json`, SSO state probed via `oauth2-proxy`.
- **[Deployment variants](./05-building-block-view.md#the-platform-as-code-artifact)**:
  27 helmfile app releases + 24 local charts + 4 vendored charts, driven by the
  placeholder environment [`helmfile/environments/example.yaml`](../../helmfile/environments/example.yaml).
- **[GitOps wrappers](./05-building-block-view.md#the-gitops-wrappers)**:
  ArgoCD App-of-Apps (`argocd/`) and kubara platform bootstrap (`kubara/`), both
  rendering the same helmfile tree.

---

[Back to repository README](../../README.md)
