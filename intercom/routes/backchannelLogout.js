/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 */

const express = require("express");
const router = express.Router();

const jose = require("jose");

const { issuerBaseUrl } = require("../config");
const { JWKS, redisClient, logger } = require("../utils");

/**
 * @name /backchannel-logout
 * @desc
 * OpenID Connect Backchannel Logout implementation to delete the session from the store
 */
router.post("/", async (req, res) => {
  try {
    const { payload } = await jose.jwtVerify(
      // decode and validates claims set
      req.body.logout_token,
      JWKS,
      {
        issuer: issuerBaseUrl,
        maxTokenAge: "10 seconds", // TODO: to avoid replay attack too far after issued_at
      },
    );
    redisClient.get(payload.sid, async (err, session_id) => {
      await redisClient.del("sess:" + session_id);
      await redisClient.del(payload.sid);
      logger.info("Backchannel logout");
      res.send("Done");
    });
  } catch (error) {
    // A malformed or replayed logout_token must get a prompt 400, not a
    // request that hangs forever (unhandled rejection under Express 4).
    logger.error("Backchannel logout token verification failed");
    logger.debug(error);
    res.status(400).send("Bad request");
  }
});

module.exports = router;
