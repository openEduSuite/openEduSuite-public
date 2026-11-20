#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 openEDU Team
//
// ai-summary.test.mjs — offline contract test for the /nob AI summary
// (P3-5, docs/services-intercom-ai.md).
//
// Runs with plain node — no jest, no express, no network:
//
//   node intercom/test/ai-summary.test.mjs
//
// The intercom jest suite only picks up intercom/__tests__/*.test.js — this
// file intentionally lives in intercom/test/ so it stays runnable in
// dependency-less worktrees/CI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The module reads the env at load time — make the flag default (false)
// deterministic, independent of the invoking shell.
for (const key of [
  "AI_SUMMARY_ENABLED",
  "AI_ROOMS",
  "AI_TRIGGER",
  "AI_MESSAGE_LIMIT",
  "LITELLM_URL",
  "LITELLM_KEY",
  "LITELLM_MODEL",
]) {
  delete process.env[key];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const intercomRoot = path.resolve(here, "..");
const nobPath = path.join(intercomRoot, "routes", "nob.js");
const nobSource = readFileSync(nobPath, "utf8");

const { default: nobModule, nobAiSummary } = await import(
  new URL(`file://${nobPath}`).href
);

const {
  AI_SUMMARY_ENABLED,
  AI_ROOMS,
  AI_SUMMARY_MODEL,
  isAiSummaryTrigger,
  isAiSummaryRoom,
  buildAiSummaryPrompt,
  buildAiSummaryRequest,
  summarizeThread,
  createAiSummarizeHandler,
} = nobAiSummary;

const THREAD = [
  {
    sender: "@ops:hrz.example.org",
    body: "LDAP-Anbindung für ILIAS schlägt fehl, Nutzer können sich nicht einloggen.",
    origin_server_ts: 1763000000000,
  },
  {
    sender: "@admin:hrz.example.org",
    body: "Wir hatten das schon im September. Bitte TLS am Connector prüfen.",
    origin_server_ts: 1763000060000,
  },
  {
    sender: "@ops:hrz.example.org",
    body: "Bestätigt, Zertifikat war abgelaufen. Erneuert, Login geht wieder.",
    origin_server_ts: 1763000120000,
  },
];

const TEST_LITELLM = {
  url: "http://litellm.llm.svc.cluster.local:4000",
  model: "qwen3-30b",
  key: "litellm-config-key-not-a-secret",
};

/** Minimal Response stand-in — the code only uses ok/status/json. */
function fakeResponse({ ok = true, status = 200, data = {} } = {}) {
  return { ok, status, json: async () => data };
}

test("AI summary is disabled unless AI_SUMMARY_ENABLED is set", () => {
  assert.equal(AI_SUMMARY_ENABLED, false);
  assert.match(nobSource, /AI_SUMMARY_ENABLED/);
});

test("disabled flag means: no LiteLLM call at all", async () => {
  let calls = 0;
  const result = await summarizeThread({
    messages: THREAD,
    enabled: false, // what AI_SUMMARY_ENABLED=false resolves to
    litellm: TEST_LITELLM,
    fetchImpl: async () => {
      calls += 1;
      return fakeResponse();
    },
  });
  assert.equal(calls, 0);
  assert.deepEqual(result, { skipped: true, reason: "ai_summary_disabled" });
});

test("only an explicit '!ai' message triggers a summary", () => {
  assert.equal(isAiSummaryTrigger("!ai"), true);
  assert.equal(isAiSummaryTrigger("!ai bitte zusammenfassen"), true);
  assert.equal(isAiSummaryTrigger("!AI Thread review"), true);
  assert.equal(isAiSummaryTrigger("könntest du !ai machen"), false);
  assert.equal(isAiSummaryTrigger("!ail"), false);
  assert.equal(isAiSummaryTrigger(""), false);
  assert.equal(isAiSummaryTrigger(null), false);
});

test("only configured AI rooms are summarised", () => {
  assert.deepEqual(AI_ROOMS, [
    "#ops-alerts",
    "#edu-lifecycle",
    "#billing",
    "#support",
  ]);
  assert.equal(isAiSummaryRoom("#ops-alerts"), true);
  assert.equal(isAiSummaryRoom("#ops-alerts:hrz.example.org"), true);
  assert.equal(isAiSummaryRoom("!abc123:hrz.example.org"), false);
  assert.equal(isAiSummaryRoom(""), false);
  assert.equal(isAiSummaryRoom(undefined), false);
});

test("prompt is built from the thread text, senders anonymised, PII redacted", () => {
  const prompt = buildAiSummaryPrompt([
    ...THREAD,
    {
      sender: "@helpdesk:hrz.example.org",
      body: "Rückfrage an max.mustermann@example.org, Tel. 030 1234 5678",
    },
  ]);

  // Thread content is part of the prompt …
  assert.match(prompt, /LDAP-Anbindung für ILIAS/);
  assert.match(prompt, /Zertifikat war abgelaufen/);
  assert.match(prompt, /Rückfrage an/);
  // … in chronological order.
  assert.ok(
    prompt.indexOf("LDAP-Anbindung") < prompt.indexOf("Zertifikat war abgelaufen"),
  );
  assert.ok(
    prompt.indexOf("Zertifikat war abgelaufen") <
      prompt.indexOf("Rückfrage an"),
  );
  // 3–4 German sentences are requested.
  assert.match(prompt, /drei bis vier Sätzen?, Deutsch/);

  // DSGVO: no Matrix user IDs, no e-mail/phone in the prompt.
  assert.doesNotMatch(prompt, /@ops:hrz\.openedusuite\.org/);
  assert.doesNotMatch(prompt, /@helpdesk:hrz\.openedusuite\.org/);
  assert.doesNotMatch(prompt, /max\.mustermann@example\.org/);
  assert.doesNotMatch(prompt, /030 1234 5678/);
  assert.match(prompt, /Teilnehmer 1/);
  assert.match(prompt, /\[redigiert\]/);
});

test("empty or text-less threads produce an empty prompt", () => {
  assert.equal(buildAiSummaryPrompt([]), "");
  assert.equal(buildAiSummaryPrompt([{ sender: "@a:b" }]), "");
  assert.equal(
    buildAiSummaryPrompt([{ sender: "@a:b", content: { msgtype: "m.image" } }]),
    "",
  );
});

test("LiteLLM request shape: OpenAI-compatible chat completion, alias qwen3-30b", () => {
  const request = buildAiSummaryRequest({
    messages: THREAD,
    litellm: TEST_LITELLM,
  });

  assert.equal(request.method, "POST");
  assert.equal(
    request.url,
    "http://litellm.llm.svc.cluster.local:4000/v1/chat/completions",
  );
  assert.equal(request.body.model, "qwen3-30b");
  assert.equal(AI_SUMMARY_MODEL, "qwen3-30b");
  assert.deepEqual(
    request.body.messages.map((message) => message.role),
    ["system", "user"],
  );
  assert.match(request.body.messages[0].content, /deutschen Sätzen/);
  assert.ok(request.body.messages[1].content.includes("Matrix-Thread"));
  assert.equal(request.body.max_tokens, 300);
});

test("no key material in the request object (key injected at call time)", () => {
  const request = buildAiSummaryRequest({
    messages: THREAD,
    litellm: TEST_LITELLM,
  });
  const serialised = JSON.stringify(request);
  assert.equal("Authorization" in request.headers, false);
  assert.equal(serialised.includes(TEST_LITELLM.key), false);
  assert.doesNotMatch(serialised, /sk-[A-Za-z0-9]{16,}/);
  // Source: no literal gateway key either.
  assert.doesNotMatch(nobSource, /sk-[A-Za-z0-9]{16,}/);
});

test("enabled flag calls LiteLLM with the config key, returns the summary text", async () => {
  let seenUrl;
  let seenInit;
  const result = await summarizeThread({
    messages: THREAD,
    enabled: true,
    litellm: TEST_LITELLM,
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return fakeResponse({
        data: {
          choices: [{ message: { content: "  Drei Sätze Zusammenfassung.  " } }],
        },
      });
    },
  });

  assert.equal(seenUrl, `${TEST_LITELLM.url}/v1/chat/completions`);
  assert.equal(seenInit.method, "POST");
  assert.equal(seenInit.headers.Authorization, `Bearer ${TEST_LITELLM.key}`);
  const body = JSON.parse(seenInit.body);
  assert.equal(body.model, "qwen3-30b");
  assert.deepEqual(
    body.messages.map((message) => message.role),
    ["system", "user"],
  );

  assert.deepEqual(result, {
    text: "Drei Sätze Zusammenfassung.",
    model: "qwen3-30b",
    language: "de",
    sentences: "3-4",
  });
});

test("unconfigured gateway and upstream errors are reported, never thrown", async () => {
  assert.deepEqual(
    await summarizeThread({
      messages: THREAD,
      enabled: true,
      litellm: { url: TEST_LITELLM.url, model: "qwen3-30b" },
      fetchImpl: async () => fakeResponse(),
    }),
    { skipped: true, reason: "litellm_key_missing" },
  );
  assert.deepEqual(
    await summarizeThread({
      messages: [],
      enabled: true,
      litellm: TEST_LITELLM,
      fetchImpl: async () => fakeResponse(),
    }),
    { skipped: true, reason: "empty_thread" },
  );
  assert.deepEqual(
    await summarizeThread({
      messages: THREAD,
      enabled: true,
      litellm: TEST_LITELLM,
      fetchImpl: async () => fakeResponse({ ok: false, status: 429 }),
    }),
    { skipped: true, reason: "litellm_http_429" },
  );
  assert.deepEqual(
    await summarizeThread({
      messages: THREAD,
      enabled: true,
      litellm: TEST_LITELLM,
      fetchImpl: async () => fakeResponse({ data: { choices: [] } }),
    }),
    { skipped: true, reason: "litellm_empty_summary" },
  );
});

test("intercom config reads the AI flags from env with safe defaults", () => {
  const probe = `
    const config = require(${JSON.stringify(
      path.join(intercomRoot, "config", "config.js"),
    )});
    console.log(
      JSON.stringify({
        enabled: config.aiSummaryEnabled,
        rooms: config.aiRooms,
        model: config.litellm.model,
        trigger: config.aiTrigger,
        key: config.litellm.key === undefined ? null : config.litellm.key,
      }),
    );
  `;
  const run = (extraEnv) =>
    JSON.parse(
      execFileSync(process.execPath, ["-e", probe], {
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          ORIGIN_REGEX: ".*",
          ...extraEnv,
        },
        encoding: "utf8",
      }),
    );

  assert.deepEqual(run({}), {
    enabled: false,
    rooms: ["#ops-alerts", "#edu-lifecycle", "#billing", "#support"],
    model: "qwen3-30b",
    trigger: "!ai",
    key: null,
  });

  assert.deepEqual(
    run({
      AI_SUMMARY_ENABLED: "true",
      AI_ROOMS: "#ops-alerts, #support",
      LITELLM_URL: "http://litellm.llm.svc.cluster.local:4000/",
      LITELLM_KEY: "litellm-env-key-not-a-secret",
    }),
    {
      enabled: true,
      rooms: ["#ops-alerts", "#support"],
      model: "qwen3-30b",
      trigger: "!ai",
      key: "litellm-env-key-not-a-secret",
    },
  );
});

test("nob module exports the AI helpers alongside the router", () => {
  // With dependencies installed the default export is the express router;
  // without them (this offline run) it is an inert placeholder object.
  assert.ok(["function", "object"].includes(typeof nobModule));
  assert.equal(nobModule.nobAiSummary, nobAiSummary);
  for (const helper of [
    isAiSummaryTrigger,
    isAiSummaryRoom,
    buildAiSummaryPrompt,
    buildAiSummaryRequest,
    summarizeThread,
  ]) {
    assert.equal(typeof helper, "function");
  }
});

/** Minimal express req/res pair for exercising the endpoint handler. */
function callEndpoint(handler, body) {
  const state = { statusCode: 200, body: undefined };
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
  };
  return Promise.resolve(handler({ body }, res)).then(() => state);
}

const handlerFor = (overrides) =>
  createAiSummarizeHandler({ litellm: TEST_LITELLM, ...overrides });

test("endpoint: disabled flag answers 503 without calling the gateway", async () => {
  const state = await callEndpoint(
    handlerFor({
      enabled: false,
      fetchImpl: async () => {
        throw new Error("must not be called");
      },
    }),
    { room_id: "#ops-alerts", trigger: "!ai", messages: THREAD },
  );
  assert.equal(state.statusCode, 503);
  assert.match(state.body.error, /AI_SUMMARY_ENABLED=false/);
});

test("endpoint: 400 without messages or trigger, 403 outside AI_ROOMS", async () => {
  assert.equal(
    (await callEndpoint(handlerFor({ enabled: true }), { trigger: "!ai" }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await callEndpoint(handlerFor({ enabled: true }), {
        room_id: "#ops-alerts",
        trigger: "please summarise",
        messages: THREAD,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await callEndpoint(handlerFor({ enabled: true }), {
        room_id: "#random-room:hrz.example.org",
        trigger: "!ai",
        messages: THREAD,
      })
    ).statusCode,
    403,
  );
});

test("endpoint: 200 with the summary the bot posts back", async () => {
  const state = await callEndpoint(
    handlerFor({
      enabled: true,
      fetchImpl: async () =>
        fakeResponse({
          data: {
            choices: [{ message: { content: "Kurze deutsche Zusammenfassung." } }],
          },
        }),
    }),
    {
      room_id: "#ops-alerts:hrz.example.org",
      trigger: "!ai",
      messages: THREAD,
    },
  );
  assert.deepEqual(state, {
    statusCode: 200,
    body: {
      summary: "Kurze deutsche Zusammenfassung.",
      model: "qwen3-30b",
      room_id: "#ops-alerts:hrz.example.org",
      language: "de",
      sentences: "3-4",
    },
  });
});

test("endpoint: upstream problems surface as 502 with a reason code", async () => {
  const state = await callEndpoint(
    handlerFor({
      enabled: true,
      fetchImpl: async () => fakeResponse({ ok: false, status: 500 }),
    }),
    { room_id: "#support", trigger: "!ai", messages: THREAD },
  );
  assert.equal(state.statusCode, 502);
  assert.match(state.body.error, /litellm_http_500/);
});

