/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const createIntercomRoute = require("./base");
const { logger } = require("../utils");
const { xwiki } = require("../config");

/**
 * @name /wiki/
 * @desc
 * Proxy for XWiki.
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 */
module.exports = createIntercomRoute({
  name: "XWiki",
  config: xwiki,
  mountPrefix: "/wiki",
  enabled: Boolean(xwiki.enabled && xwiki.url),
  onAuth: () => {
    logger.debug("Correctly set Authorization header for XWiki proxy");
  },
});
