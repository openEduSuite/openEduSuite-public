/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Tests for the intercom Prometheus metrics (utils/metrics.js).
 *
 * Assertions parse the rendered exposition format (registry.metrics()), which
 * is the stable public contract of prom-client.
 */
const express = require("express");
const request = require("supertest");

let metrics;

/**
 * Parse every exposition sample whose family name starts with `prefix`.
 * Returns [{ labels, value }] — labels omitted for unlabeled samples.
 */
async function samples(prefix) {
  const text = await metrics.registry.metrics();
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith(prefix)) continue;
    const m = line.match(/^[^{]+\{(.*)\} (\S+)$/) || line.match(/^\S+ (\S+)$/);
    if (!m) continue;
    const sample = { labels: {}, value: parseFloat(m[m.length - 1]) };
    if (line.includes("{")) {
      m[1].split(",").forEach((pair) => {
        const [k, v] = pair.split("=");
        sample.labels[k] = v.replace(/"/g, "");
      });
    }
    out.push(sample);
  }
  return out;
}

describe("utils/metrics", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../config", () => ({ logLevel: "silent" }));
    metrics = require("../utils/metrics");
  });

  afterEach(() => {
    metrics.registry.clear();
  });

  describe("metricsHandler", () => {
    test("serves the prometheus text format with the custom intercom metrics", async () => {
      const app = express();
      app.get("/metrics", metrics.metricsHandler);
      const res = await request(app).get("/metrics");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^text\/plain/);
      expect(res.text).toContain("intercom_http_requests_total");
      expect(res.text).toContain("intercom_http_request_duration_seconds");
      expect(res.text).toContain("intercom_proxy_requests_total");
      expect(res.text).toContain("intercom_redis_connected");
    });
  });

  describe("metricsMiddleware", () => {
    test("counts each completed request by method and base route", async () => {
      const app = express();
      app.use(metrics.metricsMiddleware);
      app.get("/oc", (req, res) => res.send("ok"));
      app.get("/", (req, res) => res.send("ok"));
      await request(app).get("/oc").expect(200);
      await request(app).get("/oc").expect(200);
      await request(app).get("/").expect(200);

      const s = await samples("intercom_http_requests_total");
      const find = (method, route) =>
        s.find(
          (x) => x.labels.method === method && x.labels.route === route,
        );
      expect(find("GET", "/oc").value).toBe(2);
      expect(find("GET", "/").value).toBe(1);
    });

    test("records request durations in the histogram", async () => {
      const app = express();
      app.use(metrics.metricsMiddleware);
      app.get("/sogo", (req, res) => setTimeout(() => res.send("ok"), 5));
      await request(app).get("/sogo").expect(200);

      const s = await samples("intercom_http_request_duration_seconds");
      // _created line has no le label; the +Inf bucket carries the count.
      const total = s.find(
        (x) => x.labels.route === "/sogo" && x.labels.le === "+Inf",
      );
      expect(total).toBeDefined();
      expect(total.value).toBeGreaterThanOrEqual(1);
      expect(s.some((x) => x.labels.route === "/sogo" && x.labels.le === "0.005"))
        .toBe(true);
    });

    test("does not count /metrics itself", async () => {
      const app = express();
      app.use(metrics.metricsMiddleware);
      app.get("/metrics", metrics.metricsHandler);
      await request(app).get("/metrics").expect(200);

      const s = await samples("intercom_http_requests_total");
      expect(s.some((x) => x.labels.route === "/metrics")).toBe(false);
    });
  });

  describe("proxy metric", () => {
    test("incrementProxyRequest counts per backend target", async () => {
      metrics.incrementProxyRequest("https://sogo.example.org");
      metrics.incrementProxyRequest("https://sogo.example.org");
      metrics.incrementProxyRequest("https://nextcloud.example.org");

      const s = await samples("intercom_proxy_requests_total");
      const find = (target) => s.find((x) => x.labels.target === target);
      expect(find("https://sogo.example.org").value).toBe(2);
      expect(find("https://nextcloud.example.org").value).toBe(1);
    });
  });

  describe("redis gauge", () => {
    test("tracks connected state as 1/0 in the exposition", async () => {
      metrics.setRedisConnected(true);
      metrics.setRedisConnected(true);
      let s = await samples("intercom_redis_connected");
      expect(s.find((x) => Object.keys(x.labels).length === 0).value).toBe(1);

      metrics.setRedisConnected(false);
      s = await samples("intercom_redis_connected");
      expect(s.find((x) => Object.keys(x.labels).length === 0).value).toBe(0);
    });
  });
});
