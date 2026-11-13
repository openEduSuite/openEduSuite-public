/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const createIntercomRoute = require("./base");
const { opencloud } = require("../config");

/**
 * @name /oc/
 * @desc
 * Proxy for OpenCloud (openEDU primary file service).
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 */
module.exports = createIntercomRoute({
  name: "OpenCloud",
  config: opencloud,
  mountPrefix: "/oc",
  enabled: Boolean(opencloud.enabled && opencloud.url),
});
