// SPDX-FileCopyrightText: 2026 openEduSuite Contributors
// SPDX-License-Identifier: Apache-2.0
//
// customIntegrations.ts — Register der SSO-integrierten Eigenentwicklungen
// (Single Source, Praesentationsschicht P-02).
//
// Das Register fuehrt alle Custom-Tools und Erweiterungen, die "nicht von
// der Stange" sind — also ueber den Katalog-Dienstbestand hinausgehen und
// eigenentwickelt/integriert wurden (BBB-Kurzlink-Relay, SOGo-us5-Build,
// TOSS-OIDC-Fix, Gruppen-Gate, /api/me, Admin-Arbeitsbereich, Testpyramide,
// Blackbox-Probes, Drift-Guards). Jede Integration beschreibt Name (i18n),
// Zweck, betroffene Dienste, Verifikation (Test-Referenz), Repo/Datei und
// Betriebshinweis — siehe specs/entscheider-ebene (Requirement "Register
// der SSO-integrierten Eigenentwicklungen").
//
// Schema (alle Felder Pflicht):
//   id           Slug, eindeutig, ^[a-z0-9]+(-[a-z0-9]+)*$
//   nameKey      i18n-Key des Anzeigenamens (INTEGRATION_I18N de/en/fr/zh)
//   purpose      Zweck der Eigenentwicklung (Deutsch, Inhaltstext)
//   services     betroffene Katalog-Dienst-IDs (validiert gegen Katalog) oder
//                [SERVICE_WILDCARD] = alle Katalog-Dienste (querschnittlich)
//   verification Test-Referenz(en): ';'-getrennte Repo-Pfade (L1/L2/L3/L4),
//                deren Existenz der Unit-Test gegen das Repo prueft
//   repoFile     Doku-/Quelldatei im Repo (';'-getrennt bei mehreren)
//   operational  Betriebshinweis (Deutsch)
//
// Validierung: `validateCustomIntegrations` prueft das Schema deterministisch;
// customIntegrations.test.ts haelt das Register gruen, gleicht services[]
// gegen den Katalog ab (DEFAULT_CONFIG + deployte ConfigMap) und beweist
// Duplikat-ID/leere Pflichtfelder/unbekannte IDs als rot.

/** Eine Eigenentwicklung/Custom-Integration des SSO-Portals. */
export interface CustomIntegration {
  /** Eindeutiger Slug, z. B. `bbb-shortlink-relay`. */
  id: string;
  /** i18n-Key des Anzeigenamens, z. B. `integrationen.items.bbbShortlinkRelay.name`. */
  nameKey: string;
  /** Zweck der Eigenentwicklung (Deutsch). */
  purpose: string;
  /** Betroffene Katalog-Dienst-IDs — oder `[SERVICE_WILDCARD]` für alle. */
  services: string[];
  /** Test-Referenz(en): ';'-getrennte Repo-Pfade (pw-Dateien, Unit-Tests, Registry). */
  verification: string;
  /** Doku-/Quelldatei im Repo (';'-getrennt bei mehreren). */
  repoFile: string;
  /** Betriebshinweis (Deutsch). */
  operational: string;
}

/** Sentinel in `services[]`: Integration betrifft ALLE Katalog-Dienste. */
export const SERVICE_WILDCARD = '*';

/** Sprachen des modul-eigenen i18n-Bundles (de/en Pflicht, fr/zh harmonisch). */
export const INTEGRATION_LANGS = ['de', 'en', 'fr', 'zh'] as const;
export type IntegrationLang = (typeof INTEGRATION_LANGS)[number];

/** Pflicht-Integrationen laut Spec (specs/entscheider-ebene P-02). */
export const REQUIRED_INTEGRATION_IDS = [
  'bbb-shortlink-relay',
  'sogo-us5-build',
  'toss-oidc-identity-fix',
  'oauth2-proxy-group-gate-admin',
  'portal-nginx-api-me',
  'admin-arbeitsbereich',
  'sso-testpyramide-playwright',
  'blackbox-probes',
  'check-portal-config-drift-guard',
] as const;

/**
 * Das Register (Single Source of Truth). Reihenfolge = Darstellungsreihenfolge
 * der Karten auf /integrationen.
 */
export const CUSTOM_INTEGRATIONS: readonly CustomIntegration[] = [
  {
    id: 'bbb-shortlink-relay',
    nameKey: 'integrationen.items.bbbShortlinkRelay.name',
    purpose:
      'Kompakte /r/-Kurzlinks für BBB-Join-URLs in Kalendereinträgen: Die signierten Join-URLs (~190 Oktette) werden vom 75-Byte-Zeilenbruch der iCalendar-DESCRIPTION abgeschnitten, sodass beim Klick die Raum-ID fehlt. Der Relay antwortet auf /r/<meetingID>/<pw><rolle> mit 302 auf die frisch signierte BBB-v2-Join-URL — Deny-by-default (nur GET/HEAD, keine Query/Fragments, kleines Hex-Format). Der Kalender-Overlay (nc-picker-calendar.js) persistiert seit 2026-11-13 nur noch die Viewer-Zeile (Zuschauer/Link) — der Moderator-Link (eingebettetes Moderator-Passwort) wird dem Erzeuger out-of-band übergeben und nie in die geteilte DESCRIPTION geschrieben, damit eingeladene Teilnehmer nicht als Moderator beitreten können (Moderation-Hygiene, s. docs/bbb-room-description.md). Seit der Unification 2026-11-16 steht der Overlay im MAIN-Tenant zurück (Overlay detectet das native #bbb-conference-Element des Fork-Editors und injiziert dort keinen Button); der Text-Link-Pfad bleibt Staff/Students vorbehalten (s. docs/bbb-interconnection.md § 3).',
    services: ['bbb-internal', 'sogo-staff', 'sogo-students'],
    verification: 'bbb-relay/cmd/bbb/shortlink_test.go; tests/nc-picker-calendar-core.test.mjs; tests/sso/pw/pw-calendar-bbb.mjs',
    repoFile: 'bbb-relay/cmd/bbb/shortlink.go; k8s/openedusuite/nc-picker-calendar.js',
    operational:
      'Eigenes Relay-Deployment sogo-bbb-relay (k8s/openedusuite/deploy-sogo-bbb-relay.yaml) mit separatem Listener für /r/ + /healthz; Netzwerk-Policies erlauben nur HAProxy sowie die SOGo-Tenants staff/students.',
  },
  {
    id: 'sogo-us5-build',
    nameKey: 'integrationen.items.sogoUs5Build.name',
    purpose:
      'Eigener SOGo-5.12.13-Build (bookworm-5.12.13-us5): Fix A zentralisiert compare-before-write in SOGoUserProfile.synchronize() — die unveränderte Settings-Zeile wird beim eventslist-Reload nicht mehr ge-UPDATEt und die drei SOGo-Worker deadlocken nicht mehr (InnoDB-Deadlock, HTTP 501, endloser Wochenansicht-Spinner). Zusätzlich SOPE-xoauth2-Patch (SOPE-NGSmtpClient.m) für die OAuth2-Mail-Auslieferung.',
    services: ['sogo-staff', 'sogo-students'],
    verification:
      'tests/sso/pw/pw-us52-sogo5calendar-nav.mjs; tests/sso/pw/pw-raw-xoauth2.mjs',
    repoFile: 'docs/openedusuite-sogo-image.md',
    operational:
      'Image sogo:bookworm-5.12.13-us5 (Registry 192.0.2.11:5002); Build-Kontext versioniert im externen Image-Repo (BUILD-CONTEXT.md), Rollout über die drei SOGo-Tenant-Deployments (k8s/openedusuite*/deploy-sogo.yaml).',
  },
  {
    id: 'toss-oidc-identity-fix',
    nameKey: 'integrationen.items.tossOidcIdentityFix.name',
    purpose:
      'TOSS-OIDC-Login brach nach der Keycloak-Realm-Migration mit auth_email_conflict ab. Das SQL-/Skript-Paar bereinigt die Identitäts-Verknüpfungen (E-Mail-Konflikt) so, dass der native OIDC-Login wieder funktioniert; pw-toss-sso.mjs sichert den Login als Regressionstest.',
    services: ['toss', 'keycloak'],
    verification: 'tests/sso/pw/pw-toss-sso.mjs',
    repoFile: 'scripts/toss-oidc-identity-fix.sql',
    operational:
      'Nach Realm-Migrationen ausführen (scripts/toss-oidc-identity-fix.sh, Anleitung scripts/keycloak-realm-migration/README.md); TOSS läuft ohne oauth2-proxy (natives OIDC).',
  },
  {
    id: 'oauth2-proxy-group-gate-admin',
    nameKey: 'integrationen.items.oauth2ProxyGroupGateAdmin.name',
    purpose:
      'Scharfes Gruppen-Gate für das Admin-Portal: oauth2-proxy (admin) wertet --oidc-groups-claim=groups aus und lässt nur die Keycloak-Gruppe /portal-admins durch (403 sonst) — der Admin-Zugriff ist damit rollenbasiert, nicht nur authentisiert.',
    services: ['keycloak'],
    verification: 'tests/sso/check-admin-gate.mjs; tests/sso/pw/pw-admin-sso.mjs',
    repoFile: 'k8s/openedusuite/deploy-oauth2-proxy-admin.yaml',
    operational:
      'Gate ist Teil des oauth2-proxy-Admin-Deployments; Gruppen-Mitgliedschaft wird in Keycloak (Gruppe portal-admins) gepflegt; Claim-/Gruppen-Änderungen erfordern einen Proxy-Rollout.',
  },
  {
    id: 'portal-nginx-api-me',
    nameKey: 'integrationen.items.portalNginxApiMe.name',
    purpose:
      'Same-origin /api/me im Portal-Nginx: spiegelt den oauth2-proxy-Header X-Auth-Request-Groups (URL-kodierte Gruppenpfade, z. B. %2Fportal-admins) als JSON. Die Portal-SPA leitet daraus ausschließlich den Admin-Nachweis (isAdmin) ab — progressiv: jeder Fehler ergibt isAdmin=false, niemals einen Wurf.',
    services: ['keycloak'],
    verification: 'collab-dashboard/src/lib/portalAuth.test.ts',
    repoFile: 'k8s/openedusuite/configmap-portal-nginx.yaml',
    operational:
      'Route liegt in der Portal-Nginx-ConfigMap; Semantik-Vertrag (URL-Dekodierung, Fehler-Fallback) ist in collab-dashboard/src/lib/portalAuth.ts fixiert und dort unit-getestet.',
  },
  {
    id: 'admin-arbeitsbereich',
    nameKey: 'integrationen.items.adminArbeitsbereich.name',
    purpose:
      'Admin-Arbeitsbereich der Portal-SPA (Route /admin): rendert die Admin-Einträge nur mit Nachweis isAdmin=true aus /api/me (Keycloak-Gruppe /portal-admins); ohne Nachweis Redirect auf die Startseite — kein Flackern von Admin-Inhalten, während die Abfrage läuft.',
    services: ['keycloak'],
    verification: 'collab-dashboard/src/pages/Admin.test.tsx; tests/sso/pw/pw-admin-portal.mjs',
    repoFile: 'collab-dashboard/src/pages/Admin.tsx',
    operational:
      'Route /admin ist über AdminRoute (App.tsx) an die Gruppe /portal-admins gebunden; Erreichbarkeit des Admin-Portals zusätzlich durch das oauth2-proxy-Gruppen-Gate doppelt abgesichert.',
  },
  {
    id: 'sso-testpyramide-playwright',
    nameKey: 'integrationen.items.ssoTestpyramidePlaywright.name',
    purpose:
      'SSO-Testpyramide mit Playwright: Die App→Test-Matrix (app-test-registry.json) ordnet jedem Katalog-Dienst L3-Browser-Tests (tests/sso/pw) und E2E-Suiten zu. check-app-test-matrix.mjs erzwingt als L2-Vertragstest Vollständigkeit: Registry-Eintrag vorhanden, referenzierte Dateien existieren, jeder L3-Test adressiert den App-Host.',
    services: [SERVICE_WILDCARD],
    verification: 'tests/sso/check-app-test-matrix.mjs; tests/sso/app-test-registry.json',
    repoFile: 'tests/sso/SSO-TEST-PYRAMID.md',
    operational:
      'Läuft in tests/sso/run-sso-e2e.sh (Ebene 1) und im Repo-Hygiene-Workflow; jeder neue Katalog-Dienst braucht einen Registry-Eintrag, sonst schlägt der Vertragstest rot.',
  },
  {
    id: 'blackbox-probes',
    nameKey: 'integrationen.items.blackboxProbes.name',
    purpose:
      'Blackbox-Monitoring (L4 der Testpyramide): blackbox-exporter-Probes und PrometheusRules überwachen fortlaufend Erreichbarkeit und Verhalten aller App-Hosts — einschließlich externer Uni-Tiles und Infra-Kacheln, die bewusst kein Keycloak-SSO haben und daher nicht per Login-Test geprüft werden.',
    services: [SERVICE_WILDCARD],
    verification: 'tests/sso/app-test-registry.json',
    repoFile: 'helmfile/charts/blackbox-probes/values.yaml',
    operational:
      'Helm-Chart helmfile/charts/blackbox-probes (PrometheusRule-Alerts werden chart-level aus .Values.alerts.enabled gelesen); fehlende Probes schlagen als Alerts an, nicht erst im Incident.',
  },
  {
    id: 'check-portal-config-drift-guard',
    nameKey: 'integrationen.items.checkPortalConfigDriftGuard.name',
    purpose:
      'Drift-Guards gegen Konfigurations-Drift: check-portal-config.mjs gleicht die config.json des Repo-Manifests mit der LIVE-ConfigMap ab (ssoEnabled je Dienst); pw-drift-guards.mjs sichert live Invarianten wie bbb-internal-launchUrl, Realm-Issuer und JWKS-kid gegen Abweichen.',
    services: [SERVICE_WILDCARD],
    verification: 'tests/sso/check-portal-config.mjs; tests/sso/pw/pw-drift-guards.mjs',
    repoFile: 'k8s/openedusuite/configmap-portal.yaml',
    operational:
      'check-portal-config.mjs läuft ohne Playwright gegen den Cluster (Exit 1 bei Drift); pw-drift-guards.mjs dient als Abnahme-Check nach Deployments; die LIVE-config.json ist Single Source of Truth.',
  },
  {
    id: 'n8n-invoiceninja',
    nameKey: 'integrationen.items.n8nInvoiceninja.name',
    purpose:
      'n8n kann die Invoice-Ninja-REST-API intern erreichen (kurzer Service http://invoiceninja/api/v1/*) und authentifiziert via X-Api-Token aus dem sops-Secret invoiceninja-api-token (Secret -> Container-Env -> $env.-Expression im Workflow). Der Connectivity-Workflow (k8s/n8n/workflows/invoiceninja-connectivity-check.json) erzeugt je Lauf eine DRAFT-Rechnung (status_id=1, po_number N8N-CONNECTIVITY-<JJJJMM>, Preis 0) — damit ist die Schritt-4-Abnahme „Draft in IN sichtbar" per n8n-Execution belegbar. NetworkPolicy allow-n8n-to-invoiceninja erlaubt n8n -> invoice-ninja:80 explizit.',
    services: ['n8n'],
    verification: 'tests/test_n8n_invoiceninja_workflow.py',
    repoFile: 'k8s/n8n/workflows/invoiceninja-connectivity-check.json',
    operational:
      'Geheimnis floesst sops -> Secret invoiceninja-api-token -> env (IN_API_URL/IN_API_TOKEN) in deploy-n8n.yaml; Workflow-Import von Hand im n8n-UI (Manual Trigger); Gotcha: X-Api-Token-Wert im Header nicht doppelt quoten. LIVE-Abnahme nach Deploy: Workflow ausführen, Execution-Log pruefen, Draft-Rechnung in IN (invoicing.example.org) sichtbar.',
  },
  {
    id: 'litellm-ai-gateway',
    nameKey: 'integrationen.items.litellmAiGateway.name',
    purpose:
      'Zentraler AI-Gateway (LiteLLM) vor dem lokalen Qwen3-Next-80B-Modell; alle KI-Consumer der Suite routen darüber.',
    services: ['open-webui', 'openscience', 'f13', 'dify', 'n8n', 'nextcloud', 'openproject', 'xwiki', 'bbb-internal'],
    verification: 'tests/sso/check-litellm-gateway.mjs; tests/sso/check-litellm-manifests.mjs',
    repoFile: 'docs/services-llm.md',
    operational:
      'Endpoint litellm.llm.svc.cluster.local:4000/v1; Keys sops-Secret litellm; NetPol beschraenkt.',
  },
  {
    id: 'rt-support-triage',
    nameKey: 'integrationen.items.rtSupportTriage.name',
    purpose:
      'KI-Vor-Klassifizierung fuer das Helpdesk RT (rt.example.org, REST 1.0): Der n8n-Workflow k8s/n8n/workflows/rt-support-triage.json holt neue Tickets (Suche + Ticket-Load via $env.RT_API_URL/RT_API_TOKEN, Basic-Auth), redigiert PII, klassifiziert dann ueber den LiteLLM-AI-Gateway (OpenAI-kompatibel aus $env.LLM_API_URL/$env.LLM_API_KEY, Alias qwen3-30b) zu STRICT JSON {category, urgency, routing, summary (max. 3 Saetze)} und schreibt das Ergebnis im Live-Modus als RT-Kommentar (Marker N8N-TRIAGE = Idempotenz) plus Kurzmeldung an den Matrix-#support-Webhook ($env.MATRIX_SUPPORT_WEBHOOK) — Room-Payload nur Ticket-ID + Klassifizierung, keine PII. RT_TRIAGE_DRY_RUN ist Default true: ohne Env wird nur geloggt, nichts geschrieben. Zammad ist bewusst nicht verdrahtet (Design-Doc 2026-11-16, Entscheidung 1).',
    services: ['rt'],
    verification: 'tests/test_rt_support_triage.py',
    repoFile: 'k8s/n8n/workflows/rt-support-triage.json;docs/support-triage.md',
    operational:
      'Workflow per n8n-UI importieren (k8s/n8n/workflows/rt-support-triage.json); Credentials nur via Container-Env (sops -> Secret -> deploy-n8n.yaml): RT_API_URL, RT_USER, RT_API_TOKEN, RT_QUEUE, LLM_API_URL, LLM_API_KEY, MATRIX_SUPPORT_WEBHOOK. Erster Lauf bleibt Dry-Run (RT_TRIAGE_DRY_RUN ungesetzt = true); Live-Modus per RT_TRIAGE_DRY_RUN=false. Offline-Verifikation: pytest tests/test_rt_support_triage.py -q.',
  },
];

/**
 * Modul-eigenes i18n-Bundle für das Register (Namens- und UI-Keys), damit die
 * Seite ohne Änderung der globalen locales/*.json auskommt. de/en sind
 * Pflicht, fr/zh werden harmonisch mitgeführt (Hartanforderung des Changes).
 * Registriert in src/pages/Integrationen.tsx als Namespace `integrationen`.
 */
export const INTEGRATION_I18N: Record<IntegrationLang, Record<string, string>> = {
  de: {
    'integrationen.title': 'Eigenentwicklungen & SSO-Integrationen',
    'integrationen.subtitle':
      'Register der nicht „von der Stange“ gekauften Erweiterungen: jede Karte nennt Zweck, betroffene Dienste, den absichernden Regressionstest sowie Repo- und Betriebshinweis.',
    'integrationen.badgeVerified': '✓ testgesichert',
    'integrationen.servicesLabel': 'Betroffene Dienste',
    'integrationen.allServicesLabel': 'Alle Katalog-Dienste',
    'integrationen.verificationLabel': 'Verifikation (Regressionstest)',
    'integrationen.repoFileLabel': 'Repo / Datei',
    'integrationen.operationalLabel': 'Betriebshinweis',
    'integrationen.items.bbbShortlinkRelay.name': 'BBB-Kurzlink-Relay (/r/)',
    'integrationen.items.sogoUs5Build.name': 'SOGo-us5-Build (Fix A + SOPE-xoauth2)',
    'integrationen.items.tossOidcIdentityFix.name': 'TOSS-OIDC-Identitäts-Fix',
    'integrationen.items.oauth2ProxyGroupGateAdmin.name': 'oauth2-proxy-Gruppen-Gate (Admin-Portal)',
    'integrationen.items.portalNginxApiMe.name': 'Portal-Nginx /api/me',
    'integrationen.items.adminArbeitsbereich.name': 'Admin-Arbeitsbereich (/admin)',
    'integrationen.items.ssoTestpyramidePlaywright.name': 'SSO-Testpyramide (Playwright)',
    'integrationen.items.blackboxProbes.name': 'Blackbox-Probes (L4-Monitoring)',
    'integrationen.items.checkPortalConfigDriftGuard.name': 'Portal-Config-Drift-Guard',
    'integrationen.items.n8nInvoiceninja.name': 'n8n -> Invoice-Ninja (intern, Credential)',
    'integrationen.items.litellmAiGateway.name': 'AI-Gateway (LiteLLM, zentral)',
    'integrationen.items.rtSupportTriage.name': 'RT Support-Triage (n8n → LiteLLM)',
  },
  en: {
    'integrationen.title': 'Custom builds & SSO integrations',
    'integrationen.subtitle':
      'Register of extensions that are not off-the-shelf: every card states its purpose, affected services, the regression test that keeps it safe, plus repo and operations pointers.',
    'integrationen.badgeVerified': '✓ test-verified',
    'integrationen.servicesLabel': 'Affected services',
    'integrationen.allServicesLabel': 'All catalog services',
    'integrationen.verificationLabel': 'Verification (regression test)',
    'integrationen.repoFileLabel': 'Repo / file',
    'integrationen.operationalLabel': 'Operations note',
    'integrationen.items.bbbShortlinkRelay.name': 'BBB short-link relay (/r/)',
    'integrationen.items.sogoUs5Build.name': 'SOGo us5 build (Fix A + SOPE-xoauth2)',
    'integrationen.items.tossOidcIdentityFix.name': 'TOSS OIDC identity fix',
    'integrationen.items.oauth2ProxyGroupGateAdmin.name': 'oauth2-proxy group gate (admin portal)',
    'integrationen.items.portalNginxApiMe.name': 'Portal nginx /api/me',
    'integrationen.items.adminArbeitsbereich.name': 'Admin workspace (/admin)',
    'integrationen.items.ssoTestpyramidePlaywright.name': 'SSO test pyramid (Playwright)',
    'integrationen.items.blackboxProbes.name': 'Blackbox probes (L4 monitoring)',
    'integrationen.items.checkPortalConfigDriftGuard.name': 'Portal config drift guard',
    'integrationen.items.n8nInvoiceninja.name': 'n8n -> Invoice-Ninja (internal, credential)',
    'integrationen.items.litellmAiGateway.name': 'AI gateway (LiteLLM, central)',
    'integrationen.items.rtSupportTriage.name': 'RT support triage (n8n → LiteLLM)',
  },
  fr: {
    'integrationen.title': 'Développements propres & intégrations SSO',
    'integrationen.subtitle':
      'Registre des extensions non standard : chaque carte indique l’objectif, les services concernés, le test de régression qui la sécurise, ainsi que le dépôt et l’exploitation.',
    'integrationen.badgeVerified': '✓ sécurisé par test',
    'integrationen.servicesLabel': 'Services concernés',
    'integrationen.allServicesLabel': 'Tous les services du catalogue',
    'integrationen.verificationLabel': 'Vérification (test de régression)',
    'integrationen.repoFileLabel': 'Dépôt / fichier',
    'integrationen.operationalLabel': 'Note d’exploitation',
    'integrationen.items.bbbShortlinkRelay.name': 'Relais de liens courts BBB (/r/)',
    'integrationen.items.sogoUs5Build.name': 'Build SOGo us5 (Fix A + SOPE-xoauth2)',
    'integrationen.items.tossOidcIdentityFix.name': 'Correctif d’identité OIDC TOSS',
    'integrationen.items.oauth2ProxyGroupGateAdmin.name': 'oauth2-proxy group gate (portail admin)',
    'integrationen.items.portalNginxApiMe.name': 'Nginx du portail /api/me',
    'integrationen.items.adminArbeitsbereich.name': 'Espace admin (/admin)',
    'integrationen.items.ssoTestpyramidePlaywright.name': 'Pyramide de tests SSO (Playwright)',
    'integrationen.items.blackboxProbes.name': 'Sondes blackbox (monitoring L4)',
    'integrationen.items.checkPortalConfigDriftGuard.name': 'Garde anti-dérive de la config du portail',
    'integrationen.items.n8nInvoiceninja.name': 'n8n -> Invoice-Ninja (interne, identifiants)',
    'integrationen.items.litellmAiGateway.name': 'Passerelle IA (LiteLLM, centrale)',
    'integrationen.items.rtSupportTriage.name': 'Triage du support RT (n8n → LiteLLM)',
  },
  zh: {
    'integrationen.title': '自主开发与 SSO 集成',
    'integrationen.subtitle':
      '非“现成采购”的扩展清单：每张卡片说明用途、受影响的服务、保障它的回归测试，以及代码仓库与运维提示。',
    'integrationen.badgeVerified': '✓ 测试保障',
    'integrationen.servicesLabel': '受影响的服务',
    'integrationen.allServicesLabel': '全部目录服务',
    'integrationen.verificationLabel': '验证（回归测试）',
    'integrationen.repoFileLabel': '仓库 / 文件',
    'integrationen.operationalLabel': '运维说明',
    'integrationen.items.bbbShortlinkRelay.name': 'BBB 短链接中继（/r/）',
    'integrationen.items.sogoUs5Build.name': 'SOGo us5 构建（Fix A + SOPE-xoauth2）',
    'integrationen.items.tossOidcIdentityFix.name': 'TOSS OIDC 身份修复',
    'integrationen.items.oauth2ProxyGroupGateAdmin.name': 'oauth2-proxy 分组门禁（管理门户）',
    'integrationen.items.portalNginxApiMe.name': '门户 nginx /api/me',
    'integrationen.items.adminArbeitsbereich.name': '管理工作区（/admin）',
    'integrationen.items.ssoTestpyramidePlaywright.name': 'SSO 测试金字塔（Playwright）',
    'integrationen.items.blackboxProbes.name': '黑盒探针（L4 监控）',
    'integrationen.items.checkPortalConfigDriftGuard.name': '门户配置漂移防护',
    'integrationen.items.n8nInvoiceninja.name': 'n8n → Invoice-Ninja（内部、凭证）',
    'integrationen.items.litellmAiGateway.name': 'AI 网关（LiteLLM，集中式）',
    'integrationen.items.rtSupportTriage.name': 'RT 支持工单预分类（n8n → LiteLLM）',
  },
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Prueft eine Liste von Integrations-Kandidaten gegen das Schema. Liefert
 * menschenlesbare Fehler zurueck — leer heisst gueltig. `knownServiceIds` ist
 * die Menge erlaubter Katalog-IDs (leer lassen = Katalog-Abgleich skippen,
 * z. B. fuer Fremd-Daten); die Wildcard SERVICE_WILDCARD ist nur allein
 * zulaessig.
 */
export function validateCustomIntegrations(
  candidates: readonly unknown[],
  opts: { knownServiceIds?: readonly string[] } = {},
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const known = opts.knownServiceIds ? new Set(opts.knownServiceIds) : null;

  candidates.forEach((c, index) => {
    const label = `customIntegrations[${index}]`;
    if (c === null || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`${label}: kein Integrations-Objekt`);
      return;
    }
    const i = c as Record<string, unknown>;

    if (!isNonEmptyString(i.id)) {
      errors.push(`${label}.id: Pflichtfeld fehlt oder ist leer`);
    } else if (!SLUG.test(i.id)) {
      errors.push(`${label}.id: "${i.id}" ist kein Slug (a-z, 0-9, Bindestrich)`);
    } else if (seen.has(i.id)) {
      errors.push(`${label}.id: doppelte ID "${i.id}"`);
    } else {
      seen.add(i.id);
    }

    for (const field of ['nameKey', 'purpose', 'verification', 'repoFile', 'operational'] as const) {
      if (!isNonEmptyString(i[field])) {
        errors.push(`${label}.${field}: Pflichtfeld fehlt oder ist leer`);
      }
    }

    const services = i.services;
    if (!Array.isArray(services)) {
      errors.push(`${label}.services: Pflichtfeld fehlt (Array erwartet)`);
    } else if (services.length === 0) {
      errors.push(`${label}.services: mindestens ein Dienst erforderlich`);
    } else {
      services.forEach((s, si) => {
        if (!isNonEmptyString(s)) {
          errors.push(`${label}.services[${si}]: leere Dienst-ID`);
          return;
        }
        if (s === SERVICE_WILDCARD) {
          if (services.length > 1) {
            errors.push(
              `${label}.services: Wildcard '${SERVICE_WILDCARD}' ist nur allein zulaessig`,
            );
          }
          return;
        }
        if (known && !known.has(s)) {
          errors.push(`${label}.services[${si}]: "${s}" ist keine Katalog-Dienst-ID`);
        }
      });
    }
  });

  return errors;
}
