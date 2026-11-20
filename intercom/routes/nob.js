/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const config = require("../config");
const { nordeck, matrix } = config;

/**
 * @name /nob/
 * @desc
 * Proxy for the Nordeck Bot (or just the plain Matrix UserInfo Service in
 * testing). Extends the shared Univention ICS base; adds the proper
 * Authorization Header via the Matrix session.
 *
 * ## AI summary (opt-in, docs/services-intercom-ai.md)
 *
 * When `AI_SUMMARY_ENABLED` (env `AI_SUMMARY_ENABLED`, default `false`) is
 * switched on, an extra `POST /nob/ai/summarize` endpoint is mounted **before**
 * the catch-all proxy: the existing Matrix bot fetches the requested thread
 * (`!ai` trigger in one of the configured `AI_ROOMS`) and POSTs the message
 * texts here; intercom asks the LiteLLM gateway (model alias `qwen3-30b`) for
 * a 3–4 sentence German summary and returns the text the bot posts back.
 * Everything else keeps flowing to the Nordeck backend unchanged.
 */
const AI_SUMMARY_ENABLED = config.aiSummaryEnabled === true;
const AI_ROOMS = Array.isArray(config.aiRooms) ? config.aiRooms : [];
const AI_TRIGGER = config.aiTrigger || "!ai";
const AI_MESSAGE_LIMIT = config.aiMessageLimit || 50;
const LITELLM = config.litellm || {};
const AI_SUMMARY_MODEL = LITELLM.model || "qwen3-30b";

const AI_SUMMARY_SYSTEM_PROMPT = [
  "Du bist ein Assistent des openEduSuite-Operations-Teams.",
  "Fasse den übermittelten Matrix-Thread in drei bis vier deutschen Sätzen zusammen:",
  "Thema, offene Punkte bzw. Entscheidungen und ggf. vereinbarte nächste Schritte.",
  "Antworte nur mit der Zusammenfassung — keine Einleitung, keine Aufzählung,",
  "keine Namen, keine personenbezogenen Daten.",
].join(" ");

/**
 * DSGVO: sender display names, e-mail addresses and phone-like number blocks
 * never leave the service; only the redacted text is sent to the gateway and
 * nothing is stored or logged.
 */
const PII_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, // e-mail
  /\+?\d[\d\s./-]{7,}\d/g, // phone / matriculation-number-like blocks
];

/** Best-effort PII redaction of message text (never throws). */
function redactPii(text) {
  let redacted = String(text ?? "");
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern, "[redigiert]");
  }
  return redacted;
}

/** Only an explicit "!ai" command may trigger a summary. */
function isAiSummaryTrigger(text) {
  const trimmed = String(text ?? "")
    .trim()
    .toLowerCase();
  const trigger = AI_TRIGGER.toLowerCase();
  return trimmed === trigger || trimmed.startsWith(`${trigger} `);
}

/** Local part of a Matrix room alias/id: "#ops-alerts:a.b" -> "ops-alerts". */
function roomLocalPart(room) {
  return String(room ?? "")
    .trim()
    .replace(/^[#!@]/, "")
    .split(":")[0]
    .toLowerCase();
}

/** True when the room is on the AI_ROOMS allow-list. */
function isAiSummaryRoom(room) {
  if (!AI_ROOMS.length || !roomLocalPart(room)) {
    return false;
  }
  const requested = String(room).trim().toLowerCase();
  const localPart = roomLocalPart(room);
  return AI_ROOMS.some(
    (allowed) =>
      String(allowed).trim().toLowerCase() === requested ||
      roomLocalPart(allowed) === localPart,
  );
}

/** Normalise bot-supplied thread events to {sender, body} text messages. */
function normalizeThreadMessages(messages, { limit = AI_MESSAGE_LIMIT } = {}) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      sender:
        typeof message.sender === "string"
          ? message.sender
          : message.user_id || message.sender_id || "unbekannt",
      body:
        typeof message.body === "string"
          ? message.body
          : typeof message.content === "string"
            ? message.content
            : typeof message.content?.body === "string"
              ? message.content.body
              : "",
    }))
    .filter((message) => String(message.body).trim().length > 0)
    .slice(-Math.max(1, limit));
}

/** Replace Matrix user IDs with stable, non-identifying labels. */
function anonymizeThread(thread) {
  const labels = new Map();
  return thread.map((message) => {
    const key = String(message.sender).toLowerCase();
    if (!labels.has(key)) {
      labels.set(key, `Teilnehmer ${labels.size + 1}`);
    }
    return `[${labels.get(key)}] ${redactPii(message.body)}`;
  });
}

/** Build the (German) summarisation prompt from the thread text. */
function buildAiSummaryPrompt(messages, { limit = AI_MESSAGE_LIMIT } = {}) {
  const thread = normalizeThreadMessages(messages, { limit });
  if (!thread.length) {
    return "";
  }
  return [
    "Matrix-Thread (chronologisch, Sender anonymisiert, PII redigiert):",
    ...anonymizeThread(thread),
    "",
    "Erstelle daraus die Zusammenfassung (drei bis vier Sätze, Deutsch).",
  ].join("\n");
}

/**
 * Build the LiteLLM chat-completion request (URL + body). The API key is
 * deliberately NOT part of this object — it is injected from config at call
 * time and never serialised or logged.
 */
function buildAiSummaryRequest({ messages, litellm = LITELLM, limit } = {}) {
  const baseUrl = String(litellm?.url ?? "")
    .trim()
    .replace(/\/+$/, "");
  return {
    url: `${baseUrl}/v1/chat/completions`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      model: litellm?.model || AI_SUMMARY_MODEL,
      messages: [
        { role: "system", content: AI_SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildAiSummaryPrompt(messages, {
            limit: limit || AI_MESSAGE_LIMIT,
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    },
  };
}

/**
 * Summarise a thread via the LiteLLM gateway.
 * Returns `{ text, model }` on success or `{ skipped: true, reason }` — it
 * never throws, so the express handler stays simple.
 */
async function summarizeThread({
  messages,
  enabled = AI_SUMMARY_ENABLED,
  litellm = LITELLM,
  fetchImpl = globalThis.fetch,
  limit,
} = {}) {
  if (enabled !== true) {
    return { skipped: true, reason: "ai_summary_disabled" };
  }
  if (!litellm?.url) {
    return { skipped: true, reason: "litellm_url_missing" };
  }
  if (!litellm?.key) {
    return { skipped: true, reason: "litellm_key_missing" };
  }
  if (typeof fetchImpl !== "function") {
    return { skipped: true, reason: "http_client_missing" };
  }
  const request = buildAiSummaryRequest({ messages, litellm, limit });
  if (!request.body.messages[1].content) {
    return { skipped: true, reason: "empty_thread" };
  }
  let response;
  try {
    response = await fetchImpl(request.url, {
      method: request.method,
      headers: { ...request.headers, Authorization: `Bearer ${litellm.key}` },
      body: JSON.stringify(request.body),
    });
  } catch (error) {
    logAiError(
      `litellm_request_failed:${error?.code || error?.name || "error"}`,
    );
    return { skipped: true, reason: "litellm_request_failed" };
  }
  if (!response.ok) {
    logAiError(`litellm_http_${response.status}`);
    return { skipped: true, reason: `litellm_http_${response.status}` };
  }
  let data;
  try {
    data = await response.json();
  } catch {
    return { skipped: true, reason: "litellm_invalid_response" };
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) {
    return { skipped: true, reason: "litellm_empty_summary" };
  }
  return {
    text: String(text).trim(),
    model: request.body.model,
    language: "de",
    sentences: "3-4",
  };
}

/**
 * Log error codes only (no thread content, no key). The winston logger lives
 * behind a lazy require so this module stays loadable without the full
 * intercom dependency tree (see the offline unit test).
 */
function logAiError(code) {
  try {
    require("../utils").logger.error(`nob ai-summary: ${code}`);
  } catch {
    // Dependency-less environment — nothing to log to.
  }
}

/**
 * POST /nob/ai/summarize — see docs/services-intercom-ai.md.
 * Behind the regular /nob middlewares (OIDC session + CSRF).
 *
 * The factory shape keeps the endpoint unit-testable without express
 * (`intercom/test/ai-summary.test.mjs`).
 */
function createAiSummarizeHandler({
  enabled = AI_SUMMARY_ENABLED,
  litellm = LITELLM,
  fetchImpl = globalThis.fetch,
} = {}) {
  return async function aiSummarize(req, res) {
    const payload = req.body || {};
    const roomId = payload.room_id || payload.roomId || payload.room;
    const trigger = payload.trigger || payload.text || "";
    const messages = payload.messages;

    if (enabled !== true) {
      return res
        .status(503)
        .json({ error: "AI summary is disabled (AI_SUMMARY_ENABLED=false)" });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Field 'messages' (array of { sender, body }) is required",
      });
    }
    if (!isAiSummaryTrigger(trigger)) {
      return res.status(400).json({
        error: `Only threads explicitly requested with '${AI_TRIGGER}' are summarised`,
      });
    }
    if (!isAiSummaryRoom(roomId)) {
      return res.status(403).json({
        error: `AI summary is not enabled for room '${roomId}'`,
      });
    }

    const result = await summarizeThread({
      messages,
      enabled,
      litellm,
      fetchImpl,
    });
    if (result.skipped) {
      logAiError(result.reason);
      return res
        .status(502)
        .json({ error: `AI summary unavailable (${result.reason})` });
    }
    return res.json({
      summary: result.text,
      model: result.model,
      room_id: roomId,
      language: result.language,
      sentences: result.sentences,
    });
  };
}

let createIntercomRoute;
try {
  createIntercomRoute = require("./base");
} catch (error) {
  // Dependency-less environments (no express/http-proxy-middleware installed,
  // e.g. the offline unit test intercom/test/ai-summary.test.mjs) cannot build
  // the proxy router. The pure AI-summary helpers above stay loadable so the
  // flag-gated behaviour can still be verified without a dependency install.
  createIntercomRoute = null;
}

function createNobRouter(factory) {
  const express = require("express");
  const router = express.Router();
  if (AI_SUMMARY_ENABLED) {
    // Registered before the catch-all proxy below; app.js only registers
    // express.urlencoded globally, so the JSON body parser is local.
    router.post(
      "/ai/summarize",
      express.json({ limit: "512kb" }),
      createAiSummarizeHandler(),
    );
  }
  router.use(
    "/",
    factory({
      name: "Nordeck",
      config: {
        url: nordeck.url,
        session_storage_key: matrix?.session_storage_key,
      },
      mountPrefix: "/nob",
      secure: false,
      disabledMessage: "Nordeck integration is not configured",
      missingSessionMessage:
        "No Matrix session found in appSession. Likely Matrix is not configured",
    }),
  );
  return router;
}

const nobRouter = createIntercomRoute
  ? createNobRouter(createIntercomRoute)
  : null;

if (nobRouter) {
  module.exports = nobRouter;
} else {
  module.exports = {};
}

/**
 * Pure AI-summary helpers, exposed for the offline unit test and tooling.
 * The router itself stays the module's default export.
 */
module.exports.nobAiSummary = {
  AI_SUMMARY_ENABLED,
  AI_ROOMS,
  AI_TRIGGER,
  AI_SUMMARY_MODEL,
  redactPii,
  isAiSummaryTrigger,
  isAiSummaryRoom,
  buildAiSummaryPrompt,
  buildAiSummaryRequest,
  summarizeThread,
  createAiSummarizeHandler,
};
