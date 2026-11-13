/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const createIntercomRoute = require("./base");
const { sogo } = require("../config");

/**
 * @name /sogo/
 * @desc
 * Proxy for SOGo Groupware (CalDAV, CardDAV, mail).
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 */
module.exports = createIntercomRoute({
  name: "SOGo",
  config: sogo,
  mountPrefix: "/sogo",
  enabled: Boolean(sogo.enabled && sogo.url),
});
