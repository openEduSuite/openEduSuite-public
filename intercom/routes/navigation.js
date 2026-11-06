/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, portal, usernameClaim } = require("../config");

if (portal.url) {
  router.use(
    "/",
    createProxyMiddleware({
      target: portal.url,
      logLevel,
      logger,
      changeOrigin: true,
      pathRewrite: { "^/navigation.json": "/univention/portal/navigation.json" },
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
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
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res.status(404).json({ error: "Portal integration is not configured" });
  });
}

module.exports = router;
