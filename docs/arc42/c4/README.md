<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# C4 Models — openEduSuite (public distribution)

Architecture diagrams in the [C4 model](https://c4model.com/) style (Simon
Brown) for the public openEduSuite distribution. Diagrams are Mermaid code
blocks, rendered natively by GitHub/GitLab and VS Code — no build tooling.

## Levels

| Level | View | Purpose | File |
|-------|------|---------|------|
| 1 | **System Context** | openEduSuite distribution in context of users, IdP, services and GitOps | [level-1-system-context.md](./level-1-system-context.md) |
| 2 | **Container** | Portal containerization + platform-as-code + GitOps containers | [level-2-container.md](./level-2-container.md) |
| 3 | **Component** | Portal frontend components (the only first-class code component) | [level-3-component.md](./level-3-component.md) |

All diagrams use `example.org` placeholders — matching the sanitized public
artifacts.

---

[Back to the arc42 documents](../README.md)
