/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const createIntercomRoute = require("./base");
const { nordeck, matrix } = require("../config");

/**
 * @name /nob/
 * @desc
 * Proxy for the Nordeck Bot (or just the plain Matrix UserInfo Service in
 * testing). Extends the shared Univention ICS base; adds the proper
 * Authorization Header via the Matrix session.
 */
module.exports = createIntercomRoute({
  name: "Nordeck",
  config: { url: nordeck.url, session_storage_key: matrix?.session_storage_key },
  mountPrefix: "/nob",
  secure: false,
  disabledMessage: "Nordeck integration is not configured",
  missingSessionMessage:
    "No Matrix session found in appSession. Likely Matrix is not configured",
});
