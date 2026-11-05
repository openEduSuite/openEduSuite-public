<!--
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: Apache-2.0
-->

# C4 — Level 3: Component (openEduSuite Portal)

> **Focus:** the components of the portal frontend — the only first-class code
> component in the distribution. Maps to arc42
> [§5.2 Level 2 — Portal](../05-building-block-view.md#52-level-2--portal).

```mermaid
flowchart TB
    SPA["<b>Portal SPA</b>"]
    CFG["<b>ConfigLoader</b><br/>src/config.ts"]
    HOME["<b>Home</b><br/>src/pages/Home.tsx"]
    CARD["<b>ServiceCard</b><br/>components/"]
    NEWS["<b>NewsFeeds</b><br/>components/"]
    WX["<b>WeatherWidget</b><br/>components/"]
    I18N["<b>i18n</b><br/>i18next · locales de/en/fr/zh"]
    THEME["<b>Theme</b><br/>src/theme.ts · useTheme.ts"]
    LOC["<b>locales</b><br/>*.json · service ids (29)"]

    SPA --> CFG
    SPA --> HOME
    HOME --> CARD
    HOME --> NEWS
    HOME --> WX
    HOME --> I18N
    HOME --> THEME
    CARD --> I18N
    NEWS --> CFG
    I18N --> LOC
    CFG -->|"GET /config.json (no-store)"| API["/config.json"]
    HOME -->|"GET /oauth2/auth"| OAUTH["oauth2-proxy"]
```

## Components

| Component | Responsibility | Notable behavior |
|-----------|----------------|------------------|
| **ConfigLoader** | Fetch + validate runtime config; fallback to `src/config.default.json` | `cache: no-store`; portability test |
| **Home** | Page assembly: header (SSO/theme/language), hero, sections/tiles, widgets, footer | Landing vs. signed-in render |
| **ServiceCard** | One service tile | Localized name/description, SSO badge, new-tab launch |
| **NewsFeeds** | Same-origin Atom/RSS cards | `FEED_*` proxy paths, `max` entries |
| **WeatherWidget** | Weather iframe | External `src`, i18n title |
| **i18n** | Language resolution + t() | Browser detection, persisted switcher, key-completeness test |
| **Theme** | Light/dark theme | OS default, persisted override |

---

[Back to the C4 models](./README.md)
