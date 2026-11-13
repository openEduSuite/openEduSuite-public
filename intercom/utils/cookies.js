/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const cookie = require("cookie");

const stripIntercomCookies = async (proxyReq) => {
  const raw = proxyReq.getHeader("cookie");
  // A request without a Cookie header must pass through untouched
  // (cookie.parse(undefined) would throw and kill the proxy request).
  if (typeof raw !== "string" || raw.length === 0) {
    return;
  }
  const cookies = cookie.parse(raw);
  delete cookies["appSession"];
  if (Object.keys(cookies).length > 0) {
    const keep = Object.keys(cookies).map((c) =>
      cookie.serialize(c, cookies[c])
    );
    proxyReq.setHeader("cookie", keep.join("; "));
  }
};

module.exports = {
  stripIntercomCookies,
};
