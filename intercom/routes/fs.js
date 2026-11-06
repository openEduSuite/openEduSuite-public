/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, nextcloud } = require("../config");

/**
 * @name /fs/
 * @desc
 * Proxy for Nextcloud (legacy — upstream compatibility).
 * Adds the proper Authorization Header
 */
if (nextcloud.enabled && nextcloud.url) {
  router.use(
    "/",
    createProxyMiddleware({
      target: nextcloud.url,
      logLevel,
      logger,
      changeOrigin: true,
      pathRewrite: {
        "^/fs": "",
      },
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
        if (!req.appSession[nextcloud.session_storage_key]) {
          logger.info(
            "No Nextcloud session found in appSession. Likely Nextcloud is not configured",
          );
          return;
        }
        proxyReq.setHeader(
          "authorization",
          `Bearer ${req.appSession[nextcloud.session_storage_key]}`,
        );
      },
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res.status(404).json({ error: "Nextcloud integration is not enabled" });
  });
}

module.exports = router;
