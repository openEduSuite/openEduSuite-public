<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# 1. Introduction and Goals

## 1.1 Goals

The public openEduSuite distribution makes a **digital-sovereign education
workspace** available as open source: a lightweight, deployment-agnostic
**service portal** plus the **deployment artifacts** (helmfile trees, local
Helm charts, GitOps wrappers) an institution needs to run its own openEduSuite
services. It is based on [openDesk](https://github.com/Bundesdruckerei/opendesk)
from ZenDiS.

The distribution is **sanitized by design**: it ships placeholders
(`example.org`, `CHANGEME`) instead of the operator-specific configuration the
production deployment carries. Any university, school or public body can adopt
it without inheriting another operator's hostnames, secrets or infrastructure.

## 1.2 Quality Goals

| Rank | Quality Goal | Rationale |
|------|--------------|-----------|
| 1 | **Deployment-agnostic portability** | The image and the manifests render cleanly with only placeholder configuration; the config-portability unit test guards this |
| 2 | **Digital sovereignty / open source** | Apache-2.0 core, no proprietary components, REUSE/SPDX headers, `publiccode.yml` metadata |
| 3 | **Reproducible deployment** | Local + vendored charts make `helmfile template` work fully offline; GitOps wrappers mirror the proven production chain |
| 4 | **Simple operations** | Static SPA (no backend), health endpoints, runtime config via ConfigMap, oauth2-proxy for SSO |
| 5 | **Usable UX** | SSO-aware tiles, i18n (de/en/fr/zh), dark mode, widgets |

## 1.3 Stakeholders

| Stakeholder | Expectations |
|-------------|--------------|
| **Adopting institution (operator)** | Portable artifacts, simple onboarding, no upstream leakage, Apache-2.0 |
| **End users** (staff, students, guests) | Reliable, SSO-friendly access to all services in one place |
| **openDesk / ZenDiS community** | Open-source reference that feeds back into the upstream project |
| **Security / data protection officer** | No secrets in the repo, GDPR-ready placeholder conventions |

---

[Back to index](./README.md)
