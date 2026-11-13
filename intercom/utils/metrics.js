/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 openEDU Team
 *
 * Prometheus metrics for the intercom service, exposed at GET /metrics.
 *
 * - Default Node.js / process metrics (event loop, GC, memory, handles),
 *   guarded so the polling interval never runs under jest.
 * - HTTP request counter + duration histogram (fed by metricsMiddleware).
 * - Outbound proxy request counter per backend target (fed by the shared
 *   Univention ICS proxy base).
 * - Redis connectivity gauge (fed by utils/redis.js event handlers).
 */
const client = require("prom-client");

/* global process */

const registry = new client.Registry();

if (
  typeof process.env.NODE_ENV !== "string" ||
  process.env.NODE_ENV !== "test"
) {
  // Polling default metrics (GC / event loop) keeps the process alive; under
  // jest that would leak open handles, so only enable outside tests.
  client.collectDefaultMetrics({ register: registry, prefix: "intercom_" });
}

const httpRequestsTotal = new client.Counter({
  name: "intercom_http_requests_total",
  help: "Total intercom HTTP requests handled.",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

const httpRequestDuration = new client.Histogram({
  name: "intercom_http_request_duration_seconds",
  help: "Intercom HTTP request duration in seconds.",
  labelNames: ["route"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const proxyRequestsTotal = new client.Counter({
  name: "intercom_proxy_requests_total",
  help: "Intercom outbound proxy requests per backend target.",
  labelNames: ["target"],
  registers: [registry],
});

const redisConnected = new client.Gauge({
  name: "intercom_redis_connected",
  help: "1 when the intercom holds a live Redis connection, 0 otherwise.",
  registers: [registry],
});

/**
 * Express middleware: counts every completed request and records its
 * duration. Skips the /metrics endpoint itself.
 */
function metricsMiddleware(req, res, next) {
  if (req.path === "/metrics") {
    return next();
  }
  const route = (req.route && req.route.path) || req.baseUrl || req.path || "unknown";
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
    httpRequestDuration.labels(route).observe(seconds);
  });
  next();
}

/**
 * Express handler for GET /metrics — renders the prometheus text format.
 */
async function metricsHandler(req, res) {
  res.setHeader("Content-Type", registry.contentType);
  res.end(await registry.metrics());
}

/**
 * Record one outbound proxy request towards a backend target.
 * @param {string} target backend URL the proxy forwarded to
 */
function incrementProxyRequest(target) {
  proxyRequestsTotal.labels(target).inc();
}

/**
 * Reflect the current Redis connectivity in the gauge.
 * @param {boolean} connected
 */
function setRedisConnected(connected) {
  redisConnected.set(connected ? 1 : 0);
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  incrementProxyRequest,
  setRedisConnected,
  registry,
};
