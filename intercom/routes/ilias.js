/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, ilias } = require("../config");
const { setILIASRemoteUser, setILIASProxySecret } = require("./ilias-remote-user");

/**
 * @name /ilias/
 * @desc
 * Proxy for ILIAS LMS (REST API, file upload/download).
 * Adds the proper Authorization Header via OIDC token exchange.
 * 
 * Supports:
 * - REST API requests
 * - File upload passthrough (streams request body without buffering)
 * - File download passthrough
 */
if (ilias.enabled && ilias.url) {
  // Upload-Passthrough: streams request body without buffering for large file uploads
  // Falls back to standard proxy behavior for non-upload requests
  router.use(
    "/",
    createProxyMiddleware({
      target: ilias.url,
      logLevel,
      logger,
      changeOrigin: true,
      secure: false, // Allow HTTP targets for development environments
      pathRewrite: {
        "^/ilias": "",
      },
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
        // B1 SSO bridge: expose identity as trusted remote-user header so
        // ILIAS Apache-auth can start/build a session as that user. The
        // shared proxy secret proves to ILIAS's Apache that this request
        // really came from the ICS (anti-spoof).
        setILIASRemoteUser(proxyReq, req, ilias.remote_user_claim);
        setILIASProxySecret(proxyReq, ilias.proxy_secret);
        if (!req.appSession[ilias.session_storage_key]) {
          logger.info(
            "No ILIAS session found in appSession. Likely ILIAS is not configured",
          );
          return;
        }
        proxyReq.setHeader(
          "authorization",
          `Bearer ${req.appSession[ilias.session_storage_key]}`,
        );
      },
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res.status(404).json({ error: "ILIAS integration is not enabled" });
  });
}

module.exports = router;
