/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, nordeck, matrix } = require("../config");

if (nordeck.url) {
  router.use(
    "/",
    createProxyMiddleware({
      target: nordeck.url,
      logLevel,
      logger,
      changeOrigin: true,
      pathRewrite: { "^/nob": "" },
      secure: false,
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
        if (!req.appSession[matrix.session_storage_key]) {
          logger.info(
            "No Matrix session found in appSession. Likely Matrix is not configured",
          );
          return;
        }
        proxyReq.setHeader(
          "authorization",
          `Bearer ${req.appSession[matrix.session_storage_key]}`,
        );
      },
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res
      .status(404)
      .json({ error: "Nordeck integration is not configured" });
  });
}

module.exports = router;
