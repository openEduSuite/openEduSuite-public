/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Unit tests for the Keycloak token-exchange (utils/keycloak) and Matrix
 * appservice login (utils/matrix) helpers, with axios mocked.
 */
function mockConfig(config, extra = {}) {
  jest.resetModules();
  jest.doMock("../config", () => config);
  if (extra.matrixUrl !== undefined) {
    // no-op placeholder kept for readability; config is passed directly
  }
}

const baseKeycloakConfig = {
  intercom: {
    clientId: "intercom-client",
    clientSecret: "intercom-secret",
    proxy: false,
    baseUrl: "https://intercom.example.com",
  },
  issuerBaseUrl: "https://id.example.com/realms/master",
};

describe("utils/keycloak fetchOIDCToken", () => {
  let axios;
  let keycloak;
  let logger;

  beforeEach(() => {
    axios = { request: jest.fn() };
    logger = { error: jest.fn(), debug: jest.fn() };
    jest.doMock("axios", () => axios);
    jest.doMock("../utils/logger", () => ({ logger }));
    jest.doMock("../config", () => baseKeycloakConfig);
    keycloak = require("../utils/keycloak");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("returns the exchanged access_token on success", async () => {
    axios.request.mockResolvedValue({ data: { access_token: "new-token" } });
    const token = await keycloak.fetchOIDCToken("subject-token", "aud-oc");
    expect(token).toBe("new-token");
    expect(axios.request).toHaveBeenCalledTimes(1);
    const opts = axios.request.mock.calls[0][0];
    expect(opts.url).toBe(
      "https://id.example.com/realms/master/protocol/openid-connect/token",
    );
    expect(opts.method).toBe("POST");
    expect(opts.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(opts.data).toContain("grant_type=");
    expect(opts.data).toContain("urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange");
    expect(opts.data).toContain("subject_token=subject-token");
    expect(opts.data).toContain("audience=aud-oc");
    expect(opts.data).toContain("client_id=intercom-client");
    expect(opts.data).toContain("client_secret=intercom-secret");
  });

  test("returns undefined and logs on failure", async () => {
    axios.request.mockRejectedValue(new Error("network down"));
    const token = await keycloak.fetchOIDCToken("subject-token", "aud-x");
    expect(token).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Error fetching OIDC token for aud-x",
    );
  });
});

describe("utils/matrix fetchMatrixToken", () => {
  let axios;
  let matrix;
  let logger;

  beforeEach(() => {
    axios = { request: jest.fn() };
    logger = { error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
    jest.doMock("axios", () => axios);
    jest.doMock("../utils/logger", () => ({ logger }));
    matrix = require("../utils/matrix");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("returns undefined when the matrix integration is not configured", async () => {
    jest.doMock("../config", () => ({
      matrix: { url: undefined, appServiceSecret: "as-secret" },
      intercom: { proxy: false },
    }));
    jest.resetModules();
    matrix = jest.requireActual("../utils/matrix");
    const token = await matrix.fetchMatrixToken("Alice");
    expect(token).toBeUndefined();
    expect(axios.request).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Matrix integration not configured",
    );
  });

  test("returns the appservice login token on success", async () => {
    jest.doMock("../config", () => ({
      matrix: { url: "https://matrix.example.org", appServiceSecret: "as-secret" },
      intercom: { proxy: false },
    }));
    jest.resetModules();
    matrix = jest.requireActual("../utils/matrix");
    axios.request.mockResolvedValue({ data: { access_token: "matrix-token" } });
    const token = await matrix.fetchMatrixToken("Alice");
    expect(token).toBe("matrix-token");
    const opts = axios.request.mock.calls[0][0];
    expect(opts.url).toBe("https://matrix.example.org/_matrix/client/v3/login");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer as-secret");
    expect(opts.data.type).toBe("m.login.application_service");
    expect(opts.data.identifier.user).toBe("alice"); // lowercased by spec
  });

  test("returns undefined and logs on failure", async () => {
    jest.doMock("../config", () => ({
      matrix: { url: "https://matrix.example.org", appServiceSecret: "as-secret" },
      intercom: { proxy: false },
    }));
    jest.resetModules();
    matrix = jest.requireActual("../utils/matrix");
    axios.request.mockRejectedValue(new Error("boom"));
    const token = await matrix.fetchMatrixToken("Alice");
    expect(token).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("Error fetching Matrix token");
  });
});
