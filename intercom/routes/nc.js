/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const createIntercomRoute = require("./base");
const { nextcloud } = require("../config");

/**
 * @name /nextcloud/
 * @desc
 * Proxy for Nextcloud (openEDU file service).
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 */
module.exports = createIntercomRoute({
  name: "Nextcloud",
  config: nextcloud,
  mountPrefix: "/nextcloud",
  enabled: Boolean(nextcloud.enabled && nextcloud.url),
});
