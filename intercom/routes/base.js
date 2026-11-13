/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Shared Univention ICS proxy base.
 *
 * Every intercom app-integration component (fs, wiki, nob, oc, nc, sogo,
 * ilias, webdav, navigation) extends this base with its own configuration,
 * instead of re-implementing the Univention ICS pattern from scratch.
 *
 * The base embodies the ICS token-handler (BFF) behaviour:
 *   1. guard   — disabled components answer 404 with a clear message
 *   2. proxy   — http-proxy-middleware against the component's target URL
 *   3. auth    — strip intercom cookies, inject the OIDC-exchanged bearer
 *                token from appSession (or whatever the component's onAuth
 *                hook needs instead)
 *   4. cors    — massage the CORS headers on every proxied response
 */
const express = require("express");

const { createProxyMiddleware } = require("http-proxy-middleware");

const { stripIntercomCookies, massageCors, logger, incrementProxyRequest } =
  require("../utils");
const { corsOptions, logLevel } = require("../config");

/**
 * Create an express router for one intercom app-integration component.
 *
 * @param {object} opts
 * @param {string} opts.name             Display name, e.g. "OpenCloud"
 * @param {object} opts.config           App config section ({url, session_storage_key, ...})
 * @param {string} opts.mountPrefix      Browser-facing path, e.g. "/oc"
 * @param {boolean} [opts.enabled]       Defaults to Boolean(config.url)
 * @param {string}  [opts.target]        Proxy target; defaults to config.url
 * @param {object}  [opts.pathRewrite]   http-proxy pathRewrite; defaults to { "^<mountPrefix>": "" }
 * @param {boolean} [opts.secure]        TLS verification; defaults to true
 * @param {boolean} [opts.bearerAuth]    Inject `Bearer <appSession token>`; defaults to true
 * @param {function} [opts.onAuth]       (proxyReq, req) => void; runs after default auth
 * @param {string}  [opts.disabledMessage]       404 body when disabled
 * @param {string}  [opts.missingSessionMessage] log line when the session token is absent
 * @returns {express.Router}
 */
function createIntercomRoute({
  name,
  config = {},
  mountPrefix,
  enabled = Boolean(config.url),
  target = config.url,
  pathRewrite,
  secure = true,
  bearerAuth = true,
  onAuth,
  disabledMessage = `${name} integration is not enabled`,
  missingSessionMessage = `No ${name} session found in appSession. Likely ${name} is not configured`,
}) {
  const router = express.Router();

  if (!enabled || !target) {
    router.use("/", (req, res) => {
      res.status(404).json({ error: disabledMessage });
    });
    return router;
  }

  router.use(
    "/",
    createProxyMiddleware({
      target,
      logLevel,
      logger,
      changeOrigin: true,
      secure,
      pathRewrite:
        pathRewrite || (mountPrefix ? { [`^${mountPrefix}`]: "" } : {}),
      onProxyReq: function onProxyReq(proxyReq, req) {
        stripIntercomCookies(proxyReq);
        incrementProxyRequest(typeof target === "string" ? target : "unknown");
        if (bearerAuth) {
          const token = req.appSession && req.appSession[config.session_storage_key];
          if (!token) {
            logger.info(missingSessionMessage);
            // Faithful to the upstream ICS components: when the exchanged
            // token is missing, no auth header is attached and component
            // specific onAuth hooks are skipped too.
            return;
          }
          proxyReq.setHeader("authorization", `Bearer ${token}`);
        }
        if (typeof onAuth === "function") {
          onAuth(proxyReq, req);
        }
      },
      onProxyRes: function onProxyRes(proxyRes, req) {
        massageCors(req, proxyRes, corsOptions.origin);
      },
    }),
  );

  return router;
}

module.exports = createIntercomRoute;
