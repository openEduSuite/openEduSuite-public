/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

/**
 * B1 SSO bridge: expose the authenticated Keycloak identity to ILIAS as a
 * trusted remote-user header (ILIAS runs in Apache-auth mode and trusts
 * REMOTE_USER / HTTP_USERNAME set by the frontend proxy).
 *
 * @param {object} proxyReq  http-proxy request object (has setHeader)
 * @param {object} req       express request (has decodedIdToken)
 * @param {string} claim     ID-token claim holding the ILIAS login name (email)
 */
function setILIASRemoteUser(proxyReq, req, claim) {
  if (!req.decodedIdToken || !claim) return;
  const value = req.decodedIdToken[claim];
  if (typeof value === "string" && value.length > 0) {
    proxyReq.setHeader("X-Remote-User", value);
  }
}

/**
 * B1 SSO bridge: prove the remote-user header came from this ICS (shared
 * secret). ILIAS's Apache only honours X-Remote-User when this secret
 * matches, so external callers cannot spoof an identity.
 * @param {object} proxyReq http-proxy request object (has setHeader)
 * @param {string} secret   shared secret; no-op when empty/unset
 */
function setILIASProxySecret(proxyReq, secret) {
  if (typeof secret === "string" && secret.length > 0) {
    proxyReq.setHeader("X-OpenDesk-Proxy-Secret", secret);
  }
}

module.exports = { setILIASRemoteUser, setILIASProxySecret };
