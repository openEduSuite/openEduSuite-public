/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Controller tests for the two tiny non-proxy endpoints /silent and /uuid.
 */
const path = require("path");
const express = require("express");
const request = require("supertest");

describe("routes/silent", () => {
  function loadSilent(appSession) {
    jest.resetModules();
    jest.doMock("../utils", () => ({
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    }));
    const silent = require("../routes/silent");
    const app = express();
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.use((req, res, next) => {
      req.appSession = appSession;
      req.cookies = { _csrf_token: "csrf-1" };
      next();
    });
    app.use("/silent", silent);
    return app;
  }

  test("reports a logged-in session status", async () => {
    const app = loadSilent({ access_token: "at" });
    const res = await request(app).get("/silent");
    expect(res.status).toBe(200);
    expect(res.text).toContain("true");
  });

  test("reports a logged-out session status", async () => {
    const app = loadSilent({ id_token: "it" });
    const res = await request(app).get("/silent");
    expect(res.status).toBe(200);
    expect(res.text).toContain("false");
  });
});

describe("routes/uuid", () => {
  function loadUuid(decodedIdToken) {
    jest.resetModules();
    jest.doMock("../config", () => ({
      userUniqueMapper: "openedusuite_useruuid",
    }));
    const uuid = require("../routes/uuid");
    const app = express();
    app.use((req, res, next) => {
      req.decodedIdToken = decodedIdToken;
      next();
    });
    app.use("/uuid", uuid);
    return app;
  }

  test("returns the unique user id from the decoded id token", async () => {
    const app = loadUuid({ openedusuite_useruuid: "uuid-123" });
    const res = await request(app).get("/uuid");
    expect(res.status).toBe(200);
    expect(res.text).toBe("uuid-123");
  });

  test("returns an empty body when the claim is absent", async () => {
    const app = loadUuid({ name: "alice" });
    const res = await request(app).get("/uuid");
    expect(res.status).toBe(200);
    // res.send(undefined) renders an empty body
    expect(res.text).toBe("");
  });
});
