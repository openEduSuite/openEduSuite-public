/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const express = require("express");
const router = express.Router();

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger } = require("../utils");
const { corsOptions, logLevel, cloud } = require("../config");

/**
 * pathRewrite is selected by the configured backend:
 *  - opencloud: '^/cloud/webdav' -> ''           (e.g. /cloud/webdav/dav/... -> /dav/...)
 *  - nextcloud: '^/cloud/webdav' -> '/remote.php/dav'  (Nextcloud WebDAV base)
 */
const cloudPathRewrite =
  cloud.backend === "nextcloud"
    ? { "^/cloud/webdav": "/remote.php/dav" }
    : { "^/cloud/webdav": "" };

/**
 * @name /cloud/webdav/
 * @desc
 * Generic cloud-storage WebDAV proxy (openEDU file service).
 * Backend is switchable via CLOUD_BACKEND ('opencloud' | 'nextcloud').
 * Adds the proper Authorization Header via OIDC token exchange.
 * @example PROPFIND http://ics.domain.test/cloud/webdav/dav/files/usera1/Photos
 */
if (cloud.enabled && cloud.url) {
  router.use(
    "/",
    createProxyMiddleware({
      target: cloud.url,
      logLevel,
      logger,
      changeOrigin: true,
      pathRewrite: cloudPathRewrite,
      onProxyReq: function onProxyReq(proxyReq, req, res) {
        stripIntercomCookies(proxyReq);
        if (!req.appSession[cloud.session_storage_key]) {
          logger.info(
            "No Cloud session found in appSession. Likely Cloud storage is not configured",
          );
          return;
        }
        proxyReq.setHeader(
          "authorization",
          `Bearer ${req.appSession[cloud.session_storage_key]}`,
        );
      },
      onProxyRes: function (proxyRes, req, res) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );
} else {
  router.use("/", (req, res) => {
    res.status(404).json({ error: "Cloud storage integration is not enabled" });
  });
}

module.exports = router;
