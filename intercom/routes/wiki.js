/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, xwiki } = require("../config");

if (xwiki.enabled && xwiki.url) {
  router.use(
    "/",
    createProxyMiddleware({
      target: xwiki.url,
      logLevel,
      logger,
      changeOrigin: true,
      pathRewrite: {
        "^/wiki": "",
      },
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
        if (!req.appSession[xwiki.session_storage_key]) {
          logger.info(
            "No XWiki session found in appSession. Likely XWiki is not configured",
          );
          return;
        }
        proxyReq.setHeader(
          "authorization",
          `Bearer ${req.appSession[xwiki.session_storage_key]}`,
        );
        logger.debug("Correctly set Authorization header for XWiki proxy");
      },
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res.status(404).json({ error: "XWiki integration is not enabled" });
  });
}

module.exports = router;
