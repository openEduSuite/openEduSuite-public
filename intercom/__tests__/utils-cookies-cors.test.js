/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Unit tests for utils/cookies (stripIntercomCookies) and utils/cors
 * (massageCors) — the two helpers the shared ICS proxy base depends on.
 */
const { stripIntercomCookies } = require("../utils/cookies");
const { massageCors } = require("../utils/cors");

describe("utils/cookies stripIntercomCookies", () => {
  test("drops the appSession cookie and keeps unrelated cookies", () => {
    const proxyReq = {
      getHeader: jest.fn(() =>
        "appSession=abc; _csrf_token=xyz; session_draft=1",
      ),
      setHeader: jest.fn(),
    };
    stripIntercomCookies(proxyReq);
    expect(proxyReq.setHeader).toHaveBeenCalledTimes(1);
    const [name, value] = proxyReq.setHeader.mock.calls[0];
    expect(name).toBe("cookie");
    expect(value).toContain("_csrf_token=xyz");
    expect(value).toContain("session_draft=1");
    expect(value).not.toContain("appSession");
  });

  test("removes the cookie header when only appSession was present", () => {
    const proxyReq = {
      getHeader: jest.fn(() => "appSession=abc"),
      setHeader: jest.fn(),
    };
    stripIntercomCookies(proxyReq);
    expect(proxyReq.setHeader).not.toHaveBeenCalled();
  });

  test("leaves an empty cookie header alone", () => {
    const proxyReq = {
      getHeader: jest.fn(() => ""),
      setHeader: jest.fn(),
    };
    stripIntercomCookies(proxyReq);
    expect(proxyReq.setHeader).not.toHaveBeenCalled();
  });

  test("does not throw when the proxied request carries no cookie header", () => {
    const proxyReq = {
      getHeader: jest.fn(() => undefined),
      setHeader: jest.fn(),
    };
    expect(() => stripIntercomCookies(proxyReq)).not.toThrow();
    expect(proxyReq.setHeader).not.toHaveBeenCalled();
  });
});

describe("utils/cors massageCors", () => {
  test("echoes the origin when it matches the allowed regex", () => {
    const req = { get: jest.fn(() => "https://app.example.org") };
    const proxyRes = { headers: {} };
    massageCors(req, proxyRes, "^https://.*\\.openedusuite\\.org$");
    expect(proxyRes.headers["access-control-allow-origin"]).toBe(
      "https://app.example.org",
    );
  });

  test("leaves headers untouched for a disallowed origin", () => {
    const req = { get: jest.fn(() => "https://evil.example.com") };
    const proxyRes = { headers: { "x-backend": "yes" } };
    massageCors(req, proxyRes, "^https://.*\\.openedusuite\\.org$");
    expect(proxyRes.headers["access-control-allow-origin"]).toBeUndefined();
    expect(proxyRes.headers["x-backend"]).toBe("yes");
  });

  test("leaves headers untouched when no origin is sent", () => {
    const req = { get: jest.fn(() => undefined) };
    const proxyRes = { headers: {} };
    massageCors(req, proxyRes, "^https://.*$");
    expect(proxyRes.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
