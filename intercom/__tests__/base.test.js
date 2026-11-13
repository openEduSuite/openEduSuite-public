/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Unit tests for the shared Univention ICS proxy base (routes/base.js).
 * All intercom components extend this base; these tests pin down the
 * behaviour every component inherits.
 */
const express = require("express");
const request = require("supertest");

/**
 * Load routes/base.js with the given module mocks in place.
 * Returns { createIntercomRoute, captured } where captured holds the options
 * object passed to createProxyMiddleware on the last enabled mount.
 */
function loadBase({ config, utils, proxy } = {}) {
  jest.resetModules();
  jest.doMock("../config", () => config);
  jest.doMock("../utils", () => utils);
  const captured = {};
  const calls = [];
  jest.doMock("http-proxy-middleware", () => ({
    createProxyMiddleware: (opts) => {
      calls.push(opts);
      captured.options = opts;
      return (req, res) => res.status(200).json({ ok: true });
    },
  }));
  jest.dontMock("../routes/base");
  const base = require("../routes/base");
  return { createIntercomRoute: base, captured, calls };
}

function baseConfig(overrides = {}) {
  return {
    corsOptions: { origin: ".*" },
    logLevel: "silent",
    ...overrides,
  };
}

function baseUtils(overrides = {}) {
  return {
    stripIntercomCookies: jest.fn(),
    massageCors: jest.fn(),
    incrementProxyRequest: jest.fn(),
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    ...overrides,
  };
}

function fakeProxyReq() {
  return { setHeader: jest.fn(), getHeader: jest.fn(() => "") };
}

describe("routes/base createIntercomRoute", () => {
  describe("disabled guard", () => {
    test("returns a 404 router when enabled is falsy", async () => {
      const { createIntercomRoute } = loadBase({
        config: baseConfig(),
        utils: baseUtils(),
      });
      const app = express();
      app.use(
        "/oc",
        createIntercomRoute({
          name: "OpenCloud",
          config: { url: "" },
          mountPrefix: "/oc",
          enabled: false,
        }),
      );
      const res = await request(app).get("/oc/");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "OpenCloud integration is not enabled" });
    });

    test("never invokes createProxyMiddleware when disabled", () => {
      const { createIntercomRoute, calls } = loadBase({
        config: baseConfig(),
        utils: baseUtils(),
      });
      createIntercomRoute({
        name: "OpenCloud",
        config: { url: "https://oc.example.com" },
        mountPrefix: "/oc",
        enabled: false,
      });
      expect(calls).toHaveLength(0);
    });

    test("derives enabled from a present URL when enabled is not given", async () => {
      const { createIntercomRoute } = loadBase({
        config: baseConfig(),
        utils: baseUtils(),
      });
      const app = express();
      app.use(
        "/nob",
        createIntercomRoute({
          name: "Nordeck",
          config: { url: "https://nob.example.com", session_storage_key: "matrix_access_token" },
          mountPrefix: "/nob",
          disabledMessage: "Nordeck integration is not configured",
        }),
      );
      const res = await request(app).get("/nob/");
      expect(res.status).toBe(200);
    });
  });

  describe("proxy middleware options", () => {
    test("passes target, pathRewrite, changeOrigin and secure to the proxy", () => {
      const { createIntercomRoute, captured, calls } = loadBase({
        config: baseConfig(),
        utils: baseUtils(),
      });
      createIntercomRoute({
        name: "SOGo",
        config: { url: "https://sogo.example.com", session_storage_key: "sogo_access_token" },
        mountPrefix: "/sogo",
        secure: false,
      });
      expect(calls).toHaveLength(1);
      expect(captured.options.target).toBe("https://sogo.example.com");
      expect(captured.options.pathRewrite).toEqual({ "^/sogo": "" });
      expect(captured.options.changeOrigin).toBe(true);
      expect(captured.options.secure).toBe(false);
    });

    test("derives pathRewrite from mountPrefix when none is given", () => {
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils: baseUtils(),
      });
      createIntercomRoute({
        name: "XWiki",
        config: { url: "https://wiki.example.com", session_storage_key: "xwiki_access_token" },
        mountPrefix: "/wiki",
      });
      expect(captured.options.pathRewrite).toEqual({ "^/wiki": "" });
    });

    test("honours an explicit pathRewrite (navigation / webdav style)", () => {
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils: baseUtils(),
      });
      createIntercomRoute({
        name: "Portal",
        config: { url: "https://portal.example.com" },
        mountPrefix: "/navigation.json",
        pathRewrite: { "^/navigation.json": "/univention/portal/navigation.json" },
      });
      expect(captured.options.pathRewrite).toEqual({
        "^/navigation.json": "/univention/portal/navigation.json",
      });
    });
  });

  describe("onProxyReq (univention ICS auth pattern)", () => {
    test("strips intercom cookies and injects the bearer token from appSession", () => {
      const utils = baseUtils();
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils,
      });
      createIntercomRoute({
        name: "Nextcloud",
        config: { url: "https://nc.example.com", session_storage_key: "nc_access_token" },
        mountPrefix: "/nextcloud",
      });
      const proxyReq = fakeProxyReq();
      const req = { appSession: { nc_access_token: "tok-123" } };
      captured.options.onProxyReq(proxyReq, req, {});
      expect(utils.stripIntercomCookies).toHaveBeenCalledWith(proxyReq);
      expect(proxyReq.setHeader).toHaveBeenCalledWith("authorization", "Bearer tok-123");
    });

    test("logs (and skips the header + onAuth hooks) when the appSession key is missing", () => {
      const utils = baseUtils();
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils,
      });
      const onAuth = jest.fn();
      createIntercomRoute({
        name: "ILIAS",
        config: { url: "https://ilias.example.com", session_storage_key: "ilias_access_token" },
        mountPrefix: "/ilias",
        onAuth,
      });
      const proxyReq = fakeProxyReq();
      captured.options.onProxyReq(proxyReq, { appSession: {} }, {});
      expect(proxyReq.setHeader).not.toHaveBeenCalledWith("authorization", expect.anything());
      expect(utils.logger.info).toHaveBeenCalledWith(
        "No ILIAS session found in appSession. Likely ILIAS is not configured",
      );
      expect(onAuth).not.toHaveBeenCalled();
    });

    test("runs the onAuth hook after default bearer injection", () => {
      const utils = baseUtils();
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils,
      });
      const onAuth = jest.fn((proxyReq) => proxyReq.setHeader("X-Remote-User", "user@example.org"));
      createIntercomRoute({
        name: "ILIAS",
        config: { url: "https://ilias.example.com", session_storage_key: "ilias_access_token" },
        mountPrefix: "/ilias",
        onAuth,
      });
      const proxyReq = fakeProxyReq();
      const req = { appSession: { ilias_access_token: "tok-123" } };
      captured.options.onProxyReq(proxyReq, req, {});
      expect(onAuth).toHaveBeenCalledWith(proxyReq, req);
      expect(proxyReq.setHeader).toHaveBeenCalledWith("authorization", "Bearer tok-123");
      expect(proxyReq.setHeader).toHaveBeenCalledWith("X-Remote-User", "user@example.org");
    });

    test("skips bearer auth entirely when bearerAuth is false (navigation style)", () => {
      const utils = baseUtils();
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils,
      });
      const onAuth = jest.fn((proxyReq) => proxyReq.setHeader("authorization", "Basic Zm9vOmJhcg=="));
      createIntercomRoute({
        name: "Portal",
        config: { url: "https://portal.example.com" },
        mountPrefix: "/navigation.json",
        bearerAuth: false,
        onAuth,
      });
      const proxyReq = fakeProxyReq();
      const req = { appSession: { anything: "tok" }, decodedIdToken: {} };
      captured.options.onProxyReq(proxyReq, req, {});
      expect(proxyReq.setHeader).not.toHaveBeenCalledWith(
        "authorization",
        expect.stringContaining("Bearer"),
      );
      expect(onAuth).toHaveBeenCalledWith(proxyReq, req);
    });
  });

  describe("onProxyRes", () => {
    test("massages CORS on the proxied response", () => {
      const utils = baseUtils();
      const { createIntercomRoute, captured } = loadBase({
        config: baseConfig(),
        utils,
      });
      createIntercomRoute({
        name: "OpenCloud",
        config: { url: "https://oc.example.com", session_storage_key: "oc_access_token" },
        mountPrefix: "/oc",
      });
      const proxyRes = { headers: {} };
      const req = { get: jest.fn(() => "https://portal.example.com") };
      captured.options.onProxyRes(proxyRes, req, {});
      expect(utils.massageCors).toHaveBeenCalledWith(req, proxyRes, expect.anything());
    });
  });
});
