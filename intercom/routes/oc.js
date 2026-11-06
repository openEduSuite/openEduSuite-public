/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, opencloud } = require("../config");

/**
 * @name /oc/
 * @desc
 * Proxy for OpenCloud (openEDU primary file service).
 * Adds the proper Authorization Header via OIDC token exchange.
 */
if (opencloud.enabled && opencloud.url) {
  router.use(
    "/",
    createProxyMiddleware({
      target: opencloud.url,
      logLevel,
      logger,
      changeOrigin: true,
      pathRewrite: {
        "^/oc": "",
      },
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
        if (!req.appSession[opencloud.session_storage_key]) {
          logger.info(
            "No OpenCloud session found in appSession. Likely OpenCloud is not configured",
          );
          return;
        }
        proxyReq.setHeader(
          "authorization",
          `Bearer ${req.appSession[opencloud.session_storage_key]}`,
        );
      },
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res.status(404).json({ error: "OpenCloud integration is not enabled" });
  });
}

module.exports = router;
