/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const createIntercomRoute = require("./base");
const { logger } = require("../utils");
const { portal, usernameClaim } = require("../config");

/* global Buffer */

/**
 * @name /navigation.json
 * @desc
 * Proxy to the portal for global Navigation Data.
 * Extends the shared Univention ICS base; authenticates against the portal
 * with a Basic header derived from the id_token username claim instead of a
 * bearer token.
 */
module.exports = createIntercomRoute({
  name: "Portal",
  config: portal,
  mountPrefix: "/navigation.json",
  pathRewrite: { "^/navigation.json": "/univention/portal/navigation.json" },
  bearerAuth: false,
  disabledMessage: "Portal integration is not configured",
  onAuth(proxyReq, req) {
    if (!req?.decodedIdToken?.[usernameClaim]) {
      logger.error("No claim %s found in the id_token", usernameClaim);
      logger.error("Error setting Authorization Header for portal.json");
      return;
    }
    proxyReq.setHeader(
      "Authorization",
      "Basic " +
        Buffer.from(
          req.decodedIdToken[usernameClaim] + ":" + portal.secret,
        ).toString("base64"),
    );
  },
});
