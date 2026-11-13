/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Unit tests for the intercom middlewares: JWT verification/decoding
 * (utils/jwt consumers), session state syncing and OIDC/Matrix token
 * renewal. All external calls (verifyJWT, fetchers, redis) are mocked.
 */

/**
 * Load the middlewares with mocks for ../utils and ../config.
 */
function loadMiddlewares({ utils, config }) {
  jest.resetModules();
  jest.doMock("../utils", () => utils);
  jest.doMock("../config", () => config);
  return require("../middlewares/index");
}

function fakeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function fakeUtils(overrides = {}) {
  const logger = fakeLogger();
  return {
    verifyJWT: jest.fn(),
    JWKS: { key: "jwks" },
    fetchOIDCToken: jest.fn(),
    fetchMatrixToken: jest.fn(),
    redisClient: { set: jest.fn().mockResolvedValue("OK") },
    logger,
    ...overrides,
  };
}

const baseConfig = {
  issuerBaseUrl: "https://id.example.com/realms/master",
  userUniqueMapper: "openedusuite_useruuid",
  matrix: {
    name: "Matrix",
    enabled: true,
    url: "https://matrix.example.org",
    appServiceSecret: "as",
    session_storage_key: "matrix_access_token",
  },
};

describe("middlewares/jwt", () => {
  test("decodes and stores the access token on success", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockResolvedValue({ sub: "u1" });
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { access_token: "at" } };
    let nextCalled = false;
    await mw.oidcVerifyDecodeAccessToken(() => {})(
      req,
      {},
      () => {
        nextCalled = true;
      },
    );
    expect(req.decodedAccessToken).toEqual({ sub: "u1" });
    expect(nextCalled).toBe(true);
  });

  test("runs the fallback callback and still calls next on failure", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockRejectedValue(new Error("expired"));
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { access_token: "at" } };
    const fallback = jest.fn();
    let nextCalled = false;
    await mw.oidcVerifyDecodeAccessToken(fallback)(
      req,
      {},
      () => {
        nextCalled = true;
      },
    );
    expect(req.decodedAccessToken).toBeUndefined();
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(nextCalled).toBe(true);
    expect(utils.logger.warn).toHaveBeenCalledWith(
      "Error verifying ICS OIDC access_token",
    );
  });

  test("decodes the identity token into decodedIdToken", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockResolvedValue({ name: "alice" });
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { id_token: "it" } };
    let nextCalled = false;
    await mw.oidcVerifyDecodeIdentityToken(() => {})(
      req,
      {},
      () => {
        nextCalled = true;
      },
    );
    expect(req.decodedIdToken).toEqual({ name: "alice" });
    expect(nextCalled).toBe(true);
  });

  test("identity token failure runs the fallback and still calls next", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockRejectedValue(new Error("invalid"));
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { id_token: "it" } };
    const fallback = jest.fn();
    let nextCalled = false;
    await mw.oidcVerifyDecodeIdentityToken(fallback)(
      req,
      {},
      () => {
        nextCalled = true;
      },
    );
    expect(req.decodedIdToken).toBeUndefined();
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(nextCalled).toBe(true);
    expect(utils.logger.warn).toHaveBeenCalledWith(
      "Error verifying ICS OIDC id_token",
    );
  });
});

describe("middlewares/sessionState", () => {
  test("syncs session_state -> appSession cookie when both are present", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = {
      cookies: { appSession: "session-cookie" },
      appSession: { session_state: "sess-123" },
    };
    let nextCalled = false;
    await mw.updateSessionState(req, {}, () => {
      nextCalled = true;
    });
    expect(utils.redisClient.set).toHaveBeenCalledWith("sess-123", "session-cookie");
    expect(nextCalled).toBe(true);
  });

  test("skips redis when the appSession cookie is absent", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { cookies: {}, appSession: { session_state: "sess-123" } };
    await mw.updateSessionState(req, {}, () => {});
    expect(utils.redisClient.set).not.toHaveBeenCalled();
  });

  test("skips redis when session_state is missing", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { cookies: { appSession: "c" }, appSession: {} };
    await mw.updateSessionState(req, {}, () => {});
    expect(utils.redisClient.set).not.toHaveBeenCalled();
  });
});

describe("middlewares/tokenRenewal", () => {
  test("refreshIntercomTokenIfNeeded refreshes an expired access token", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const refresh = jest.fn().mockResolvedValue({ access_token: "fresh" });
    const req = {
      appSession: { access_token: "old" },
      oidc: { accessToken: { isExpired: () => true, refresh } },
    };
    let nextCalled = false;
    await mw.refreshIntercomTokenIfNeeded(req, {}, () => {
      nextCalled = true;
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(req.appSession.access_token).toBe("fresh");
    expect(nextCalled).toBe(true);
  });

  test("refreshIntercomTokenIfNeeded logs and continues when refresh fails", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const refresh = jest.fn().mockRejectedValue(new Error("token endpoint down"));
    const req = {
      appSession: { access_token: "old" },
      oidc: { accessToken: { isExpired: () => true, refresh } },
    };
    let nextCalled = false;
    await mw.refreshIntercomTokenIfNeeded(req, {}, () => {
      nextCalled = true;
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(utils.logger.error).toHaveBeenCalledWith(
      "Refreshing ICS expired access_token failed",
    );
    expect(req.appSession.access_token).toBe("old");
    expect(nextCalled).toBe(true);
  });

  test("refreshOIDCTokenIfNeeded skips when disabled and no token cached", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({
      utils,
      config: { ...baseConfig },
    });
    const req = { appSession: {} };
    let nextCalled = false;
    await mw.refreshOIDCTokenIfNeeded({
      name: "OpenCloud",
      enabled: false,
      session_storage_key: "oc_access_token",
      audience: "aud-oc",
    })(req, {}, () => {
      nextCalled = true;
    });
    expect(utils.fetchOIDCToken).not.toHaveBeenCalled();
    expect(nextCalled).toBe(true);
  });

  test("refreshOIDCTokenIfNeeded fetches a new token when the cached one is expired", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockRejectedValue(
      Object.assign(new Error("expired"), { code: "ERR_JWT_EXPIRED" }),
    );
    utils.fetchOIDCToken.mockResolvedValue("fresh-oc-token");
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { oc_access_token: "old", access_token: "subject" } };
    let nextCalled = false;
    await mw.refreshOIDCTokenIfNeeded({
      name: "OpenCloud",
      enabled: true,
      session_storage_key: "oc_access_token",
      audience: "aud-oc",
    })(req, {}, () => {
      nextCalled = true;
    });
    expect(utils.fetchOIDCToken).toHaveBeenCalledWith("subject", "aud-oc");
    expect(req.appSession.oc_access_token).toBe("fresh-oc-token");
    expect(nextCalled).toBe(true);
  });

  test("refreshOIDCTokenIfNeeded also refreshes on ERR_JWS_INVALID", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockRejectedValue(
      Object.assign(new Error("bad sig"), { code: "ERR_JWS_INVALID" }),
    );
    utils.fetchOIDCToken.mockResolvedValue("fresh-oc-token");
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { oc_access_token: "old", access_token: "subject" } };
    await mw.refreshOIDCTokenIfNeeded({
      name: "OpenCloud",
      enabled: true,
      session_storage_key: "oc_access_token",
      audience: "aud-oc",
    })(req, {}, () => {});
    expect(utils.fetchOIDCToken).toHaveBeenCalledWith("subject", "aud-oc");
    expect(req.appSession.oc_access_token).toBe("fresh-oc-token");
  });

  test("refreshOIDCTokenIfNeeded keeps the token when still valid", async () => {
    const utils = fakeUtils();
    utils.verifyJWT.mockResolvedValue({ valid: true });
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = { appSession: { oc_access_token: "valid", access_token: "subject" } };
    await mw.refreshOIDCTokenIfNeeded({
      name: "OpenCloud",
      enabled: true,
      session_storage_key: "oc_access_token",
      audience: "aud-oc",
    })(req, {}, () => {});
    expect(utils.fetchOIDCToken).not.toHaveBeenCalled();
  });

  test("refreshMatrixTokenIfNeeded fetches a matrix token when none is cached", async () => {
    const utils = fakeUtils();
    utils.fetchMatrixToken.mockResolvedValue("matrix-token");
    const mw = loadMiddlewares({ utils, config: baseConfig });
    const req = {
      appSession: { matrix_access_token: undefined },
      decodedAccessToken: { openedusuite_useruuid: "uuid-1" },
    };
    let nextCalled = false;
    await mw.refreshMatrixTokenIfNeeded(req, {}, () => {
      nextCalled = true;
    });
    expect(utils.fetchMatrixToken).toHaveBeenCalledWith("uuid-1");
    expect(req.appSession.matrix_access_token).toBe("matrix-token");
    expect(nextCalled).toBe(true);
  });

  test("refreshMatrixTokenIfNeeded skips when the integration is disabled", async () => {
    const utils = fakeUtils();
    const mw = loadMiddlewares({
      utils,
      config: { ...baseConfig, matrix: { ...baseConfig.matrix, enabled: false } },
    });
    const req = { appSession: {} };
    let nextCalled = false;
    await mw.refreshMatrixTokenIfNeeded(req, {}, () => {
      nextCalled = true;
    });
    expect(utils.fetchMatrixToken).not.toHaveBeenCalled();
    expect(nextCalled).toBe(true);
  });
});
