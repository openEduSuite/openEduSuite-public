/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const createIntercomRoute = require("./base");
const { ilias } = require("../config");
const { setILIASRemoteUser, setILIASProxySecret } = require("./ilias-remote-user");

/**
 * @name /ilias/
 * @desc
 * Proxy for ILIAS LMS (REST API, file upload/download).
 * Extends the shared Univention ICS base; adds the proper Authorization
 * Header via OIDC token exchange.
 *
 * Supports:
 * - REST API requests
 * - File upload passthrough (streams request body without buffering)
 * - File download passthrough
 * - B1 SSO bridge: exposes identity as trusted remote-user header so ILIAS
 *   Apache-auth can start/build a session as that user (anti-spoof via the
 *   shared proxy secret).
 */
module.exports = createIntercomRoute({
  name: "ILIAS",
  config: ilias,
  mountPrefix: "/ilias",
  enabled: Boolean(ilias.enabled && ilias.url),
  secure: false, // Allow HTTP targets for development environments
  onAuth(proxyReq, req) {
    // B1 SSO bridge: expose identity as trusted remote-user header so
    // ILIAS Apache-auth can start/build a session as that user. The
    // shared proxy secret proves to ILIAS's Apache that this request
    // really came from the ICS (anti-spoof).
    setILIASRemoteUser(proxyReq, req, ilias.remote_user_claim);
    setILIASProxySecret(proxyReq, ilias.proxy_secret);
  },
});
