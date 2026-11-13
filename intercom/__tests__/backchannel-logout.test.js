/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Backchannel logout (routes/backchannelLogout.js): signs a real logout_token
 * with a real RS256 key and verifies the route deletes the Redis sessions.
 */
const express = require("express");
const request = require("supertest");
const jose = require("jose");

const ISSUER = "http://keycloak.test:8080/auth/realms/test";

describe("routes/backchannelLogout", () => {
  let redisClient;
  let logger;
  let privateKey;

  beforeEach(async () => {
    jest.resetModules();

    const { privateKey: pk, publicKey } = await jose.generateKeyPair("RS256");
    privateKey = pk;
    const jwk = await jose.exportJWK(publicKey);
    jwk.kid = "test-key";
    jwk.alg = "RS256";
    const JWKS = jose.createLocalJWKSet({ keys: [jwk] });

    redisClient = {
      get: jest.fn((key, cb) => cb(null, "cookie-id-42")),
      del: jest.fn().mockResolvedValue(1),
    };
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    jest.doMock("../config", () => ({ issuerBaseUrl: ISSUER }));
    jest.doMock("../utils", () => ({ JWKS, redisClient, logger }));
  });

  function loadRoute() {
    const logout = require("../routes/backchannelLogout");
    const app = express();
    app.use(express.json());
    app.use("/backchannel-logout", logout);
    return app;
  }

  async function signLogoutToken({ issuer = ISSUER, kid = "test-key" } = {}) {
    return new jose.SignJWT({ sid: "sess-abc", aud: "test-client" })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuedAt()
      .setIssuer(issuer)
      .setExpirationTime("5s")
      .sign(privateKey);
  }

  test("verifies the logout token and deletes both redis session keys", async () => {
    const app = loadRoute();
    const res = await request(app)
      .post("/backchannel-logout")
      .send({ logout_token: await signLogoutToken() });
    expect(res.status).toBe(200);
    expect(res.text).toBe("Done");

    expect(redisClient.get).toHaveBeenCalledWith("sess-abc", expect.any(Function));
    // get() resolves the session cookie id; both that session key (prefixed
    // "sess:") and the sid key itself are removed.
    expect(redisClient.del).toHaveBeenCalledWith("sess:cookie-id-42");
    expect(redisClient.del).toHaveBeenCalledWith("sess-abc");
    expect(logger.info).toHaveBeenCalledWith("Backchannel logout");
  });

  test("rejects a token signed by an unknown key", async () => {
    const app = loadRoute();
    const res = await request(app)
      .post("/backchannel-logout")
      .send({ logout_token: await signLogoutToken({ kid: "other-key" }) });
    expect(res.status).toBe(400);
    expect(res.text).toBe("Bad request");
    expect(redisClient.del).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Backchannel logout token verification failed",
    );
  });

  test("rejects a token with a foreign issuer", async () => {
    const app = loadRoute();
    const res = await request(app)
      .post("/backchannel-logout")
      .send({
        logout_token: await signLogoutToken({ issuer: "http://evil.example.com/realms/x" }),
      });
    expect(res.status).toBe(400);
    expect(redisClient.del).not.toHaveBeenCalled();
  });
});
