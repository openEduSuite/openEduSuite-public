/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const createIntercomRoute = require("./base");
const { cloud } = require("../config");

/**
 * pathRewrite is selected by the configured backend:
 *  - opencloud: '^/cloud/webdav' -> ''           (e.g. /cloud/webdav/dav/... -> /dav/...)
 *  - nextcloud: '^/cloud/webdav' -> '/remote.php/dav'  (Nextcloud WebDAV base)
 */
const cloudPathRewrite =
  cloud.backend === "nextcloud"
    ? { "^/cloud/webdav": "/remote.php/dav" }
    : { "^/cloud/webdav": "" };

/**
 * @name /cloud/webdav/
 * @desc
 * Generic cloud-storage WebDAV proxy (openEDU file service).
 * Backend is switchable via CLOUD_BACKEND ('opencloud' | 'nextcloud').
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 * @example PROPFIND http://ics.domain.test/cloud/webdav/dav/files/usera1/Photos
 */
module.exports = createIntercomRoute({
  name: "Cloud",
  config: cloud,
  mountPrefix: "/cloud/webdav",
  enabled: Boolean(cloud.enabled && cloud.url),
  pathRewrite: cloudPathRewrite,
  disabledMessage: "Cloud storage integration is not enabled",
  missingSessionMessage:
    "No Cloud session found in appSession. Likely Cloud storage is not configured",
});
