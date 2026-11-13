/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const createIntercomRoute = require("./base");
const { nextcloud } = require("../config");

/**
 * @name /fs/
 * @desc
 * Proxy for Nextcloud (legacy — upstream compatibility).
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 */
module.exports = createIntercomRoute({
  name: "Nextcloud",
  config: nextcloud,
  mountPrefix: "/fs",
  enabled: Boolean(nextcloud.enabled && nextcloud.url),
});
